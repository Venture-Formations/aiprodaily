#!/usr/bin/env node

/**
 * Shared PostgreSQL binary helpers for staging scripts.
 */

import { execSync, execFileSync } from 'child_process'
import { existsSync } from 'fs'

/**
 * Locate pg_dump/psql binaries. Returns prefix path or '' if on PATH.
 * Verifies both pg_dump and psql are available since scripts need both.
 */
export function findPgBin() {
  // Check if both are on PATH
  try {
    execSync('pg_dump --version', { stdio: 'pipe' })
    execSync('psql --version', { stdio: 'pipe' })
    return ''
  } catch {}

  if (process.platform === 'win32') {
    for (const ver of [18, 17, 16, 15, 14]) {
      const bin = `C:\\Program Files\\PostgreSQL\\${ver}\\bin`
      if (existsSync(`${bin}\\pg_dump.exe`) && existsSync(`${bin}\\psql.exe`)) return bin
    }
  }

  console.error('❌ pg_dump and/or psql not found. Install PostgreSQL or add its bin directory to PATH.')
  process.exit(1)
}

/** Build PATH env with pg binaries included. */
export function pgEnv(pgBin) {
  const pathEnv = pgBin ? `${pgBin};${process.env.PATH}` : process.env.PATH
  return { ...process.env, PATH: pathEnv }
}

/** Run a command and return stdout. */
export function run(cmd, env) {
  return execSync(cmd, { encoding: 'utf-8', env, stdio: ['pipe', 'pipe', 'pipe'] })
}

/** Run a command with output piped to the terminal. */
export function runPassthrough(cmd, env) {
  execSync(cmd, { encoding: 'utf-8', env, stdio: 'inherit' })
}

/** Run a SQL query against a database URL and return trimmed stdout. */
export function runSql(dbUrl, sql, env) {
  const result = execFileSync('psql', [dbUrl, '-t', '-A', '-c', sql], {
    encoding: 'utf-8',
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  return result.trim()
}
