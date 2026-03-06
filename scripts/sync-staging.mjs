#!/usr/bin/env node

/**
 * Incremental staging sync — upserts recently created/modified rows from
 * production into staging WITHOUT touching schema, RLS policies, grants,
 * or active connections.
 *
 * Usage:
 *   PROD_DATABASE_URL="..." STAGING_DATABASE_URL="..." node scripts/sync-staging.mjs [--days=7] [--table=articles]
 *
 * Options:
 *   --days=N       Sync rows modified in the last N days (default: 7)
 *   --table=NAME   Sync only a specific table (can be repeated)
 *   --dry-run      Show what would be synced without writing
 *   --skip-scrub   Skip PII scrubbing after sync
 *
 * How it works:
 *   1. Auto-discovers tables with created_at / updated_at columns
 *   2. For each table, exports recent rows from production via COPY TO CSV
 *   3. Loads into staging temp table, then upserts (INSERT ... ON CONFLICT DO UPDATE)
 *   4. Runs PII scrubbing on affected tables
 *
 * This is safe because:
 *   - Schema is never touched (no DROP, no CREATE)
 *   - RLS policies, grants, triggers all stay intact
 *   - PostgREST/Realtime connections are unaffected
 *   - Only data rows are added or updated
 */

import { createInterface } from 'readline'
import { existsSync, unlinkSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { findPgBin, pgEnv, run, runSql } from './lib/pg-helpers.mjs'
import { runPiiScrub, printScrubReport } from './lib/staging-scrubber.mjs'

// ── Constants ────────────────────────────────────────────────────────────────
const STAGING_PROJECT_ID = 'cbnecpswmjonbdatxzwv'
const PROD_PROJECT_ID = 'vsbdfrqfokoltgjyiivq'

// Tables to always skip (no useful data for staging, or too large)
const SKIP_TABLES = new Set([
  'link_clicks',
  'excluded_ips',
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
  'ai_prompt_tests',
])

// ── Parse CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const daysArg = args.find(a => a.startsWith('--days='))
const DAYS = daysArg ? parseInt(daysArg.split('=')[1], 10) : 7
const tableArgs = args.filter(a => a.startsWith('--table=')).map(a => a.split('=')[1])
const DRY_RUN = args.includes('--dry-run')
const SKIP_SCRUB = args.includes('--skip-scrub')

if (isNaN(DAYS) || DAYS < 1 || DAYS > 365) {
  console.error('--days must be between 1 and 365')
  process.exit(1)
}

// ── Init ─────────────────────────────────────────────────────────────────────
const pgBin = findPgBin()
const env = pgEnv(pgBin)
const startTime = Date.now()
const tmpDir = join(tmpdir(), `staging-sync-${Date.now()}`)

function sql(dbUrl, query) {
  return runSql(dbUrl, query, env)
}

function sanitizeError(msg) {
  return msg.replace(/postgresql:\/\/[^@]*@/g, 'postgresql://***@').slice(0, 500)
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, answer => {
    rl.close()
    resolve(answer)
  }))
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════════════════

let syncedTables = 0
let syncedRows = 0
let skippedTables = 0
const results = []

