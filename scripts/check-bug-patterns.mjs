#!/usr/bin/env node
/**
 * Bug-pattern checks scoped to changed files.
 * Run before commit (staged files) or in CI (files changed vs base).
 * See docs/checklists/bug-pattern-checks.md.
 *
 * Usage:
 *   node scripts/check-bug-patterns.mjs              # staged files (pre-commit)
 *   node scripts/check-bug-patterns.mjs --base origin/master   # PR diff
 *   node scripts/check-bug-patterns.mjs --all      # entire repo
 *
 * Logic lives in bug-pattern-checks.ts (imported by tests too).
 * This file is the CLI wrapper — it handles file discovery, reads files,
 * and prints results.
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// Inline copies of config + logic from bug-pattern-checks.ts
// (duplicated here so the CLI stays a standalone .mjs with no build step)
// ---------------------------------------------------------------------------

const CHECK_PATHS = {
  'select-star': ['src/', 'scripts/'],
  'publication-id': ['src/app/api/', 'src/lib/'],
  'date-iso': ['src/app/api/', 'src/lib/', 'scripts/'],
}

const PUB_ID_EXCLUDE = ['/api/debug/', 'debug/']

const TENANT_TABLES = [
  'publication_issues',
  'issue_articles',
  'issue_advertisements',
  'publication_settings',
  'rss_feeds',
  'rss_posts',
  'module_articles',
  'ai_applications',
  'advertisements',
  'newsletter_sections',
  'article_modules',
  'issue_article_modules',
  'issue_ai_app_selections',
  'issue_module_ads',
  'issue_prompt_modules',
  'issue_ai_app_modules',
  'issue_ad_modules',
  'issue_poll_modules',
  'ad_modules',
  'poll_modules',
  'prompt_modules',
  'post_ratings',
  'publication_events',
  'issue_events',
  'secondary_articles',
  'tools',
]

function isSuppressed(line, checkId) {
  return line.includes(`bug-check-ignore: ${checkId}`)
}

function appliesToPath(checkId, filePath) {
  const normalized = filePath.replace(/\\/g, '/')
  const patterns = CHECK_PATHS[checkId]
  if (!patterns) return false
  const matches = patterns.some((p) => normalized.includes(p))
  if (!matches) return false
  if (checkId === 'publication-id') {
    const excluded = PUB_ID_EXCLUDE.some((p) => normalized.includes(p))
    if (excluded) return false
  }
  return /\.(ts|tsx)$/.test(normalized)
}

function runSelectStar(content) {
  const lines = content.split('\n')
  const issues = []
  lines.forEach((line, i) => {
    if (isSuppressed(line, 'select-star')) return
    if (/\.select\s*\(\s*['"]\*['"]\s*\)/.test(line)) {
      issues.push({ line: i + 1, message: "Avoid .select('*') — use explicit column lists." })
    }
  })
  return issues
}

function runPublicationId(content) {
  const hasPublicationId = /publication_id|publicationId/.test(content)
  if (hasPublicationId) return []

  const hasTenantQuery = TENANT_TABLES.some(
    (t) => new RegExp(`\\.from\\s*\\(\\s*['\"]${t}['\"]\\s*\\)`).test(content)
  )
  if (!hasTenantQuery) return []

  const lines = content.split('\n')
  const issues = []
  const seenLine = new Set()
  lines.forEach((line, i) => {
    if (isSuppressed(line, 'publication-id')) return
    TENANT_TABLES.forEach((t) => {
      if (new RegExp(`\\.from\\s*\\(\\s*['\"]${t}['\"]\\s*\\)`).test(line) && !seenLine.has(i)) {
        seenLine.add(i)
        issues.push({
          line: i + 1,
          message: `Query on tenant table '${t}' but no publication_id in file.`,
        })
      }
    })
  })
  return issues
}

function runDateIso(content) {
  const lines = content.split('\n')
  const issues = []

  lines.forEach((line, i) => {
    if (isSuppressed(line, 'date-iso')) return

    if (/\.toISOString\s*\(\s*\)\.split\s*\(\s*['"]T['"]\s*\)/.test(line)) {
      issues.push({
        line: i + 1,
        message: "Avoid .toISOString().split('T')[0] — UTC conversion loses timezone. Use local date helpers.",
      })
      return
    }

    if (/\.toISOString\s*\(\s*\)\s*\.\s*(substring|slice)\s*\(\s*0\s*,\s*10\s*\)/.test(line)) {
      issues.push({
        line: i + 1,
        message: 'Avoid .toISOString().substring(0,10) — UTC conversion loses timezone. Use local date helpers.',
      })
      return
    }

    if (/\.toUTCString\s*\(\s*\)/.test(line)) {
      issues.push({
        line: i + 1,
        message: 'Avoid .toUTCString() for date logic — use local date helpers.',
      })
    }
  })
  return issues
}

const RUNNERS = {
  'select-star': runSelectStar,
  'publication-id': runPublicationId,
  'date-iso': runDateIso,
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function getChangedFiles() {
  const baseIdx = process.argv.indexOf('--base')
  const base = baseIdx >= 0 && process.argv[baseIdx + 1]
  const all = process.argv.includes('--all')

  if (all) {
    const out = execSync(
      'git ls-files -- "src/**/*.ts" "src/**/*.tsx" "scripts/**/*.ts"',
      { cwd: ROOT, encoding: 'utf-8' }
    )
    return out.trim().split(/\n/).filter(Boolean)
  }

  if (base) {
    const out = execSync(`git diff --name-only ${base}...HEAD`, { cwd: ROOT, encoding: 'utf-8' })
    return out.trim().split(/\n/).filter(Boolean)
  }

  // default: staged files
  const out = execSync('git diff --name-only --cached', { cwd: ROOT, encoding: 'utf-8' })
  return out.trim().split(/\n/).filter(Boolean)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const files = getChangedFiles()
  if (files.length === 0) {
    console.log('No files to check (no staged diff or no changes).')
    process.exit(0)
  }

  let failed = 0
  const checked = new Set()

  for (const filePath of files) {
    const normalized = filePath.replace(/\\/g, '/')
    for (const [checkId, runner] of Object.entries(RUNNERS)) {
      if (!appliesToPath(checkId, normalized)) continue
      const key = `${filePath}:${checkId}`
      if (checked.has(key)) continue
      checked.add(key)

      const full = path.join(ROOT, filePath)
      if (!fs.existsSync(full)) continue
      const content = fs.readFileSync(full, 'utf-8')

      const issues = runner(content)
      if (issues.length > 0) {
        failed += issues.length
        console.error(`\n${filePath} [${checkId}]:`)
        issues.forEach(({ line, message }) => console.error(`  ${line}: ${message}`))
      }
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} bug-pattern check(s) failed. See docs/checklists/bug-pattern-checks.md.`)
    process.exit(1)
  }

  console.log(`Bug-pattern checks passed (${checked.size} check(s) on ${files.length} file(s)).`)
  process.exit(0)
}

main()
