#!/usr/bin/env node

/**
 * Run SQL migrations against staging or production Supabase.
 *
 * Usage:
 *   node scripts/run-migrations.mjs staging
 *   CONFIRM=prod node scripts/run-migrations.mjs prod
 *
 * Env vars:
 *   STAGING_DATABASE_URL — connection string for staging
 *   PROD_DATABASE_URL    — connection string for production
 */

import { execSync } from 'child_process'
import { readdirSync } from 'fs'
import { resolve, join } from 'path'

const target = process.argv[2]

if (!target || !['staging', 'prod'].includes(target)) {
  console.error('Usage: node scripts/run-migrations.mjs <staging|prod>')
  process.exit(1)
}

// Safety gate for production
if (target === 'prod' && process.env.CONFIRM !== 'prod') {
  console.error('Production migrations require CONFIRM=prod environment variable.')
  console.error('  CONFIRM=prod node scripts/run-migrations.mjs prod')
  process.exit(1)
}

const envVar = target === 'staging' ? 'STAGING_DATABASE_URL' : 'PROD_DATABASE_URL'
const databaseUrl = process.env[envVar]

if (!databaseUrl) {
  console.error(`Missing ${envVar} environment variable.`)
  process.exit(1)
}

const migrationsDir = resolve(process.cwd(), 'db', 'migrations')
let files

try {
  files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort() // lexicographic order
} catch (err) {
  console.error(`Cannot read migrations directory: ${migrationsDir}`)
  console.error(err.message)
  process.exit(1)
}

if (files.length === 0) {
  console.log('No migration files found.')
  process.exit(0)
}

console.log(`Applying ${files.length} migrations to ${target}...`)

let ok = 0
let warn = 0

for (const file of files) {
  const filePath = join(migrationsDir, file)
  try {
    execSync(`psql "${databaseUrl}" -f "${filePath}" 2>&1`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    ok++
    console.log(`  OK   ${file}`)
  } catch (err) {
    // Migrations are idempotent — "already exists" errors are expected
    const output = (err.stdout || '') + (err.stderr || '')
    if (output.includes('already exists') || output.includes('duplicate')) {
      warn++
      console.log(`  WARN ${file} (already applied)`)
    } else {
      console.error(`  FAIL ${file}`)
      console.error(output)
      process.exit(1)
    }
  }
}

console.log(`\nDone: ${ok} applied, ${warn} skipped (already applied).`)
