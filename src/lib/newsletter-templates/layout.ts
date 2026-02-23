// Newsletter envelope: header and footer

import { supabaseAdmin } from '../supabase'
import { wrapTrackingUrl } from '../url-tracking'
import { HONEYPOT_CONFIG } from '../bot-detection'
import { STORAGE_PUBLIC_URL } from '../config'
import { getBusinessSettings as getPublicationBusinessSettings } from '../publication-settings'

// ==================== HEADER ====================

export async function generateNewsletterHeader(formattedDate: string, issueDate?: string, issueId?: string, publication_id?: string): Promise<string> {
  // Fetch business settings for header image, primary color, and website URL
  let headerImageUrl = '' // Must be set via publication_business_settings.header_image_url
  let primaryColor = '#1877F2'
  let newsletterName = 'St. Cloud Scoop'
  let websiteUrl = 'https://www.aiaccountingdaily.com'

  if (publication_id) {
    const settings = await getPublicationBusinessSettings(publication_id)
    headerImageUrl = settings.header_image_url || headerImageUrl
    primaryColor = settings.primary_color || primaryColor
    newsletterName = settings.newsletter_name || newsletterName
    websiteUrl = settings.website_url || websiteUrl
  } else {
    // Fallback to old behavior (logs warning so we know what to update)
    console.warn('[SETTINGS] generateNewsletterHeader called without publication_id - update caller')
    const { data: settingsData } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', ['header_image_url', 'primary_color', 'newsletter_name', 'website_url'])

    const settingsMap: Record<string, string> = {}
    settingsData?.forEach(setting => {
      settingsMap[setting.key] = setting.value
    })

    headerImageUrl = settingsMap.header_image_url || headerImageUrl
    primaryColor = settingsMap.primary_color || primaryColor
    newsletterName = settingsMap.newsletter_name || newsletterName
    websiteUrl = settingsMap.website_url || websiteUrl
  }

  // Add tracking to Sign Up link if issue info available
  const signUpUrl = issueDate
    ? wrapTrackingUrl(websiteUrl, 'Header', issueDate, issueId)
    : websiteUrl

  return `<html style="margin:0;padding:0;background-color:#f7f7f7;">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <style>
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #f7f7f7;
      width: 100% !important;
      min-width: 100% !important;
    }
  </style>

</head>

<body style="margin:0!important;padding:0!important;background-color:#f7f7f7;">

  <div class="email-wrapper" style="width:100%;margin:0 auto;padding:10px;background-color:#f7f7f7;box-sizing:border-box;">

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
      <tr>
        <td style="font-weight:bold;font-family:Arial,sans-serif;padding:5px 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td width="10">&nbsp;</td>
              <td align="right">
                <a href="{$weblink}" style="color:#000;text-decoration:underline;">View Online</a>&nbsp;|&nbsp;
                <a href="${signUpUrl}" style="color:#000;text-decoration:underline;">Sign Up</a>&nbsp;|&nbsp;
                <a href="{$forward}" style="color:#000;text-decoration:underline;">Share</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="width:100%;max-width:750px;margin:0 auto;padding:0;">

      <!-- HEADER BANNER -->
      <table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;">
        <tr>
          <td align="center" style="padding:0;background:${primaryColor};border-radius:10px;">
            ${headerImageUrl ? `<img alt="${newsletterName}" src="${headerImageUrl}" style="display:block;width:100%;max-width:500px;height:auto;margin:0 auto;" />` : `<div style="padding:20px 0;color:#fff;font-size:24px;font-weight:bold;">${newsletterName}</div>`}
          </td>
        </tr>
      </table>

      <!-- DATE BELOW HEADER -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
        <tr>
          <td align="center" style="padding:5px 0;font-family:Arial,sans-serif;font-weight:bold;font-size:16px;color:#1C293D;text-align:center;">
            ${formattedDate}
          </td>
        </tr>
      </table>

    </div>

<br>`
}

// ==================== FOOTER ====================

