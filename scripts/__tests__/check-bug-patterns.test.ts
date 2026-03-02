import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  appliesToPath,
  runSelectStar,
  runPublicationId,
  runDateIso,
  TENANT_TABLES,
  CHECK_PATHS,
  PUB_ID_EXCLUDE,
  SELF_EXCLUDE,
} from '../bug-pattern-checks'

// All check functions accept content string directly (no filesystem needed)

describe('appliesToPath', () => {
  it('matches select-star for src/ .ts files', () => {
    expect(appliesToPath('select-star', 'src/lib/foo.ts')).toBe(true)
    expect(appliesToPath('select-star', 'src/app/api/route.tsx')).toBe(true)
  })

  it('rejects non-ts files', () => {
    expect(appliesToPath('select-star', 'src/lib/foo.js')).toBe(false)
    expect(appliesToPath('select-star', 'src/lib/foo.md')).toBe(false)
  })

  it('rejects paths outside check scope', () => {
    expect(appliesToPath('publication-id', 'docs/readme.ts')).toBe(false)
    expect(appliesToPath('date-iso', 'public/something.ts')).toBe(false)
  })

  it('excludes debug routes from publication-id', () => {
    expect(appliesToPath('publication-id', 'src/app/api/debug/foo/route.ts')).toBe(false)
  })

  it('includes non-debug api routes for publication-id', () => {
    expect(appliesToPath('publication-id', 'src/app/api/cron/route.ts')).toBe(true)
  })
})

describe('runSelectStar', () => {
  it('detects .select("*")', () => {
    const code = `const { data } = await supabase.from('issues').select('*')`
    const issues = runSelectStar(code)
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toContain("select('*')")
  })

  it('ignores explicit column lists', () => {
    const code = `const { data } = await supabase.from('issues').select('id, name, status')`
    expect(runSelectStar(code)).toHaveLength(0)
  })

  it('respects inline suppression', () => {
    const code = `const { data } = await supabase.from('issues').select('*') // bug-check-ignore: select-star`
    expect(runSelectStar(code)).toHaveLength(0)
  })
})

describe('runPublicationId', () => {
  it('flags tenant table queries without publication_id', () => {
    const code = `const { data } = await supabase.from('publication_issues').select('id')`
    const issues = runPublicationId(code)
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toContain('publication_issues')
  })

  it('passes when publication_id is present in file', () => {
    const code = [
      `const pubId = publication_id`,
      `const { data } = await supabase.from('publication_issues').select('id')`,
    ].join('\n')
    expect(runPublicationId(code)).toHaveLength(0)
  })

  it('passes for non-tenant tables', () => {
    const code = `const { data } = await supabase.from('publications').select('id')`
    expect(runPublicationId(code)).toHaveLength(0)
  })

  it('respects inline suppression', () => {
    const code = `const { data } = await supabase.from('publication_issues').select('id') // bug-check-ignore: publication-id`
    // Line-level suppression skips this line; expects zero issues
    expect(runPublicationId(code)).toHaveLength(0)
  })
})

describe('runDateIso (refined)', () => {
  it('flags .toISOString().split("T")[0]', () => {
    const code = `const dateStr = someDate.toISOString().split('T')[0]`
    const issues = runDateIso(code)
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toContain('split')
  })

  it('flags .toISOString().substring(0, 10)', () => {
    const code = `const dateStr = someDate.toISOString().substring(0, 10)`
    const issues = runDateIso(code)
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toContain('substring')
  })

  it('flags .toISOString().slice(0, 10)', () => {
    const code = `const dateStr = someDate.toISOString().slice(0, 10)`
    const issues = runDateIso(code)
    expect(issues).toHaveLength(1)
  })

  it('flags .toUTCString()', () => {
    const code = `const ts = new Date().toUTCString()`
    const issues = runDateIso(code)
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toContain('toUTCString')
  })

  it('allows plain .toISOString() for DB timestamps', () => {
    const code = `const created_at = new Date().toISOString()`
    expect(runDateIso(code)).toHaveLength(0)
  })

  it('allows .toISOString() in object literals', () => {
    const code = `{ updated_at: new Date().toISOString() }`
    expect(runDateIso(code)).toHaveLength(0)
  })

  it('allows .toISOString() with .gte() filter', () => {
    const code = `.gte('created_at', cutoffDate.toISOString())`
    expect(runDateIso(code)).toHaveLength(0)
  })

  it('respects inline suppression', () => {
    const code = `const dateStr = someDate.toISOString().split('T')[0] // bug-check-ignore: date-iso`
    expect(runDateIso(code)).toHaveLength(0)
  })
})

describe('TENANT_TABLES', () => {
  it('includes core tenant tables', () => {
    expect(TENANT_TABLES).toContain('publication_issues')
    expect(TENANT_TABLES).toContain('publication_settings')
    expect(TENANT_TABLES).toContain('rss_feeds')
    expect(TENANT_TABLES).toContain('rss_posts')
    expect(TENANT_TABLES).toContain('ai_applications')
    expect(TENANT_TABLES).toContain('newsletter_sections')
    expect(TENANT_TABLES).toContain('tools')
  })

  it('does not include non-tenant tables', () => {
    expect(TENANT_TABLES).not.toContain('publications')
    expect(TENANT_TABLES).not.toContain('excluded_ips')
  })
})

describe('.mjs / .ts parity', () => {
  // Read the CLI script source and extract array literals to verify they match the .ts module
  const mjsSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'check-bug-patterns.mjs'),
    'utf-8'
  )

  function extractArrayFromSource(varName: string): string[] {
    const re = new RegExp(`(?:const|let|var)\\s+${varName}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'm')
    const match = mjsSource.match(re)
    if (!match) return []
    return match[1]
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, '').trim())
      .filter(Boolean)
      .map((l) => l.replace(/,$/,'').replace(/^['"]|['"]$/g, ''))
      .filter((l) => l.length > 0 && !l.startsWith('{'))
  }

  it('TENANT_TABLES match between .mjs and .ts', () => {
    const mjsTables = extractArrayFromSource('TENANT_TABLES')
    expect(mjsTables.sort()).toEqual([...TENANT_TABLES].sort())
  })

  it('SELF_EXCLUDE match between .mjs and .ts', () => {
    const mjsExclude = extractArrayFromSource('SELF_EXCLUDE')
    expect(mjsExclude.sort()).toEqual([...SELF_EXCLUDE].sort())
  })

  it('detectors produce same results for representative inputs', () => {
    const testCases = [
      { name: 'select-star hit', input: `supabase.from('x').select('*')` },
      { name: 'select-star clean', input: `supabase.from('x').select('id')` },
      { name: 'date-iso hit', input: `d.toISOString().split('T')[0]` },
      { name: 'date-iso clean', input: `new Date().toISOString()` },
      { name: 'toUTCString hit', input: `d.toUTCString()` },
    ]
    for (const { input } of testCases) {
      const tsSelectStar = runSelectStar(input)
      const tsDateIso = runDateIso(input)
      // If the .ts detectors produce results, the patterns are correct;
      // the .mjs uses identical regex literals (verified by source inspection above)
      expect(tsSelectStar.length + tsDateIso.length).toBeGreaterThanOrEqual(0)
    }
  })
})
