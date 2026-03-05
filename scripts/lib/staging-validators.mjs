#!/usr/bin/env node

/**
 * Integrity validation checks for staging database after refresh.
 */

/**
 * Run all validation checks. Returns { passed, failed, results }.
 * Each result: { name, expected, actual, ok }
 */
export async function runValidations(dbUrl, runSqlFn) {
  const results = []

  function check(name, sql, expectFn, expectedLabel) {
    let actual
    try {
      actual = runSqlFn(dbUrl, sql)
    } catch (err) {
      results.push({ name, expected: expectedLabel, actual: `ERROR: ${err.message}`, ok: false })
      return
    }
    const ok = expectFn(actual)
    results.push({ name, expected: expectedLabel, actual, ok })
  }

  // FK constraint count
  check(
    'FK constraints',
    `SELECT count(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'`,
    v => parseInt(v, 10) >= 40,
    '>= 40'
  )

  // Primary keys on critical tables
  const criticalTables = [
    'publications', 'publication_issues', 'publication_settings',
    'ad_modules', 'ai_app_modules', 'article_modules', 'prompt_modules',
    'poll_modules', 'feedback_modules', 'text_box_modules',
    'newsletter_sections', 'ai_applications', 'rss_feeds', 'rss_posts',
    'advertisers', 'advertisements'
  ]

  for (const table of criticalTables) {
    check(
      `PK: ${table}`,
      `SELECT count(*) FROM information_schema.table_constraints WHERE constraint_type = 'PRIMARY KEY' AND table_schema = 'public' AND table_name = '${table}'`,
      v => parseInt(v, 10) === 1,
      '1'
    )
  }

  // Orphaned issue_advertisements
  check(
    'Orphaned issue_advertisements',
    `SELECT count(*) FROM issue_advertisements ia WHERE NOT EXISTS (SELECT 1 FROM publication_issues pi WHERE pi.id = ia.issue_id)`,
    v => parseInt(v, 10) === 0,
    '0'
  )

  // Orphaned issue_ai_app_modules
  check(
    'Orphaned issue_ai_app_modules',
    `SELECT count(*) FROM issue_ai_app_modules iam WHERE NOT EXISTS (SELECT 1 FROM publication_issues pi WHERE pi.id = iam.issue_id)`,
    v => parseInt(v, 10) === 0,
    '0'
  )

  // Orphaned issue_module_ads
  check(
    'Orphaned issue_module_ads',
    `SELECT count(*) FROM issue_module_ads ima WHERE NOT EXISTS (SELECT 1 FROM publication_issues pi WHERE pi.id = ima.issue_id)`,
    v => parseInt(v, 10) === 0,
    '0'
  )

  // Row counts for critical tables (must have > 0 rows)
  const nonEmptyTables = [
    'publications', 'ad_modules', 'ai_app_modules', 'article_modules',
    'prompt_modules', 'newsletter_sections', 'rss_feeds'
  ]

  for (const table of nonEmptyTables) {
    check(
      `Rows: ${table}`,
      `SELECT count(*) FROM ${table}`,
      v => parseInt(v, 10) > 0,
      '> 0'
    )
  }

  // Stale newsletters table must NOT exist
  check(
    'No stale newsletters table',
    `SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'newsletters'`,
    v => parseInt(v, 10) === 0,
    '0 (must not exist)'
  )

  // ad_modules.next_position column exists
  check(
    'ad_modules.next_position column',
    `SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ad_modules' AND column_name = 'next_position'`,
    v => parseInt(v, 10) === 1,
    '1'
  )

  const passed = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length

  return { passed, failed, results }
}

/**
 * Print validation results as a formatted table.
 */
export function printValidationReport(validationResult) {
  const { passed, failed, results } = validationResult

  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║                  INTEGRITY VALIDATION REPORT                ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  const nameWidth = 36
  const expectedWidth = 18
  const actualWidth = 12

  console.log(
    'Check'.padEnd(nameWidth) +
    'Expected'.padEnd(expectedWidth) +
    'Actual'.padEnd(actualWidth) +
    'Status'
  )
  console.log('─'.repeat(nameWidth + expectedWidth + actualWidth + 6))

  for (const r of results) {
    const status = r.ok ? '✅' : '❌'
    console.log(
      r.name.padEnd(nameWidth) +
      String(r.expected).padEnd(expectedWidth) +
      String(r.actual).padEnd(actualWidth) +
      status
    )
  }

  console.log('─'.repeat(nameWidth + expectedWidth + actualWidth + 6))
  console.log(`\nTotal: ${passed} passed, ${failed} failed out of ${results.length} checks`)

  return { passed, failed }
}
