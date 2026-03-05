#!/usr/bin/env node

/**
 * Copy specific tables' data from production to staging.
 * Tables must already exist on staging with correct schema.
 *
 * Usage:
 *   PROD_DATABASE_URL="..." STAGING_DATABASE_URL="..." node scripts/copy-tables-to-staging.mjs
 */

import { tmpdir } from 'os'
import { join } from 'path'
import { existsSync, unlinkSync } from 'fs'
import { findPgBin, pgEnv, run, runPassthrough } from './lib/pg-helpers.mjs'

const TABLES = ['articles', 'email_metrics', 'manual_articles']

const prodUrl = process.env.PROD_DATABASE_URL
const stagingUrl = process.env.STAGING_DATABASE_URL

if (!prodUrl || !stagingUrl) {
  console.error('❌ Set PROD_DATABASE_URL and STAGING_DATABASE_URL')
  process.exit(1)
}

const pgBin = findPgBin()
const env = pgEnv(pgBin)
const dumpFile = join(tmpdir(), `targeted-tables-${Date.now()}.dump`)

try {
  const tableFlags = TABLES.map(t => `-t ${t}`).join(' ')

  console.log(`Dumping ${TABLES.length} tables from production...`)
  run(`pg_dump "${prodUrl}" -Fc --no-owner --no-acl --data-only ${tableFlags} -f "${dumpFile}"`, env)
  console.log('✅ Dump complete')

  console.log('Restoring to staging...')
  try {
    runPassthrough(`pg_restore -d "${stagingUrl}" --no-owner --no-acl --data-only "${dumpFile}"`, env)
  } catch {
    console.log('⚠️  pg_restore returned warnings (often expected)')
  }
  console.log('✅ Restore complete')

  // Verify counts
  for (const t of TABLES) {
    const count = run(`psql "${stagingUrl}" -t -A -c "SELECT count(*) FROM ${t}"`, env).trim()
    console.log(`  ${t}: ${count} rows`)
  }
} finally {
  if (existsSync(dumpFile)) {
    unlinkSync(dumpFile)
    console.log('✅ Dump file deleted')
  }
}

console.log('\nDone! Now reload PostgREST cache:')
console.log("  Run NOTIFY pgrst, 'reload schema' on staging")
