#!/usr/bin/env node

/**
 * Refresh staging database from production.
 *
 * Usage:
 *   PROD_DATABASE_URL="..." STAGING_DATABASE_URL="..." node scripts/refresh-staging.mjs
 *
 * Requires: pg_dump, psql (PostgreSQL client tools)
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { createInterface } from 'readline'

// --- Find PostgreSQL binaries ---
function findPgBin() {
  // Check if already on PATH
  try {
    execSync('pg_dump --version', { stdio: 'pipe' })
    return ''
  } catch {}

  // Windows: check common install locations
  if (process.platform === 'win32') {
    for (const ver of [18, 17, 16, 15, 14]) {
      const bin = `C:\\Program Files\\PostgreSQL\\${ver}\\bin`
      if (existsSync(`${bin}\\pg_dump.exe`)) {
        return bin
      }
    }
  }

  console.error('Error: pg_dump not found. Install PostgreSQL or add its bin directory to PATH.')
  process.exit(1)
}

const pgBin = findPgBin()
const pathEnv = pgBin ? `${pgBin};${process.env.PATH}` : process.env.PATH

function run(cmd) {
  return execSync(cmd, { encoding: 'utf-8', env: { ...process.env, PATH: pathEnv }, stdio: ['pipe', 'pipe', 'pipe'] })
}

function runPassthrough(cmd) {
  execSync(cmd, { encoding: 'utf-8', env: { ...process.env, PATH: pathEnv }, stdio: 'inherit' })
}

// --- Validate env vars ---
const prodUrl = process.env.PROD_DATABASE_URL
const stagingUrl = process.env.STAGING_DATABASE_URL

if (!prodUrl) {
  console.error('Error: PROD_DATABASE_URL is not set.')
  process.exit(1)
}

if (!stagingUrl) {
  console.error('Error: STAGING_DATABASE_URL is not set.')
  process.exit(1)
}

// --- Confirm ---
const rl = createInterface({ input: process.stdin, output: process.stdout })

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve))
}

console.log('=== Staging Database Refresh ===')
console.log('')
console.log('This will:')
console.log('  1. Dump the production database')
console.log('  2. Restore it to the staging database (replacing all existing data)')
console.log('')

const answer = await ask('Continue? (yes/no): ')
rl.close()

if (answer !== 'yes') {
  console.log('Aborted.')
  process.exit(0)
}

// --- Dump production ---
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const dumpFile = `${process.env.TEMP || '/tmp'}/prod-dump-${timestamp}.sql`

console.log('')
console.log('Dumping production database...')
try {
  run(`pg_dump "${prodUrl}" --no-owner --no-acl --clean --if-exists -f "${dumpFile}"`)
} catch (err) {
  console.error('pg_dump failed:', err.stderr || err.message)
  process.exit(1)
}

const { statSync } = await import('fs')
const dumpSize = statSync(dumpFile).size
console.log(`Dump complete: ${dumpFile} (${Math.round(dumpSize / 1024)} KB)`)

// --- Restore to staging ---
console.log('')
console.log('Restoring to staging database...')
try {
  runPassthrough(`psql "${stagingUrl}" -f "${dumpFile}"`)
} catch {
  // psql may return non-zero on warnings, that's OK
}

// --- Smoke test ---
console.log('')
console.log('Smoke test: checking publications row count...')
try {
  const result = run(`psql "${stagingUrl}" -t -c "SELECT count(*) FROM publications;"`)
  const count = result.trim()
  console.log(`Publications rows: ${count}`)

  if (parseInt(count, 10) === 0) {
    console.error('WARNING: No publications found — restore may have failed!')
    process.exit(1)
  }
} catch (err) {
  console.error('Smoke test failed:', err.stderr || err.message)
  process.exit(1)
}

console.log('')
console.log('Staging refresh complete.')
console.log(`Dump file retained at: ${dumpFile}`)