try {
  // ── Phase 1: Pre-flight ───────────────────────────────────────────────────
  console.log('\n--- Phase 1: Pre-flight Validation ---')

  const prodUrl = process.env.PROD_DATABASE_URL
  const stagingUrl = process.env.STAGING_DATABASE_URL

  if (!prodUrl) throw new Error('PROD_DATABASE_URL is not set.')
  if (!stagingUrl) throw new Error('STAGING_DATABASE_URL is not set.')

  if (!prodUrl.includes(PROD_PROJECT_ID))
    throw new Error(`PROD_DATABASE_URL does not contain production project ID (${PROD_PROJECT_ID}).`)
  if (!stagingUrl.includes(STAGING_PROJECT_ID))
    throw new Error(`STAGING_DATABASE_URL does not contain staging project ID (${STAGING_PROJECT_ID}).`)
  if (prodUrl === stagingUrl)
    throw new Error('PROD and STAGING URLs are identical.')

  try { sql(prodUrl, 'SELECT 1'); console.log('  Production DB:  connected') }
  catch (err) { throw new Error(`Cannot connect to production: ${sanitizeError(err.stderr || err.message || '')}`) }

  try { sql(stagingUrl, 'SELECT 1'); console.log('  Staging DB:     connected') }
  catch (err) { throw new Error(`Cannot connect to staging: ${sanitizeError(err.stderr || err.message || '')}`) }

  // ── Phase 2: Discover tables with timestamp columns ───────────────────────
  console.log('\n--- Phase 2: Discover syncable tables ---')

  // Find all public tables that have created_at or updated_at
  const tableInfoRaw = sql(prodUrl, `
    SELECT t.tablename,
           (SELECT string_agg(kcu.column_name, ',')
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema = 'public'
              AND tc.table_name = t.tablename
           ) AS pk_cols,
           EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = t.tablename AND c.column_name = 'created_at') AS has_created,
           EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = t.tablename AND c.column_name = 'updated_at') AS has_updated
    FROM pg_tables t
    WHERE t.schemaname = 'public'
    ORDER BY t.tablename
  `)

  // Parse the psql output (pipe-separated)
  const tables = tableInfoRaw
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      const parts = line.split('|').map(s => s.trim())
      return {
        name: parts[0],
        pkCols: parts[1] ? parts[1].split(',') : [],
        hasCreated: parts[2] === 't',
        hasUpdated: parts[3] === 't',
      }
    })
    .filter(t => {
      // Must have at least one timestamp column
      if (!t.hasCreated && !t.hasUpdated) return false
      // Must have a primary key (needed for ON CONFLICT)
      if (t.pkCols.length === 0) return false
      // If specific tables requested, only include those (overrides skip list)
      if (tableArgs.length > 0) return tableArgs.includes(t.name)
      // Otherwise skip bulk tables by default
      if (SKIP_TABLES.has(t.name)) return false
      return true
    })

  // Also find tables WITHOUT timestamps (config/reference tables) - these need full sync
  const noTimestampTables = tableInfoRaw
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      const parts = line.split('|').map(s => s.trim())
      return {
        name: parts[0],
        pkCols: parts[1] ? parts[1].split(',') : [],
        hasCreated: parts[2] === 't',
        hasUpdated: parts[3] === 't',
      }
    })
    .filter(t => {
      if (t.hasCreated || t.hasUpdated) return false
      if (t.pkCols.length === 0) return false
      // If specific tables requested, only include those (overrides skip list)
      if (tableArgs.length > 0) return tableArgs.includes(t.name)
      if (SKIP_TABLES.has(t.name)) return false
      return true
    })

  console.log(`  ${tables.length} tables with timestamps (incremental sync)`)
  console.log(`  ${noTimestampTables.length} tables without timestamps (full upsert if targeted)`)

  if (tables.length === 0 && noTimestampTables.length === 0) {
    console.log('  No tables to sync.')
    process.exit(0)
  }

  // ── Phase 3: Count recent rows ────────────────────────────────────────────
  console.log(`\n--- Phase 3: Preview (rows modified in last ${DAYS} days) ---`)

  const syncPlan = []
  for (const t of tables) {
    const tsCol = t.hasUpdated ? 'updated_at' : 'created_at'
    const countResult = sql(prodUrl,
      `SELECT count(*) FROM ${t.name} WHERE ${tsCol} >= now() - interval '${DAYS} days'`
    )
    const count = parseInt(countResult, 10)
    if (count > 0) {
      syncPlan.push({ ...t, tsCol, count, mode: 'incremental' })
      console.log(`  ${t.name}: ${count} rows (via ${tsCol})`)
    }
  }

  // For no-timestamp tables targeted explicitly, do full upsert
  for (const t of noTimestampTables) {
    if (tableArgs.includes(t.name)) {
      const countResult = sql(prodUrl, `SELECT count(*) FROM ${t.name}`)
      const count = parseInt(countResult, 10)
      syncPlan.push({ ...t, tsCol: null, count, mode: 'full' })
      console.log(`  ${t.name}: ${count} rows (full upsert, no timestamp)`)
    }
  }

  if (syncPlan.length === 0) {
    console.log(`  No rows modified in the last ${DAYS} days.`)
    process.exit(0)
  }

  const totalRows = syncPlan.reduce((sum, t) => sum + t.count, 0)
  console.log(`\n  Total: ${totalRows} rows across ${syncPlan.length} tables`)

  if (DRY_RUN) {
    console.log('\n  --dry-run: exiting without changes.')
    process.exit(0)
  }

  const answer = await ask('\nProceed with sync? (yes/no): ')
  if (answer !== 'yes') { console.log('Aborted.'); process.exit(0) }

  // ── Phase 4: Sync each table ──────────────────────────────────────────────
  console.log('\n--- Phase 4: Syncing tables ---')
  mkdirSync(tmpDir, { recursive: true })

  for (const t of syncPlan) {
    const csvFile = join(tmpDir, `${t.name}.csv`)
    try {
      // Step 1: Get all column names from production
      const colsRaw = sql(prodUrl, `
        SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${t.name}'
      `)
      const allCols = colsRaw.trim()

      if (!allCols) {
        console.log(`  ${t.name}: skipped (no columns found)`)
        skippedTables++
        continue
      }

      // Step 2: Check that table exists on staging with same columns
      const stagingColsRaw = sql(stagingUrl, `
        SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${t.name}'
      `)

      if (!stagingColsRaw.trim()) {
        console.log(`  ${t.name}: skipped (table not found on staging)`)
        skippedTables++
        results.push({ table: t.name, rows: 0, status: 'skipped (not on staging)' })
        continue
      }

      // Use the intersection of columns (in case staging is slightly behind)
      const prodCols = new Set(allCols.split(','))
      const stagingCols = new Set(stagingColsRaw.trim().split(','))
      const commonCols = [...prodCols].filter(c => stagingCols.has(c))

      if (commonCols.length === 0) {
        console.log(`  ${t.name}: skipped (no common columns)`)
        skippedTables++
        continue
      }

      const colList = commonCols.join(', ')

      // Step 3: Export recent rows from production to CSV
      const whereClause = t.mode === 'full'
        ? ''
        : `WHERE ${t.tsCol} >= now() - interval '${DAYS} days'`

      run(
        `psql "${prodUrl}" -c "\\copy (SELECT ${colList} FROM ${t.name} ${whereClause}) TO '${csvFile.replace(/\\/g, '/')}' WITH CSV HEADER"`,
        env
      )

      // Step 4: Build upsert query
      const pkList = t.pkCols.join(', ')
      const updateCols = commonCols.filter(c => !t.pkCols.includes(c))
      const updateSet = updateCols.length > 0
        ? updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ')
        : `${t.pkCols[0]} = EXCLUDED.${t.pkCols[0]}` // no-op update for insert-only

      const tempTable = `_sync_tmp_${t.name}`

      // Step 5: Create temp table, load CSV, upsert
      // Use a transaction to keep it atomic per table
      const upsertSql = `
        BEGIN;
        CREATE TEMP TABLE ${tempTable} (LIKE ${t.name} INCLUDING ALL) ON COMMIT DROP;
        \\copy ${tempTable} (${colList}) FROM '${csvFile.replace(/\\/g, '/')}' WITH CSV HEADER;
        INSERT INTO ${t.name} (${colList})
          SELECT ${colList} FROM ${tempTable}
          ON CONFLICT (${pkList}) DO UPDATE SET ${updateSet};
        COMMIT;
      `

      // Write SQL to file (psql needs a file for multi-statement with \copy)
      const sqlFile = join(tmpDir, `${t.name}.sql`)
      writeFileSync(sqlFile, upsertSql)

      run(`psql "${stagingUrl}" -f "${sqlFile.replace(/\\/g, '/')}"`, env)

      syncedTables++
      syncedRows += t.count
      results.push({ table: t.name, rows: t.count, status: 'synced' })
      console.log(`  ${t.name}: ${t.count} rows synced`)

    } catch (err) {
      const msg = sanitizeError(err.stderr || err.message || '')
      console.error(`  ${t.name}: FAILED - ${msg}`)
      results.push({ table: t.name, rows: 0, status: `failed: ${msg.slice(0, 80)}` })
    } finally {
      // Clean up CSV file
      if (existsSync(csvFile)) try { unlinkSync(csvFile) } catch {}
    }
  }

  // ── Phase 5: PII Scrubbing ────────────────────────────────────────────────
  if (!SKIP_SCRUB) {
    console.log('\n--- Phase 5: PII Scrubbing ---')
    const scrubResult = runPiiScrub(stagingUrl, sql)
    printScrubReport(scrubResult)
  } else {
    console.log('\n--- Phase 5: PII Scrubbing (skipped) ---')
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`
${'='.repeat(60)}
  INCREMENTAL SYNC COMPLETE
${'='.repeat(60)}
  Duration:  ${elapsed}s
  Tables:    ${syncedTables} synced, ${skippedTables} skipped
  Rows:      ${syncedRows} upserted
  Period:    last ${DAYS} days
${'='.repeat(60)}
`)

  if (results.some(r => r.status.startsWith('failed'))) {
    console.log('Failed tables:')
    for (const r of results.filter(r => r.status.startsWith('failed'))) {
      console.log(`  ${r.table}: ${r.status}`)
    }
    process.exitCode = 1
  }

} catch (err) {
  console.error(`\n${err.message}`)
  process.exitCode = 1
} finally {
  // Clean up temp directory
  if (existsSync(tmpDir)) {
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
}
