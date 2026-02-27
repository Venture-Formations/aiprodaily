/**
 * URL Tracking Utilities
 * Wraps URLs with click tracking for newsletter analytics
 */

/**
 * Link types for MailerLite field updates
 * - 'ad': Updates clicked_ad field
 * - 'ai_app': Updates clicked_ai_app field
 */
export type LinkType = 'ad' | 'ai_app'

/**
 * Wraps a URL with click tracking parameters
 * @param url - Destination URL
 * @param section - Newsletter section name
 * @param issueDate - issue date (YYYY-MM-DD)
 * @param mailerliteIssueId - Optional MailerLite campaign ID
 * @param dbIssueId - Optional database issue ID (for MailerLite field updates)
 * @param linkType - Optional link type for field updates ('ad' | 'ai_app')
 * @param pubBaseUrl - Optional per-publication base URL (from businessSettings.websiteUrl)
 * @returns Tracking URL that redirects to destination
 */
export function wrapTrackingUrl(
  url: string,
  section: string,
  issueDate: string,
  mailerliteIssueId?: string,
  dbIssueId?: string,
  linkType?: LinkType,
  pubBaseUrl?: string
): string {
  const baseUrl = pubBaseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://www.aiaccountingdaily.com'

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

  // Add link type for MailerLite field updates
  if (linkType) {
    params.append('type', linkType)
  }

  // Add MailerLite subscriber ID if available
  params.append('subscriber_id', '{$subscriber_id}')

  return `${baseUrl}/api/link-tracking/click?${params.toString()}`
}
