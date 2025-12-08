/**
 * URL Tracking Utilities
 * Wraps URLs with click tracking for newsletter analytics
 */

/**
 * Wraps a URL with click tracking parameters
 * @param url - Destination URL
 * @param section - Newsletter section name
 * @param issueDate - issue date (YYYY-MM-DD)
 * @param mailerliteIssueId - Optional MailerLite campaign ID
 * @param dbIssueId - Optional database issue ID (for MailerLite field updates)
 * @returns Tracking URL that redirects to destination
 */
export function wrapTrackingUrl(
  url: string,
  section: string,
  issueDate: string,
  mailerliteIssueId?: string,
  dbIssueId?: string
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.aiaccountingdaily.com'

  const params = new URLSearchParams({
    url: url,
    section: section,
    date: issueDate,
    email: '{$email}', // MailerLite variable
  })

  if (mailerliteIssueId) {
    params.append('mailerlite_id', mailerliteIssueId)
  }

  // Add database issue ID for MailerLite field updates
  if (dbIssueId) {
    params.append('issue_id', dbIssueId)
  }

  // Add MailerLite subscriber ID if available
  params.append('subscriber_id', '{$subscriber_id}')

  return `${baseUrl}/api/link-tracking/click?${params.toString()}`
}
