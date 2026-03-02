/**
 * Bug-pattern check logic — pure functions with no side effects.
 * Imported by the CLI script (check-bug-patterns.mjs) and by unit tests.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Path patterns: key = check id, value = path segments to match */
export const CHECK_PATHS: Record<string, string[]> = {
  'select-star': ['src/', 'scripts/'],
  'publication-id': ['src/app/api/', 'src/lib/'],
  'date-iso': ['src/app/api/', 'src/lib/', 'scripts/'],
}

/** Paths excluded from publication-id (e.g. debug routes) */
export const PUB_ID_EXCLUDE = ['/api/debug/', 'debug/']

/** Tenant-scoped table names (queries to these should have publication_id in the file) */
export const TENANT_TABLES = [
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckIssue {
  line: number
  message: string
}

// ---------------------------------------------------------------------------
// Inline suppression
// ---------------------------------------------------------------------------

function isSuppressed(line: string, checkId: string): boolean {
  return line.includes(`bug-check-ignore: ${checkId}`)
}

// ---------------------------------------------------------------------------
// Path matching
// ---------------------------------------------------------------------------

export function appliesToPath(checkId: string, filePath: string): boolean {
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

// ---------------------------------------------------------------------------
// Check: select-star
// ---------------------------------------------------------------------------

export function runSelectStar(content: string): CheckIssue[] {
  const lines = content.split('\n')
  const issues: CheckIssue[] = []
  lines.forEach((line, i) => {
    if (isSuppressed(line, 'select-star')) return
    if (/\.select\s*\(\s*['"]\*['"]\s*\)/.test(line)) {
      issues.push({ line: i + 1, message: "Avoid .select('*') — use explicit column lists." })
    }
  })
  return issues
}

// ---------------------------------------------------------------------------
// Check: publication-id
// ---------------------------------------------------------------------------

export function runPublicationId(content: string): CheckIssue[] {
  const hasPublicationId = /publication_id|publicationId/.test(content)
  if (hasPublicationId) return []

  const hasTenantQuery = TENANT_TABLES.some(
    (t) => new RegExp(`\\.from\\s*\\(\\s*['\"]${t}['\"]\\s*\\)`).test(content)
  )
  if (!hasTenantQuery) return []

  const lines = content.split('\n')
  const issues: CheckIssue[] = []
  const seenLine = new Set<number>()
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

// ---------------------------------------------------------------------------
// Check: date-iso (refined — only flags dangerous patterns)
// ---------------------------------------------------------------------------

export function runDateIso(content: string): CheckIssue[] {
  const lines = content.split('\n')
  const issues: CheckIssue[] = []

  lines.forEach((line, i) => {
    if (isSuppressed(line, 'date-iso')) return

    // Pattern 1: .toISOString().split('T')[0] — UTC date extraction, the actual bug
    if (/\.toISOString\s*\(\s*\)\.split\s*\(\s*['"]T['"]\s*\)/.test(line)) {
      issues.push({
        line: i + 1,
        message: "Avoid .toISOString().split('T')[0] — UTC conversion loses timezone. Use local date helpers.",
      })
      return
    }

    // Pattern 2: .toISOString() used to extract date part via substring/slice
    if (/\.toISOString\s*\(\s*\)\s*\.\s*(substring|slice)\s*\(\s*0\s*,\s*10\s*\)/.test(line)) {
      issues.push({
        line: i + 1,
        message: 'Avoid .toISOString().substring(0,10) — UTC conversion loses timezone. Use local date helpers.',
      })
      return
    }

    // Pattern 3: .toUTCString() — always suspicious in business logic
    if (/\.toUTCString\s*\(\s*\)/.test(line)) {
      issues.push({
        line: i + 1,
        message: 'Avoid .toUTCString() for date logic — use local date helpers.',
      })
    }
  })
  return issues
}

// ---------------------------------------------------------------------------
// Runners map
// ---------------------------------------------------------------------------

export const RUNNERS: Record<string, (content: string) => CheckIssue[]> = {
  'select-star': runSelectStar,
  'publication-id': runPublicationId,
  'date-iso': runDateIso,
}
