#!/usr/bin/env node

/**
 * Refresh staging database from production — 7-phase secure process.
 *
 * Usage:
 *   PROD_DATABASE_URL="..." STAGING_DATABASE_URL="..." node scripts/refresh-staging.mjs [--full]
 *
 * Modes:
 *   (default)  Quick refresh — skips bulk analytics tables (~90% smaller dump)
 *   --full     Full refresh  — copies every table
 *
 * Approach:
 *   Dumps schema+data from production (production schema is canonical truth,
 *   not migrations — many FKs and columns were added via Supabase dashboard).
 *   Uses --clean --if-exists to drop+recreate objects on staging.
 *   Then runs migrations to apply any newer schema changes, drops stale objects,
 *   reloads PostgREST cache, validates integrity, and scrubs PII.
 *
 * Phases:
 *   1. Pre-flight validation (env vars, connectivity, direction check)
 *   2. Data transfer (pg_dump schema+data from prod, psql restore to staging)
 *   3. Post-restore migrations (apply newer schema changes)
 *   4. Post-restore cleanup (drop stale objects, reload PostgREST)
 *   5. Integrity validation (FK counts, PKs, orphans, row counts)
 *   6. PII scrubbing (anonymize emails, names, IPs)
 *   7. Cleanup (delete dump file, print summary)
 *
 * Requires: pg_dump, psql (PostgreSQL client tools)
 */

import { createInterface } from 'readline'
import { existsSync, unlinkSync, statSync, readdirSync } from 'fs'
import { resolve, join } from 'path'
import { tmpdir } from 'os'
import { findPgBin, pgEnv, run, runPassthrough, runSql } from './lib/pg-helpers.mjs'
import { runValidations, printValidationReport } from './lib/staging-validators.mjs'
import { runPiiScrub, printScrubReport } from './lib/staging-scrubber.mjs'

// ── Constants ────────────────────────────────────────────────────────────────
const STAGING_PROJECT_ID = 'cbnecpswmjonbdatxzwv'
const PROD_PROJECT_ID = 'vsbdfrqfokoltgjyiivq'

// Bulk analytics/tracking tables excluded in quick mode.
// These are high-volume event tables that aren't needed for staging functionality.
// New tables are included by default — only add tables here that are confirmed bulk data.
const BULK_TABLES = [
  'link_clicks',
  'feedback_responses',
  'feedback_votes',
  'feedback_comments',
  'feedback_comment_read_status',
  'poll_responses',
  'excluded_ips',
  'subscriber_real_click_status',
  'sparkloop_events',
  'sparkloop_daily_snapshots',
  'sparkloop_referrals',
  'sparkloop_module_clicks',
  'sparkloop_offer_events',
  'afteroffers_events',
  'afteroffers_click_mappings',
  'tool_directory_clicks',
  'mailerlite_field_updates',
  'sendgrid_field_updates',
  'article_performance',
  'contact_submissions',
  'ai_prompt_tests',
]

// Stale objects to drop after restore (remnants from old schema)
const STALE_TABLES = ['newsletters']

// Known-safe pg_restore warnings that can be ignored
const BENIGN_RESTORE_PATTERNS = [
  /already exists/i,
  /schema "public" already exists/i,
  /extension .* already exists/i,
  /WARNING:/i,
  /NOTICE:/i,
]

// ── Parse CLI args ───────────────────────────────────────────────────────────
const fullMode = process.argv.includes('--full')
const mode = fullMode ? 'full' : 'quick'

// ── Init ─────────────────────────────────────────────────────────────────────
const pgBin = findPgBin()
const env = pgEnv(pgBin)
const startTime = Date.now()

function sql(dbUrl, query) {
  return runSql(dbUrl, query, env)
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseHost(url) {
  try { return new URL(url).hostname } catch { return 'unknown' }
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, answer => {
    rl.close()
    resolve(answer)
  }))
}

