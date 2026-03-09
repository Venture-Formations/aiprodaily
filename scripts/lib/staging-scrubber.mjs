#!/usr/bin/env node

/**
 * PII scrubbing for staging database.
 * Anonymizes emails, names, and IP addresses using md5() hashing.
 * Uses @example.com domain (RFC 2606 — reserved, undeliverable).
 */

/**
 * List of scrub operations. Each: { table, description, sql }
 * All SQL uses md5() for deterministic but irreversible replacements.
 */
const SCRUB_OPERATIONS = [
  {
    table: 'afteroffers_click_mappings',
    description: 'Anonymize subscriber emails',
    sql: `UPDATE afteroffers_click_mappings SET email = md5(email) || '@example.com' WHERE email IS NOT NULL AND email NOT LIKE '%@example.com'`,
  },
  {
    table: 'afteroffers_events',
    description: 'Anonymize event emails',
    sql: `UPDATE afteroffers_events SET email = md5(email) || '@example.com' WHERE email IS NOT NULL AND email NOT LIKE '%@example.com'`,
  },
  {
    table: 'subscriber_real_click_status',
    description: 'Anonymize subscriber emails',
    sql: `UPDATE subscriber_real_click_status SET subscriber_email = md5(subscriber_email) || '@example.com' WHERE subscriber_email IS NOT NULL AND subscriber_email NOT LIKE '%@example.com'`,
  },
  {
    table: 'link_clicks',
    description: 'Anonymize IP last two octets',
    sql: `UPDATE link_clicks SET ip_address = regexp_replace(ip_address, '\\.[0-9]+\\.[0-9]+$', '.0.0') WHERE ip_address IS NOT NULL AND ip_address !~ '\\.0\\.0$'`,
  },
  {
    table: 'contact_submissions',
    description: 'Anonymize emails and names',
    sql: `UPDATE contact_submissions SET email = CASE WHEN email IS NOT NULL THEN md5(email) || '@example.com' ELSE email END, name = CASE WHEN name IS NOT NULL THEN 'User ' || left(md5(name), 6) ELSE name END WHERE (email IS NOT NULL AND email NOT LIKE '%@example.com') OR (name IS NOT NULL AND name NOT LIKE 'User %')`,
  },
  {
    table: 'feedback_comments',
    description: 'Anonymize author emails and names',
    sql: `UPDATE feedback_comments SET author_email = CASE WHEN author_email IS NOT NULL THEN md5(author_email) || '@example.com' ELSE author_email END, author_name = CASE WHEN author_name IS NOT NULL THEN 'User ' || left(md5(author_name), 6) ELSE author_name END WHERE (author_email IS NOT NULL AND author_email NOT LIKE '%@example.com') OR (author_name IS NOT NULL AND author_name NOT LIKE 'User %')`,
  },
  {
    table: 'ai_applications',
    description: 'Anonymize submitter info',
    sql: `UPDATE ai_applications SET submitted_by_email = CASE WHEN submitted_by_email IS NOT NULL THEN md5(submitted_by_email) || '@example.com' ELSE submitted_by_email END, submitted_by_name = CASE WHEN submitted_by_name IS NOT NULL THEN 'User ' || left(md5(COALESCE(submitted_by_name, '')), 6) ELSE submitted_by_name END WHERE (submitted_by_email IS NOT NULL AND submitted_by_email NOT LIKE '%@example.com') OR (submitted_by_name IS NOT NULL AND submitted_by_name NOT LIKE 'User %')`,
  },
  {
    table: 'advertisers',
    description: 'Anonymize contact info',
    sql: `UPDATE advertisers SET contact_email = CASE WHEN contact_email IS NOT NULL THEN md5(contact_email) || '@example.com' ELSE contact_email END, contact_name = CASE WHEN contact_name IS NOT NULL THEN 'User ' || left(md5(COALESCE(contact_name, '')), 6) ELSE contact_name END WHERE (contact_email IS NOT NULL AND contact_email NOT LIKE '%@example.com') OR (contact_name IS NOT NULL AND contact_name NOT LIKE 'User %')`,
  },
]

/**
 * Run all PII scrubbing operations. Returns { scrubbed, skipped, details }.
 * @param {string} dbUrl
 * @param {(dbUrl: string, sql: string) => string} runSqlFn — must be synchronous (e.g. execFileSync wrapper)
 */
export function runPiiScrub(dbUrl, runSqlFn) {
  const details = []
  let scrubbed = 0
  let skipped = 0

  for (const op of SCRUB_OPERATIONS) {
    try {
      const result = runSqlFn(dbUrl, op.sql)
      // psql returns "UPDATE N" — extract the count
      const match = result.match(/(\d+)/)
      const count = match ? parseInt(match[1], 10) : 0
      details.push({ table: op.table, description: op.description, rows: count, ok: true })
      scrubbed += count
    } catch (err) {
      // Table may not exist in staging — that's fine, skip it
      const msg = err.message || err.stderr || ''
      if (msg.includes('does not exist') || /relation\s+"?\w+"?\s+does\s+not\s+exist/i.test(msg)) {
        details.push({ table: op.table, description: op.description, rows: 0, ok: true, note: 'table not found' })
        skipped++
      } else {
        details.push({ table: op.table, description: op.description, rows: 0, ok: false, note: msg.slice(0, 100) })
      }
    }
  }

  return { scrubbed, skipped, details }
}

/**
 * Print PII scrubbing report.
 */
export function printScrubReport(scrubResult) {
  const { scrubbed, skipped, details } = scrubResult

  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║                     PII SCRUBBING REPORT                    ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  const tableWidth = 32
  const descWidth = 28
  const rowsWidth = 8

  console.log(
    'Table'.padEnd(tableWidth) +
    'Operation'.padEnd(descWidth) +
    'Rows'.padEnd(rowsWidth) +
    'Status'
  )
  console.log('─'.repeat(tableWidth + descWidth + rowsWidth + 6))

  for (const d of details) {
    const status = d.ok ? '✅' : '❌'
    const note = d.note ? ` (${d.note})` : ''
    console.log(
      d.table.padEnd(tableWidth) +
      d.description.padEnd(descWidth) +
      String(d.rows).padEnd(rowsWidth) +
      status + note
    )
  }

  console.log('─'.repeat(tableWidth + descWidth + rowsWidth + 6))
  console.log(`\nTotal rows scrubbed: ${scrubbed} | Tables skipped: ${skipped}`)
}
