/**
 * URL Tracking Utilities
 * Wraps URLs with click tracking for newsletter analytics
 */

/**
 * Wraps a URL with click tracking parameters
 * @param url - Destination URL
 * @param section - Newsletter section name
 * @param campaignDate - Campaign date (YYYY-MM-DD)
 * @param campaignId - Optional MailerLite campaign ID
 * @returns Tracking URL that redirects to destination
 */
export function wrapTrackingUrl(
  url: string,
  section: string,
  campaignDate: string,
  campaignId?: string
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://st-cloud-scoop.vercel.app'

  const params = new URLSearchParams({
    url: url,
    section: section,
    date: campaignDate,
    email: '{$email}', // MailerLite variable
  })

  if (campaignId) {
    params.append('campaign_id', campaignId)
  }

  // Add MailerLite subscriber ID if available
  params.append('subscriber_id', '{$subscriber_id}')

  return `${baseUrl}/api/link-tracking/click?${params.toString()}`
}
