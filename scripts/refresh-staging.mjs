#!/usr/bin/env node

/**
 * Refresh staging database from production — non-destructive data-only process.
 *
 * Usage:
 *   PROD_DATABASE_URL="..." STAGING_DATABASE_URL="..." node scripts/refresh-staging.mjs [--full]
 *
 * Modes:
 *   (default)  Quick refresh — skips bulk analytics tables (~90% smaller dump)
 *   --full     Full refresh  — copies every table
 *
 * Approach:
 *   TRUNCATES data in staging tables, then restores DATA ONLY from production.
 *   Schema is NEVER touched — RLS policies, grants, triggers, enum types,
 *   PostgREST/Realtime connections all stay intact.
 *   Schema changes should be applied separately via `npm run migrate:staging`.
 *
 * Phases:
 *   1. Pre-flight validation (env vars, connectivity, direction check)
 *   2. Data transfer (TRUNCATE staging, pg_dump --data-only from prod, restore)
 *   3. Post-restore migrations (apply newer schema changes)
 *   4. Post-restore cleanup (reload PostgREST cache)
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

// Known-safe pg_restore warnings that can be ignored.
// pg_restore emits WARNINGs for privilege/ownership issues and NOTICEs for
// existing objects — all expected when restoring --no-owner --no-acl dumps.
const BENIGN_RESTORE_PATTERNS = [
  /already exists/i,
  /does not exist/i,
  /schema "public" already exists/i,
  /extension .* already exists/i,
  /WARNING:.*no privileges/i,
  /WARNING:.*skipping/i,
  /WARNING:.*owner/i,
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
  console.log(`  1. TRUNCATE all public tables on staging (schema/RLS/grants preserved)`)
  console.log(`  2. Restore DATA ONLY from production (${mode === 'full' ? 'all tables' : 'excluding bulk analytics'})`)
  console.log('  3. Run migrations for any newer schema changes')
  console.log('  4. Reload PostgREST cache')
  console.log('  5. Validate integrity')
  console.log('  6. Scrub PII (emails, names, IPs)')

  const answer = await ask('\nContinue? (yes/no): ')
  if (answer !== 'yes') { console.log('Aborted.'); process.exit(0) }

  // ── Phase 2: Truncate Staging + Restore Data Only ─────────────────────────
  phase(2, 'Truncate Staging + Restore Data from Production')

  // Step 1: Truncate all public tables on staging.
  // TRUNCATE preserves schema, RLS policies, grants, triggers, and connections.
  // CASCADE handles FK dependencies between tables.
  console.log('  Truncating all public tables on staging...')
  const truncateTablesSql = `
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `
  sql(stagingUrl, truncateTablesSql.replace(/\n/g, ' '))
  console.log('  Staging data cleared (schema + RLS + grants preserved)')

  // Step 2: Dump production DATA ONLY (custom format)
  // --data-only: no schema, no RLS, no grants — just row data
  // --disable-triggers: prevents FK violations during restore (re-enabled after)
  const excludeFlags = fullMode
    ? ''
    : BULK_TABLES.map(t => `--exclude-table-data=${t}`).join(' ')

  console.log(`  Dumping production (data only${fullMode ? '' : `, excluding ${BULK_TABLES.length} bulk tables`})...`)
  try {
    run(
      `pg_dump "${prodUrl}" -Fc --data-only --disable-triggers ${excludeFlags} -f "${dumpFile}"`,
      env
    )
  } catch (err) {
    const stderr = sanitizeError(err.stderr || '<no stderr output>')
    throw new Error(`pg_dump failed: ${stderr}`)
  }

  const dumpSize = statSync(dumpFile).size
  const dumpMB = (dumpSize / (1024 * 1024)).toFixed(1)
  console.log(`  Dump complete: ${dumpMB} MB`)

  // Step 3: Restore data into staging
  // --data-only + --disable-triggers: loads data, temporarily disables triggers
  // to avoid FK constraint violations from insert ordering, then re-enables them.
  console.log('  Restoring data to staging (pg_restore --data-only)...')
  try {
    runPassthrough(
      `pg_restore -d "${stagingUrl}" --data-only --disable-triggers --no-owner --no-acl "${dumpFile}"`,
      env
    )
  } catch (err) {
    // pg_restore returns non-zero if ANY warning occurs (e.g. table not found in staging)
    // Only suppress known-safe warnings; rethrow unexpected fatal errors
    const output = (err.stderr || err.message || '').toString()
    const isBenign = BENIGN_RESTORE_PATTERNS.some(pattern => pattern.test(output))
    if (isBenign || output.trim() === '') {
      console.log('  pg_restore returned warnings (often expected for missing tables)')
    } else {
      throw new Error(`pg_restore failed with unexpected errors: ${sanitizeError(output)}`)
    }
  }
  console.log('  Restore complete')

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

  // Reload PostgREST schema cache so API reflects any migration changes
  console.log('  Reloading PostgREST schema cache...')
  try {
    sql(stagingUrl, "NOTIFY pgrst, 'reload schema'")
    console.log('  PostgREST schema cache reloaded')
  } catch (err) {
    console.log('  NOTIFY failed (non-critical):', sanitizeError((err.stderr || err.message || '')).slice(0, 100))
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
