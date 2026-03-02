#!/usr/bin/env node
/**
 * Run RSS workflow-related tests only when relevant files changed.
 * See docs/checklists/rss-workflow-tests.md.
 *
 * Usage:
 *   node scripts/run-rss-workflow-tests.mjs              # staged files
 *   node scripts/run-rss-workflow-tests.mjs --base origin/master   # PR diff
 */

import { execSync, spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// Test files that can be run (relative to ROOT)
const ALL_WORKFLOW_TESTS = [
  'src/lib/__tests__/rss-processor-refusal.test.ts',
  'src/lib/__tests__/deduplicator.test.ts',
  'src/lib/dal/__tests__/issues.test.ts',
  'src/lib/__tests__/schedule-checker.test.ts',
  'src/lib/settings/__tests__/schedule-settings.test.ts',
  'src/types/__tests__/issue-states.test.ts',
  'src/lib/__tests__/app-selector.test.ts',
  'src/lib/__tests__/api-handler.test.ts',
]

// Path patterns → test files to run when a file matching the pattern changes
const PATH_GROUPS = [
  {
    patterns: [
      'src/lib/workflows/process-rss-workflow',
      'src/app/api/cron/trigger-workflow',
      'src/app/api/workflows/process-rss',
      'src/app/api/rss/process',
      'src/app/api/rss/steps',
      'src/app/api/rss/combined-steps',
      'src/lib/article-modules',
      'src/lib/ad-modules',
      'src/lib/ad-scheduler',
      'src/lib/prompt-modules',
    ],
    tests: ALL_WORKFLOW_TESTS,
  },
  {
    patterns: [
      'src/app/api/cron/ingest-rss',
      'src/lib/rss-processor',
    ],
    tests: [
      'src/lib/__tests__/rss-processor-refusal.test.ts',
      'src/lib/__tests__/deduplicator.test.ts',
    ],
  },
  {
    patterns: ['src/lib/dal/issues.ts', 'src/lib/dal/'],
    tests: ['src/lib/dal/__tests__/issues.test.ts'],
  },
  {
    patterns: ['src/lib/deduplicator'],
    tests: ['src/lib/__tests__/deduplicator.test.ts'],
  },
  {
    patterns: ['src/lib/settings/'],
    tests: [
      'src/lib/__tests__/schedule-checker.test.ts',
      'src/lib/settings/__tests__/schedule-settings.test.ts',
    ],
  },
  {
    patterns: ['src/lib/ai-app-modules'],
    tests: ALL_WORKFLOW_TESTS,
  },
  {
    patterns: ['src/lib/openai/'],
    tests: ['src/lib/__tests__/rss-processor-refusal.test.ts'],
  },
  {
    patterns: ['src/types/issue-states'],
    tests: ['src/types/__tests__/issue-states.test.ts'],
  },
]

function getChangedFiles() {
  const baseIdx = process.argv.indexOf('--base')
  const base = baseIdx >= 0 && process.argv[baseIdx + 1]

  if (base) {
    const out = execSync(`git diff --name-only ${base}...HEAD`, { cwd: ROOT, encoding: 'utf-8' })
    return out.trim().split(/\n/).filter(Boolean)
  }

  const out = execSync('git diff --name-only --cached', { cwd: ROOT, encoding: 'utf-8' })
  return out.trim().split(/\n/).filter(Boolean)
}

function normalize(p) {
  return p.replace(/\\/g, '/')
}

function main() {
  const files = getChangedFiles()
  if (files.length === 0) {
    console.log('No changed files; skipping RSS workflow tests.')
    process.exit(0)
  }

  const testFilesToRun = new Set()
  for (const filePath of files) {
    const normalized = normalize(filePath)
    for (const group of PATH_GROUPS) {
      const matches = group.patterns.some((p) => normalized.includes(p))
      if (matches) {
        group.tests.forEach((t) => testFilesToRun.add(t))
      }
    }
  }

  if (testFilesToRun.size === 0) {
    console.log('No RSS/workflow-related files changed; skipping RSS workflow tests.')
    process.exit(0)
  }

  const list = [...testFilesToRun]
  console.log(`Running ${list.length} RSS workflow test file(s): ${list.join(', ')}`)
  const result = spawnSync('npx', ['vitest', 'run', '--reporter=dot', ...list], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  })

  if (result.status !== 0) {
    process.exit(result.status)
  }
  console.log('RSS workflow tests passed.')
  process.exit(0)
}

main()