export async function generateNewsletterFooter(issueDate?: string, issueId?: string, publication_id?: string): Promise<string> {
  // Fetch business settings for primary color, newsletter name, business name, and social media settings
  let settingsMap: Record<string, string> = {}

  if (publication_id) {
    const { data: settings } = await supabaseAdmin
      .from('publication_settings')
      .select('key, value')
      .eq('publication_id', publication_id)
      .in('key', [
        'primary_color', 'newsletter_name', 'business_name', 'website_url',
        'facebook_enabled', 'facebook_url',
        'twitter_enabled', 'twitter_url',
        'linkedin_enabled', 'linkedin_url',
        'instagram_enabled', 'instagram_url'
      ])

    settings?.forEach(setting => {
      // Strip extra quotes if value was JSON stringified (e.g., '"true"' -> 'true')
      let cleanValue = setting.value
      if (cleanValue && cleanValue.startsWith('"') && cleanValue.endsWith('"') && cleanValue.length > 2) {
        cleanValue = cleanValue.slice(1, -1)
      }
      settingsMap[setting.key] = cleanValue
    })
  } else {
    // Fallback to old behavior (logs warning so we know what to update)
    console.warn('[SETTINGS] generateNewsletterFooter called without publication_id - update caller')
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', [
        'primary_color', 'newsletter_name', 'business_name', 'website_url',
        'facebook_enabled', 'facebook_url',
        'twitter_enabled', 'twitter_url',
        'linkedin_enabled', 'linkedin_url',
        'instagram_enabled', 'instagram_url'
      ])

    settings?.forEach(setting => {
      settingsMap[setting.key] = setting.value
    })
  }

  const primaryColor = settingsMap.primary_color || '#1877F2'
  const newsletterName = settingsMap.newsletter_name || 'St. Cloud Scoop'
  const businessName = settingsMap.business_name || 'Venture Formations LLC'
  const businessAddress = settingsMap.business_address || '8250 Delta Circle, Saint Joseph, MN 56374'
  const websiteUrl = settingsMap.website_url || 'https://www.aiaccountingdaily.com'
  const currentYear = new Date().getFullYear()

  // Build social media icons array (only include if enabled and URL exists)
  const socialIcons = []

  // Facebook
  if (settingsMap.facebook_enabled === 'true' && settingsMap.facebook_url) {
    const trackedUrl = issueDate ? wrapTrackingUrl(settingsMap.facebook_url, 'Footer', issueDate, issueId) : settingsMap.facebook_url
    socialIcons.push(`
      <td style="padding: 0 8px;">
        <a href="${trackedUrl}" target="_blank">
          <img src="${STORAGE_PUBLIC_URL}/img/s/facebook_light.png" alt="Facebook" width="24" height="24" style="border: none; display: block;">
        </a>
      </td>`)
  }

  // Twitter/X
  if (settingsMap.twitter_enabled === 'true' && settingsMap.twitter_url) {
    const trackedUrl = issueDate ? wrapTrackingUrl(settingsMap.twitter_url, 'Footer', issueDate, issueId) : settingsMap.twitter_url
    socialIcons.push(`
      <td style="padding: 0 8px;">
        <a href="${trackedUrl}" target="_blank">
          <img src="${STORAGE_PUBLIC_URL}/img/s/twitter_light.png" alt="Twitter/X" width="24" height="24" style="border: none; display: block;">
        </a>
      </td>`)
  }

  // LinkedIn
  if (settingsMap.linkedin_enabled === 'true' && settingsMap.linkedin_url) {
    const trackedUrl = issueDate ? wrapTrackingUrl(settingsMap.linkedin_url, 'Footer', issueDate, issueId) : settingsMap.linkedin_url
    socialIcons.push(`
      <td style="padding: 0 8px;">
        <a href="${trackedUrl}" target="_blank">
          <img src="${STORAGE_PUBLIC_URL}/img/s/linkedin_light.png" alt="LinkedIn" width="24" height="24" style="border: none; display: block;">
        </a>
      </td>`)
  }

  // Instagram
  if (settingsMap.instagram_enabled === 'true' && settingsMap.instagram_url) {
    const trackedUrl = issueDate ? wrapTrackingUrl(settingsMap.instagram_url, 'Footer', issueDate, issueId) : settingsMap.instagram_url
    socialIcons.push(`
      <td style="padding: 0 8px;">
        <a href="${trackedUrl}" target="_blank">
          <img src="${STORAGE_PUBLIC_URL}/img/s/instagram_light.png" alt="Instagram" width="24" height="24" style="border: none; display: block;">
        </a>
      </td>`)
  }

  // Generate social media section (only if at least one icon exists)
  const socialMediaSection = socialIcons.length > 0 ? `
<table width="100%" cellpadding="0" cellspacing="0" style="max-width: 770px; margin: 0 auto; background-color: ${primaryColor}; padding: 8px 0;">
  <tr>
    <td align="center">
      <table cellpadding="0" cellspacing="0">
        <tr>
          ${socialIcons.join('')}
        </tr>
      </table>
    </td>
  </tr>
</table>` : ''

  // Generate honeypot link for bot detection (disguised as comma in address)
  const honeypotUrl = issueDate
    ? wrapTrackingUrl(websiteUrl, HONEYPOT_CONFIG.SECTION_NAME, issueDate, issueId)
    : null

  // Split address at "Saint Joseph," to embed honeypot as the comma
  // The comma becomes an invisible-looking link that only bots will click
  const addressParts = honeypotUrl ? (() => {
    const commaTarget = 'Saint Joseph,'
    const idx = businessAddress.indexOf(commaTarget)
    if (idx !== -1) {
      const before = businessAddress.slice(0, idx + 'Saint Joseph'.length)
      const after = businessAddress.slice(idx + commaTarget.length)
      return { before, after, found: true }
    }
    return { before: businessAddress, after: '', found: false }
  })() : null

  return `
${socialMediaSection}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:770px;margin:0 auto;">
  <tr>
    <td style="font-family: Arial, sans-serif; font-size: 12px; color: #777; text-align: center; padding: 20px 10px; border-top: 1px solid #ccc; background-color: #ffffff;">
      <p style="margin: 0;text-align: center;">You're receiving this email because you subscribed to <strong>${newsletterName}</strong>.</p>
      <p style="margin: 5px 0 0;text-align: center;">
        <a href="${websiteUrl}/unsubscribe?email={$email}" style='text-decoration: underline;'>Get Fewer Emails</a> | <a href="${websiteUrl}/unsubscribe?email={$email}" style='text-decoration: underline;'>Unsubscribe</a>
      </p>
      <p style="margin: 5px 0 0;text-align: center;">©${currentYear} {$account}, all rights reserved</p>
      <p style="margin: 2px 0 0;text-align: center;">${addressParts?.found ? `${addressParts.before}<a href="${honeypotUrl}" style="font-family: Arial, sans-serif; font-size: 12px; color: #777; text-decoration: none;">,</a>${addressParts.after}` : businessAddress}</p>
    </td>
  </tr>
</table>
  </div>
</body>
</html>`
}
