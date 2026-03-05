#!/usr/bin/env node

/**
 * Refresh staging database from production — 7-phase secure process.
 *
 * Usage:
 *   PROD_DATABASE_URL="..." STAGING_DATABASE_URL="..." node scripts/refresh-staging.mjs
 *
 * Phases:
 *   1. Pre-flight validation (env vars, connectivity, direction check)
 *   2. Schema preparation (drop tables, run migrations for canonical schema)
 *   3. Data transfer (pg_dump --data-only from prod, psql restore to staging)
 *   4. Post-restore migration re-run (catch seed data / defaults)
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

// ── Init ─────────────────────────────────────────────────────────────────────
const pgBin = findPgBin()
const env = pgEnv(pgBin)
const startTime = Date.now()

// Bind runSql to our env
function sql(dbUrl, query) {
  return runSql(dbUrl, query, env)
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseHost(url) {
  try {
    const u = new URL(url)
    return u.hostname
  } catch {
    return 'unknown'
  }
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

// ── Dump file path (set early so finally block can always clean up) ──────────
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const dumpFile = join(tmpdir(), `staging-refresh-${timestamp}.sql`)

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════════════════

try {
  // ── Phase 1: Pre-flight Validation ───────────────────────────────────────
  phase(1, 'Pre-flight Validation')

  const prodUrl = process.env.PROD_DATABASE_URL
  const stagingUrl = process.env.STAGING_DATABASE_URL

  if (!prodUrl) { console.error('❌ PROD_DATABASE_URL is not set.'); process.exit(1) }
  if (!stagingUrl) { console.error('❌ STAGING_DATABASE_URL is not set.'); process.exit(1) }

  const prodHost = parseHost(prodUrl)
  const stagingHost = parseHost(stagingUrl)

  // Direction safety: hostnames must differ
  if (prodHost === stagingHost) {
    console.error('❌ PROD and STAGING hostnames are identical — aborting to prevent data loss.')
    process.exit(1)
  }

  // Verify URLs contain correct project IDs
  if (!stagingUrl.includes(STAGING_PROJECT_ID)) {
    console.error(`❌ STAGING_DATABASE_URL does not contain staging project ID (${STAGING_PROJECT_ID}).`)
    process.exit(1)
  }

  if (!prodUrl.includes(PROD_PROJECT_ID)) {
    console.error(`❌ PROD_DATABASE_URL does not contain production project ID (${PROD_PROJECT_ID}).`)
    process.exit(1)
  }

  // Test connectivity
  console.log(`  Production host:  ${prodHost}`)
  console.log(`  Staging host:     ${stagingHost}`)

  try { sql(prodUrl, 'SELECT 1'); console.log('  Production DB:    ✅ connected') }
  catch { console.error('❌ Cannot connect to production database.'); process.exit(1) }

  try { sql(stagingUrl, 'SELECT 1'); console.log('  Staging DB:       ✅ connected') }
  catch { console.error('❌ Cannot connect to staging database.'); process.exit(1) }

  // Interactive confirmation
  console.log('')
  console.log('This will:')
  console.log('  1. DROP all tables on staging')
  console.log('  2. Re-create schema from migrations')
  console.log('  3. Copy production data (data-only)')
  console.log('  4. Validate integrity')
  console.log('  5. Scrub PII (emails, names, IPs)')

  const answer = await ask('\nContinue? (yes/no): ')
  if (answer !== 'yes') { console.log('Aborted.'); process.exit(0) }

  // ── Phase 2: Schema Preparation ──────────────────────────────────────────
  phase(2, 'Schema Preparation (staging)')

  // Drop all tables in public schema
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
  console.log('  ✅ All public tables dropped')

  // Drop custom enum types
  console.log('  Dropping custom enum types...')
  const dropEnumsSql = `
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT t.typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
      END LOOP;
    END $$;
  `
  sql(stagingUrl, dropEnumsSql.replace(/\n/g, ' '))
  console.log('  ✅ Custom enum types dropped')

  // Run all migrations to establish canonical schema
  console.log('  Running migrations to establish canonical schema...')
  const migrationsDir = resolve(process.cwd(), 'db', 'migrations')
  const migrationFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  let migOk = 0
  let migWarn = 0
  for (const file of migrationFiles) {
    const filePath = join(migrationsDir, file)
    try {
      run(`psql "${stagingUrl}" -f "${filePath}" 2>&1`, env)
      migOk++
    } catch (err) {
      const output = (err.stdout || '') + (err.stderr || '')
      if (output.includes('already exists') || output.includes('duplicate')) {
        migWarn++
      } else {
        console.error(`  ❌ Migration failed: ${file}`)
        console.error(output.slice(0, 500))
        process.exit(1)
      }
    }
  }
  console.log(`  ✅ Migrations complete: ${migOk} applied, ${migWarn} skipped`)

  // ── Phase 3: Data Transfer ───────────────────────────────────────────────
  phase(3, 'Data Transfer')

  console.log('  Dumping production data (--data-only)...')
  try {
    run(
      `pg_dump "${prodUrl}" --data-only --no-owner --no-acl --disable-triggers -f "${dumpFile}"`,
      env
    )
  } catch (err) {
    console.error('❌ pg_dump failed:', err.stderr || err.message)
    process.exit(1)
  }

  const dumpSize = statSync(dumpFile).size
  console.log(`  ✅ Dump complete: ${Math.round(dumpSize / 1024)} KB`)

  console.log('  Restoring data to staging...')
  try {
    runPassthrough(`psql "${stagingUrl}" -f "${dumpFile}"`, env)
  } catch {
    // psql may return non-zero on warnings (e.g. duplicate keys for seed data) — that's OK
    console.log('  ⚠️  psql returned warnings (often expected for data-only restores)')
  }
  console.log('  ✅ Data restore complete')

  // ── Phase 4: Post-restore Migration Re-run ───────────────────────────────
  phase(4, 'Post-restore Migration Re-run')

  console.log('  Re-running migrations for seed data and defaults...')
  let postMigOk = 0
  let postMigWarn = 0
  for (const file of migrationFiles) {
    const filePath = join(migrationsDir, file)
    try {
      run(`psql "${stagingUrl}" -f "${filePath}" 2>&1`, env)
      postMigOk++
    } catch (err) {
      const output = (err.stdout || '') + (err.stderr || '')
      if (output.includes('already exists') || output.includes('duplicate')) {
        postMigWarn++
      } else {
        // Non-critical in post-restore — log and continue
        console.log(`  ⚠️  ${file}: ${output.slice(0, 200)}`)
        postMigWarn++
      }
    }
  }
  console.log(`  ✅ Post-restore migrations: ${postMigOk} applied, ${postMigWarn} skipped`)

  // ── Phase 5: Integrity Validation ────────────────────────────────────────
  phase(5, 'Integrity Validation')

  const validation = await runValidations(stagingUrl, sql)
  printValidationReport(validation)

  // Blocking check: stale newsletters table
  const staleCheck = validation.results.find(r => r.name === 'No stale newsletters table')
  if (staleCheck && !staleCheck.ok) {
    console.error('\n❌ BLOCKING: Stale "newsletters" table detected. Dropping it...')
    sql(stagingUrl, 'DROP TABLE IF EXISTS newsletters CASCADE')
    console.log('  ✅ Dropped stale newsletters table')
  }

  // ── Phase 6: PII Scrubbing ──────────────────────────────────────────────
  phase(6, 'PII Scrubbing')

  const scrubResult = runPiiScrub(stagingUrl, sql)
  printScrubReport(scrubResult)

  // ── Phase 7: Cleanup & Summary ──────────────────────────────────────────
  phase(7, 'Cleanup & Summary')

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
    console.error('   This file contains a full production database copy. Delete it immediately.')
    process.exit(1)
  } else {
    console.log('  ✅ Dump file verified deleted')
  }
}

// ── Final Summary ──────────────────────────────────────────────────────────
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
console.log(`
${'═'.repeat(60)}
  STAGING REFRESH COMPLETE
${'═'.repeat(60)}
  Duration:     ${elapsed}s
  Dump file:    deleted ✅

  Next steps:
  - Verify staging dashboard loads: https://aiprodaily-staging.vercel.app
  - Check Settings > Sections shows all modules
  - Run a test workflow if needed
${'═'.repeat(60)}
`)