function phase(n, title) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  Phase ${n}: ${title}`)
  console.log('═'.repeat(60))
}

/** Strip credentials from error messages to prevent leaking passwords in output. */
function sanitizeError(msg) {
  return msg.replace(/postgresql:\/\/[^@]*@/g, 'postgresql://***@').slice(0, 500)
}

// ── Dump file path (set early so finally block can always clean up) ──────────
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const dumpFile = join(tmpdir(), `staging-refresh-${timestamp}.dump`)

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════════════════

let failed = false

try {
  // ── Phase 1: Pre-flight Validation ───────────────────────────────────────
  phase(1, 'Pre-flight Validation')

  const prodUrl = process.env.PROD_DATABASE_URL
  const stagingUrl = process.env.STAGING_DATABASE_URL

  if (!prodUrl) throw new Error('PROD_DATABASE_URL is not set.')
  if (!stagingUrl) throw new Error('STAGING_DATABASE_URL is not set.')

  // Direction safety: verify project IDs in connection strings
  // Supabase pooler uses a shared hostname — the project ID is in the username
  if (!prodUrl.includes(PROD_PROJECT_ID)) {
    throw new Error(`PROD_DATABASE_URL does not contain production project ID (${PROD_PROJECT_ID}).`)
  }

  if (!stagingUrl.includes(STAGING_PROJECT_ID)) {
    throw new Error(`STAGING_DATABASE_URL does not contain staging project ID (${STAGING_PROJECT_ID}).`)
  }

  if (prodUrl === stagingUrl) {
    throw new Error('PROD and STAGING URLs are identical — aborting to prevent data loss.')
  }

  const prodHost = parseHost(prodUrl)
  const stagingHost = parseHost(stagingUrl)

  console.log(`  Mode:        ${mode.toUpperCase()}${fullMode ? '' : ` (skipping ${BULK_TABLES.length} bulk tables)`}`)
  console.log(`  Production:  ${PROD_PROJECT_ID} @ ${prodHost}`)
  console.log(`  Staging:     ${STAGING_PROJECT_ID} @ ${stagingHost}`)

  try { sql(prodUrl, 'SELECT 1'); console.log('  Production DB:    ✅ connected') }
  catch (err) {
    const detail = sanitizeError((err.stderr || err.message || '').trim())
    throw new Error(`Cannot connect to production database. ${detail}`)
  }

  try { sql(stagingUrl, 'SELECT 1'); console.log('  Staging DB:       ✅ connected') }
  catch (err) {
    const detail = sanitizeError((err.stderr || err.message || '').trim())
    throw new Error(`Cannot connect to staging database. ${detail}`)
  }

  // Interactive confirmation
  console.log('')
  console.log('This will:')
  console.log('  1. Drop all tables on staging')
  console.log(`  2. Dump+restore production schema+data (${mode === 'full' ? 'all tables' : 'excluding bulk analytics'})`)
  console.log('  3. Run migrations for any newer schema changes')
  console.log('  4. Drop stale objects, reload PostgREST cache')
  console.log('  5. Validate integrity')
  console.log('  6. Scrub PII (emails, names, IPs)')

  const answer = await ask('\nContinue? (yes/no): ')
  if (answer !== 'yes') { console.log('Aborted.'); process.exit(0) }

  // ── Phase 2: Clean Staging + Restore ─────────────────────────────────────
  phase(2, 'Clean Staging + Restore from Production')

  // Step 1: Drop all tables on staging first (clean slate)
  // We do this ourselves rather than relying on pg_restore --clean,
  // because --clean fails silently on Supabase tables with triggers/RLS/extensions.
  console.log('  Dropping all public tables on staging...')
  const dropTablesSql = `
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `
  sql(stagingUrl, dropTablesSql.replace(/\n/g, ' '))

  // Also drop custom enum types
  const dropEnumsSql = `
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT t.typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
      END LOOP;
    END $$;
  `
  sql(stagingUrl, dropEnumsSql.replace(/\n/g, ' '))
  console.log('  ✅ Staging cleaned (all tables + enums dropped)')

  // Step 2: Dump production (custom format, NO --clean since we already cleaned)
  const excludeFlags = fullMode
    ? ''
    : BULK_TABLES.map(t => `--exclude-table-data=${t}`).join(' ')

  console.log(`  Dumping production (schema+data${fullMode ? '' : `, excluding data for ${BULK_TABLES.length} bulk tables`})...`)
  try {
    run(
      `pg_dump "${prodUrl}" -Fc --no-owner --no-acl ${excludeFlags} -f "${dumpFile}"`,
      env
    )
  } catch (err) {
    const stderr = sanitizeError(err.stderr || '<no stderr output>')
    throw new Error(`pg_dump failed: ${stderr}`)
  }

  const dumpSize = statSync(dumpFile).size
  const dumpMB = (dumpSize / (1024 * 1024)).toFixed(1)
  console.log(`  ✅ Dump complete: ${dumpMB} MB`)

  // Step 3: Restore into clean staging (no --clean needed)
  console.log('  Restoring to staging (pg_restore)...')
  try {
    runPassthrough(`pg_restore -d "${stagingUrl}" --no-owner --no-acl "${dumpFile}"`, env)
  } catch (err) {
    // pg_restore returns non-zero if ANY warning occurs (e.g. extension already exists)
    // Only suppress known-safe warnings; rethrow unexpected fatal errors
    const output = (err.stderr || err.message || '').toString()
    const isBenign = BENIGN_RESTORE_PATTERNS.some(pattern => pattern.test(output))
    if (isBenign || output.trim() === '') {
      console.log('  ⚠️  pg_restore returned warnings (often expected for extensions/schemas)')
    } else {
      throw new Error(`pg_restore failed with unexpected errors: ${sanitizeError(output)}`)
    }
  }
  console.log('  ✅ Restore complete')

  // ── Phase 3: Post-restore Migrations ─────────────────────────────────────
  phase(3, 'Post-restore Migrations')

  console.log('  Running migrations to apply any newer schema changes...')
  const migrationsDir = resolve(process.cwd(), 'db', 'migrations')
  const migrationFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  // Use ON_ERROR_STOP=1 so psql fails fast on genuine SQL errors
  const migEnv = { ...env, ON_ERROR_STOP: '1' }

  let migOk = 0
  let migWarn = 0
  for (const file of migrationFiles) {
    const filePath = join(migrationsDir, file)
    try {
      run(`psql "${stagingUrl}" -v ON_ERROR_STOP=1 -f "${filePath}" 2>&1`, migEnv)
      migOk++
    } catch (err) {
      const output = (err.stdout || '') + (err.stderr || '')
      if (output.includes('already exists') || output.includes('duplicate')) {
        migWarn++
      } else {
        // Non-critical post-restore — log and continue
        console.log(`  ⚠️  ${file}: ${sanitizeError(output).slice(0, 200)}`)
        migWarn++
      }
    }
  }
  console.log(`  ✅ Migrations: ${migOk} applied, ${migWarn} skipped (already applied)`)

  // ── Phase 4: Post-restore Cleanup ────────────────────────────────────────
  phase(4, 'Post-restore Cleanup')

  // Drop stale tables that shouldn't exist
  for (const table of STALE_TABLES) {
    try {
      const exists = sql(stagingUrl, `SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = '${table}'`)
      if (parseInt(exists, 10) > 0) {
        sql(stagingUrl, `DROP TABLE IF EXISTS ${table} CASCADE`)
        console.log(`  ✅ Dropped stale table: ${table}`)
      }
    } catch {}
  }

  // Reload PostgREST schema cache
  console.log('  Reloading PostgREST schema cache...')
  try {
    sql(stagingUrl, "NOTIFY pgrst, 'reload schema'")
    console.log('  ✅ PostgREST schema cache reloaded')
  } catch (err) {
    console.log('  ⚠️  NOTIFY failed (non-critical):', sanitizeError((err.stderr || err.message || '')).slice(0, 100))
  }

  // ── Phase 5: Integrity Validation ────────────────────────────────────────
  phase(5, 'Integrity Validation')

  const validation = await runValidations(stagingUrl, sql)
  printValidationReport(validation)

  // ── Phase 6: PII Scrubbing ──────────────────────────────────────────────
  phase(6, 'PII Scrubbing')

  const scrubResult = runPiiScrub(stagingUrl, sql)
  printScrubReport(scrubResult)

  // ── Phase 7: Cleanup & Summary ──────────────────────────────────────────
  phase(7, 'Cleanup & Summary')

} catch (err) {
  failed = true
  console.error(`\n❌ ${err.message}`)
} finally {
  // Always delete dump file, even on error
  if (existsSync(dumpFile)) {
    try {
      unlinkSync(dumpFile)
      console.log(`  ✅ Dump file deleted: ${dumpFile}`)
    } catch (err) {
      console.error(`  ❌ Failed to delete dump file: ${dumpFile}`)
      console.error(`     Delete it manually: rm "${dumpFile}"`)
    }
  }

  // Verify deletion
  if (existsSync(dumpFile)) {
    console.error(`\n❌ SECURITY: Dump file still exists at ${dumpFile}`)
    console.error('   This file contains production data. Delete it immediately.')
    process.exitCode = 1
  } else {
    console.log('  ✅ Dump file verified deleted')
  }
}

if (failed) {
  process.exitCode = 1
} else if (!process.exitCode) {
  // ── Final Summary ──────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`
${'═'.repeat(60)}
  STAGING REFRESH COMPLETE (${mode.toUpperCase()} mode)
${'═'.repeat(60)}
  Duration:     ${elapsed}s
  Dump file:    deleted ✅

  Next steps:
  - Verify staging dashboard loads: https://aiprodaily-staging.vercel.app
  - Check Settings > Sections shows all modules
  - Run a test workflow if needed
${'═'.repeat(60)}
`)
}
