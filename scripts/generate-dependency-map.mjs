#!/usr/bin/env node

/**
 * Dependency Map Generator
 *
 * Statically analyzes the codebase to produce docs/architecture/DEPENDENCY_MAP.md
 * showing how crons, API routes, lib modules, and database tables connect.
 *
 * Usage: node scripts/generate-dependency-map.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

// ─── Helpers ──────────────────────────────────────────────────────────────

function walkDir(dir, ext = '.ts') {
  const results = []
  if (!fs.existsSync(dir)) return results
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(full, ext))
    } else if (entry.name.endsWith(ext) || entry.name.endsWith('.tsx')) {
      results.push(full)
    }
  }
  return results
}

function toRelative(absPath) {
  return path.relative(ROOT, absPath).replace(/\\/g, '/')
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

// ─── Extractors ───────────────────────────────────────────────────────────

/** Extract import paths from a TS/TSX file */
function extractImports(content) {
  const imports = []
  // Match: import ... from '...' and import ... from "..."
  const re = /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(content)) !== null) {
    imports.push(m[1])
  }
  // Match: await import('...')  and require('...')
  const dynRe = /(?:await\s+import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((m = dynRe.exec(content)) !== null) {
    imports.push(m[1])
  }
  return imports
}

/** Extract Supabase table names from .from('table') patterns */
function extractTables(content) {
  const tables = new Set()
  const re = /\.from\(\s*['"]([a-z_]+)['"]\s*\)/g
  let m
  while ((m = re.exec(content)) !== null) {
    tables.add(m[1])
  }
  return [...tables]
}

/** Extract exported functions/classes/constants */
function extractExports(content) {
  const exports = []
  // export function/class/const/type/interface
  const re = /export\s+(?:async\s+)?(?:function|class|const|let|type|interface|enum)\s+(\w+)/g
  let m
  while ((m = re.exec(content)) !== null) {
    exports.push(m[1])
  }
  // export default class/function Name
  const defRe = /export\s+default\s+(?:async\s+)?(?:function|class)\s+(\w+)/g
  while ((m = defRe.exec(content)) !== null) {
    exports.push(m[1])
  }
  return exports
}

/** Extract fetch/API call patterns from dashboard/page files */
function extractApiCalls(content) {
  const calls = []
  // fetch('/api/...')  or fetch(`/api/...`)
  const re = /fetch\(\s*[`'"]([^`'"]*\/api\/[^`'"]*)[`'"]/g
  let m
  while ((m = re.exec(content)) !== null) {
    calls.push(m[1])
  }
  return calls
}

/** Resolve @/lib/... to actual relative path */
function resolveLibImport(importPath) {
  if (importPath.startsWith('@/')) {
    return 'src/' + importPath.slice(2)
  }
  return null
}

// ─── Scanners ─────────────────────────────────────────────────────────────

function scanCrons() {
  const vercelJson = JSON.parse(readFile(path.join(ROOT, 'vercel.json')))
  return (vercelJson.crons || []).map(c => ({
    path: c.path,
    schedule: c.schedule,
    routeFile: `src/app${c.path}/route.ts`
  }))
}

function scanFile(filePath) {
  const content = readFile(filePath)
  const relPath = toRelative(filePath)
  const imports = extractImports(content)
  const tables = extractTables(content)
  const exports = extractExports(content)
  const apiCalls = extractApiCalls(content)

  // Categorize imports
  const libImports = []
  const otherImports = []
  for (const imp of imports) {
    const resolved = resolveLibImport(imp)
    if (resolved && resolved.startsWith('src/lib')) {
      libImports.push(resolved)
    } else if (imp.startsWith('@/')) {
      otherImports.push('src/' + imp.slice(2))
    } else if (imp.startsWith('./') || imp.startsWith('../')) {
      // Resolve relative to file's directory
      const dir = path.dirname(filePath)
      const resolved = path.resolve(dir, imp)
      otherImports.push(toRelative(resolved))
    }
  }

  return { relPath, libImports, otherImports, tables, exports, apiCalls }
}

function scanDirectory(dir) {
  const files = walkDir(dir)
  return files.map(f => scanFile(f))
}

// ─── Analysis ─────────────────────────────────────────────────────────────

function buildDependencyData() {
  // 1. Cron definitions
  const crons = scanCrons()

  // 2. Scan API routes
  const apiDir = path.join(ROOT, 'src', 'app', 'api')
  const apiFiles = scanDirectory(apiDir)

  // 3. Scan lib files
  const libDir = path.join(ROOT, 'src', 'lib')
  const libFiles = scanDirectory(libDir)

  // 4. Scan dashboard pages
  const dashDir = path.join(ROOT, 'src', 'app', 'dashboard')
  const dashFiles = scanDirectory(dashDir)

  // 5. Scan workflow files
  const workflowDir = path.join(ROOT, 'src', 'lib', 'workflows')
  const workflowFiles = fs.existsSync(workflowDir) ? scanDirectory(workflowDir) : []

  // 6. Scan public app pages (tools, account, website, events)
  const publicDirs = ['tools', 'account', 'website', 'events'].map(d =>
    path.join(ROOT, 'src', 'app', d)
  )
  const publicFiles = publicDirs.flatMap(d => fs.existsSync(d) ? scanDirectory(d) : [])

  return { crons, apiFiles, libFiles, dashFiles, workflowFiles, publicFiles }
}

function buildReverseIndexes(data) {
  const { apiFiles, libFiles, dashFiles, publicFiles } = data

  // Table reverse index: table -> files that reference it
  const tableIndex = {}
  const allFiles = [...apiFiles, ...libFiles, ...dashFiles, ...publicFiles]
  for (const file of allFiles) {
    for (const table of file.tables) {
      if (!tableIndex[table]) tableIndex[table] = []
      tableIndex[table].push(file.relPath)
    }
  }

  // Lib module reverse index: lib module -> files that import it
  const libIndex = {}
  for (const file of [...apiFiles, ...dashFiles, ...publicFiles]) {
    for (const libImp of file.libImports) {
      // Normalize: strip index suffix
      const normalized = libImp.replace(/\/index$/, '')
      if (!libIndex[normalized]) libIndex[normalized] = []
      libIndex[normalized].push(file.relPath)
    }
  }

  // Also add lib-to-lib dependencies
  for (const file of libFiles) {
    for (const libImp of file.libImports) {
      const normalized = libImp.replace(/\/index$/, '')
      if (normalized !== file.relPath.replace(/\/index\.ts$/, '').replace(/\.ts$/, '')) {
        if (!libIndex[normalized]) libIndex[normalized] = []
        libIndex[normalized].push(file.relPath)
      }
    }
  }

  return { tableIndex, libIndex }
}

// ─── Output Generation ──────────────────────────────────────────────────

function formatSchedule(schedule) {
  const map = {
    '*/5 * * * *': 'every 5 min',
    '*/15 * * * *': 'every 15 min',
    '0 */2 * * *': 'every 2 hours',
    '*/5 8-22 * * *': 'every 5 min (8AM-10PM)',
    '0 7 * * *': 'daily 7:00 UTC',
    '0 6 * * *': 'daily 6:00 UTC',
    '0 3 * * *': 'daily 3:00 UTC',
    '0 */3 * * *': 'every 3 hours',
  }
  return map[schedule] || schedule
}

function generateMarkdown(data, indexes) {
  const { crons, apiFiles, libFiles, dashFiles, publicFiles } = data
  const { tableIndex, libIndex } = indexes

  const lines = []
  const now = new Date().toISOString().split('T')[0]

  lines.push('# Dependency Map')
  lines.push('')
  lines.push(`> Auto-generated by \`npm run generate:dep-map\` on ${now}`)
  lines.push('> Do not edit manually. Regenerate after code changes.')
  lines.push('')

  // ── Section 1: Cron Dependency Chains ──
  lines.push('## 1. Cron Jobs')
  lines.push('')
  lines.push('| Cron | Schedule | Route File | Lib Imports | Tables |')
  lines.push('|------|----------|-----------|-------------|--------|')

  for (const cron of crons) {
    const routeData = apiFiles.find(f => f.relPath === cron.routeFile)
    const name = cron.path.split('/').pop()
    const schedule = formatSchedule(cron.schedule)
    const libImps = routeData
      ? routeData.libImports.map(i => `\`${i.replace('src/lib/', '')}\``).join(', ') || '-'
      : '-'
    const tables = routeData
      ? routeData.tables.map(t => `\`${t}\``).join(', ') || '-'
      : '-'
    const routeFile = routeData ? `\`${cron.routeFile}\`` : '(not found)'
    lines.push(`| **${name}** | ${schedule} | ${routeFile} | ${libImps} | ${tables} |`)
  }
  lines.push('')

  // ── Section 2: Cron Detail (expanded chains) ──
  lines.push('### Cron Detail')
  lines.push('')
  for (const cron of crons) {
    const routeData = apiFiles.find(f => f.relPath === cron.routeFile)
    if (!routeData) continue
    const name = cron.path.split('/').pop()
    lines.push(`#### ${name}`)
    lines.push(`- **Schedule:** ${formatSchedule(cron.schedule)}`)
    lines.push(`- **Route:** \`${cron.routeFile}\``)

    if (routeData.libImports.length > 0) {
      lines.push('- **Lib dependencies:**')
      for (const lib of routeData.libImports) {
        // Find what that lib file itself imports and what tables it touches
        const libData = libFiles.find(f => {
          const normalized = f.relPath.replace(/\.tsx?$/, '').replace(/\/index$/, '')
          const libNorm = lib.replace(/\/index$/, '')
          return normalized === libNorm || f.relPath.startsWith(lib)
        })
        if (libData) {
          const subTables = libData.tables.length > 0
            ? ` (tables: ${libData.tables.map(t => `\`${t}\``).join(', ')})`
            : ''
          lines.push(`  - \`${lib}\`${subTables}`)
        } else {
          lines.push(`  - \`${lib}\``)
        }
      }
    }

    if (routeData.tables.length > 0) {
      lines.push(`- **Direct tables:** ${routeData.tables.map(t => `\`${t}\``).join(', ')}`)
    }
    lines.push('')
  }

  // ── Section 3: API Routes (non-cron) ──
  lines.push('## 2. API Routes')
  lines.push('')
  lines.push('| Route | Lib Imports | Tables |')
  lines.push('|-------|-------------|--------|')

  const nonCronApis = apiFiles.filter(f => !f.relPath.includes('/api/cron/'))
  // Group by route group
  const routeGroups = {}
  for (const file of nonCronApis) {
    // Extract route path: src/app/api/foo/bar/route.ts -> /api/foo/bar
    const routePath = file.relPath
      .replace('src/app', '')
      .replace('/route.ts', '')
      .replace('/route.tsx', '')
    const group = routePath.split('/').slice(0, 3).join('/')
    if (!routeGroups[group]) routeGroups[group] = []
    routeGroups[group].push({ ...file, routePath })
  }

  for (const [group, routes] of Object.entries(routeGroups).sort()) {
    for (const route of routes) {
      const libImps = route.libImports.map(i => `\`${i.replace('src/lib/', '')}\``).join(', ') || '-'
      const tables = route.tables.map(t => `\`${t}\``).join(', ') || '-'
      lines.push(`| \`${route.routePath}\` | ${libImps} | ${tables} |`)
    }
  }
  lines.push('')

  // ── Section 4: Reverse Index by Table ──
  lines.push('## 3. Reverse Index: Tables')
  lines.push('')
  lines.push('Which files reference each database table.')
  lines.push('')

  const sortedTables = Object.entries(tableIndex).sort((a, b) => b[1].length - a[1].length)
  for (const [table, files] of sortedTables) {
    const uniqueFiles = [...new Set(files)]
    lines.push(`### \`${table}\` (${uniqueFiles.length} files)`)
    for (const f of uniqueFiles.sort()) {
      // Categorize
      let prefix = ''
      if (f.includes('/api/cron/')) prefix = '[cron] '
      else if (f.includes('/api/')) prefix = '[api] '
      else if (f.includes('/dashboard/')) prefix = '[dash] '
      else if (f.startsWith('src/lib/')) prefix = '[lib] '
      else prefix = '[page] '
      lines.push(`- ${prefix}\`${f}\``)
    }
    lines.push('')
  }

  // ── Section 5: Reverse Index by Lib Module ──
  lines.push('## 4. Reverse Index: Lib Modules')
  lines.push('')
  lines.push('Which files import each lib module. Use this for impact analysis.')
  lines.push('')

  const sortedLibs = Object.entries(libIndex).sort((a, b) => b[1].length - a[1].length)
  for (const [lib, files] of sortedLibs) {
    const uniqueFiles = [...new Set(files)]
    const shortName = lib.replace('src/lib/', '')
    lines.push(`### \`${shortName}\` (${uniqueFiles.length} dependents)`)
    for (const f of uniqueFiles.sort()) {
      let prefix = ''
      if (f.includes('/api/cron/')) prefix = '[cron] '
      else if (f.includes('/api/')) prefix = '[api] '
      else if (f.includes('/dashboard/')) prefix = '[dash] '
      else if (f.startsWith('src/lib/')) prefix = '[lib] '
      else prefix = '[page] '
      lines.push(`- ${prefix}\`${f}\``)
    }
    lines.push('')
  }

  // ── Section 6: High-Connectivity Files ──
  lines.push('## 5. High-Connectivity Files (Change with Caution)')
  lines.push('')
  lines.push('Files with the most dependents. Changes here have the widest blast radius.')
  lines.push('')
  lines.push('| Lib Module | Dependents | Tables Touched |')
  lines.push('|-----------|-----------|----------------|')

  const connectivity = []
  for (const [lib, files] of sortedLibs) {
    const uniqueFiles = [...new Set(files)]
    // Find tables for this lib
    const libData = libFiles.find(f => {
      const normalized = f.relPath.replace(/\.tsx?$/, '').replace(/\/index$/, '')
      return normalized === lib.replace(/\/index$/, '') || f.relPath === lib + '.ts'
    })
    const tables = libData ? libData.tables : []
    connectivity.push({
      lib: lib.replace('src/lib/', ''),
      dependents: uniqueFiles.length,
      tables
    })
  }

  connectivity.sort((a, b) => b.dependents - a.dependents)
  for (const item of connectivity.slice(0, 20)) {
    const tableStr = item.tables.length > 0
      ? item.tables.map(t => `\`${t}\``).join(', ')
      : '-'
    lines.push(`| \`${item.lib}\` | ${item.dependents} | ${tableStr} |`)
  }
  lines.push('')

  // ── Section 7: Dashboard/Page Dependencies ──
  lines.push('## 6. Dashboard & Page Dependencies')
  lines.push('')
  const allPageFiles = [...dashFiles, ...publicFiles].filter(f =>
    f.libImports.length > 0 || f.tables.length > 0 || f.apiCalls.length > 0
  )

  if (allPageFiles.length > 0) {
    lines.push('| Page | Lib Imports | Tables | API Calls |')
    lines.push('|------|-----------|--------|-----------|')
    for (const page of allPageFiles) {
      const libImps = page.libImports.map(i => `\`${i.replace('src/lib/', '')}\``).join(', ') || '-'
      const tables = page.tables.map(t => `\`${t}\``).join(', ') || '-'
      const apis = page.apiCalls.map(a => `\`${a}\``).join(', ') || '-'
      lines.push(`| \`${page.relPath}\` | ${libImps} | ${tables} | ${apis} |`)
    }
  } else {
    lines.push('(Dashboard pages primarily use API routes via client-side fetch)')
  }
  lines.push('')

  // ── Section 8: Statistics ──
  lines.push('## 7. Statistics')
  lines.push('')
  lines.push(`| Metric | Count |`)
  lines.push(`|--------|-------|`)
  lines.push(`| Cron jobs | ${crons.length} |`)
  lines.push(`| API route files | ${apiFiles.length} |`)
  lines.push(`| Lib files | ${libFiles.length} |`)
  lines.push(`| Dashboard/page files | ${dashFiles.length + publicFiles.length} |`)
  lines.push(`| Database tables referenced | ${Object.keys(tableIndex).length} |`)
  lines.push(`| Lib modules with dependents | ${Object.keys(libIndex).length} |`)
  lines.push('')

  return lines.join('\n')
}

// ─── Main ─────────────────────────────────────────────────────────────────

function main() {
  console.log('Scanning codebase...')

  const data = buildDependencyData()
  console.log(`  Found ${data.crons.length} crons, ${data.apiFiles.length} API files, ${data.libFiles.length} lib files`)

  const indexes = buildReverseIndexes(data)
  console.log(`  Found ${Object.keys(indexes.tableIndex).length} tables, ${Object.keys(indexes.libIndex).length} lib modules`)

  const markdown = generateMarkdown(data, indexes)

  const outPath = path.join(ROOT, 'docs', 'architecture', 'DEPENDENCY_MAP.md')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, markdown, 'utf-8')

  console.log(`\nDependency map written to: docs/architecture/DEPENDENCY_MAP.md`)
  console.log(`  ${markdown.split('\n').length} lines`)
}

main()
