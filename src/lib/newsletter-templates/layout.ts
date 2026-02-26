// Newsletter envelope: header and footer

import { supabaseAdmin } from '../supabase'
import { wrapTrackingUrl } from '../url-tracking'
import { HONEYPOT_CONFIG } from '../bot-detection'
import { STORAGE_PUBLIC_URL } from '../config'
import { getBusinessSettings as getPublicationBusinessSettings } from '../publication-settings'
import type { BusinessSettings } from './types'

// ==================== HEADER ====================

export async function generateNewsletterHeader(formattedDate: string, issueDate?: string, issueId?: string, publication_id?: string, businessSettings?: BusinessSettings, preheaderText?: string): Promise<string> {
  let headerImageUrl = ''
  let primaryColor = '#1877F2'
  let newsletterName = 'Newsletter'
  let websiteUrl = 'https://www.example.com'

  if (businessSettings) {
    // Use pre-fetched settings from snapshot (zero DB calls)
    headerImageUrl = businessSettings.headerImageUrl || headerImageUrl
    primaryColor = businessSettings.primaryColor || primaryColor
    newsletterName = businessSettings.newsletterName || newsletterName
    websiteUrl = businessSettings.websiteUrl || websiteUrl
  } else if (publication_id) {
    // Legacy path: fetch from DB
    const settings = await getPublicationBusinessSettings(publication_id)
    headerImageUrl = settings.header_image_url || headerImageUrl
    primaryColor = settings.primary_color || primaryColor
    newsletterName = settings.newsletter_name || newsletterName
    websiteUrl = settings.website_url || websiteUrl
  } else {
    console.warn('[SETTINGS] generateNewsletterHeader called without publication_id or businessSettings')
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

  // Build preheader hidden div (shown in email client preview text)
  const preheaderDiv = preheaderText
    ? `<!--[if !mso]><!--><div style="display:none;font-size:1px;color:#f7f7f7;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheaderText}&#847;&zwnj;&nbsp;&#8199;&shy;&#847;&zwnj;&nbsp;&#8199;&shy;&#847;&zwnj;&nbsp;&#8199;&shy;&#847;&zwnj;&nbsp;&#8199;&shy;&#847;&zwnj;&nbsp;&#8199;&shy;&#847;&zwnj;&nbsp;&#8199;&shy;&#847;&zwnj;&nbsp;&#8199;&shy;&#847;&zwnj;&nbsp;&#8199;&shy;</div><!--<![endif]-->`
    : ''

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" style="margin:0;padding:0;background-color:#f7f7f7;">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->

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
${preheaderDiv}
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

export async function generateNewsletterFooter(issueDate?: string, issueId?: string, publication_id?: string, businessSettings?: BusinessSettings): Promise<string> {
  let primaryColor: string
  let newsletterName: string
  let businessName: string
  let websiteUrl: string
  let fbEnabled: boolean
  let fbUrl: string
  let twEnabled: boolean
  let twUrl: string
  let liEnabled: boolean
  let liUrl: string
  let igEnabled: boolean
  let igUrl: string

  if (businessSettings) {
    // Use pre-fetched settings from snapshot (zero DB calls)
    primaryColor = businessSettings.primaryColor || '#1877F2'
    newsletterName = businessSettings.newsletterName || 'Newsletter'
    businessName = businessSettings.businessName || 'Business'
    websiteUrl = businessSettings.websiteUrl || 'https://www.example.com'
    fbEnabled = businessSettings.facebookEnabled
    fbUrl = businessSettings.facebookUrl
    twEnabled = businessSettings.twitterEnabled
    twUrl = businessSettings.twitterUrl
    liEnabled = businessSettings.linkedinEnabled
    liUrl = businessSettings.linkedinUrl
    igEnabled = businessSettings.instagramEnabled
    igUrl = businessSettings.instagramUrl
  } else {
    // Legacy path: fetch from DB
    const settingsMap: Record<string, string> = {}

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
        let cleanValue = setting.value
        if (cleanValue && cleanValue.startsWith('"') && cleanValue.endsWith('"') && cleanValue.length > 2) {
          cleanValue = cleanValue.slice(1, -1)
        }
        settingsMap[setting.key] = cleanValue
      })
    } else {
      console.warn('[SETTINGS] generateNewsletterFooter called without publication_id or businessSettings')
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

    primaryColor = settingsMap.primary_color || '#1877F2'
    newsletterName = settingsMap.newsletter_name || 'Newsletter'
    businessName = settingsMap.business_name || 'Business'
    websiteUrl = settingsMap.website_url || 'https://www.example.com'
    fbEnabled = settingsMap.facebook_enabled === 'true'
    fbUrl = settingsMap.facebook_url || ''
    twEnabled = settingsMap.twitter_enabled === 'true'
    twUrl = settingsMap.twitter_url || ''
    liEnabled = settingsMap.linkedin_enabled === 'true'
    liUrl = settingsMap.linkedin_url || ''
    igEnabled = settingsMap.instagram_enabled === 'true'
    igUrl = settingsMap.instagram_url || ''
  }

  const businessAddress = '8250 Delta Circle, Saint Joseph, MN 56374'
  const currentYear = new Date().getFullYear()

  // Build social media icons array (only include if enabled and URL exists)
  const socialIcons = []

  // Facebook
  if (fbEnabled && fbUrl) {
    const trackedUrl = issueDate ? wrapTrackingUrl(fbUrl, 'Footer', issueDate, issueId) : fbUrl
    socialIcons.push(`
      <td style="padding: 0 8px;">
        <a href="${trackedUrl}" target="_blank">
          <img src="${STORAGE_PUBLIC_URL}/img/s/facebook_light.png" alt="Facebook" width="24" height="24" style="border: none; display: block;">
        </a>
      </td>`)
  }

  // Twitter/X
  if (twEnabled && twUrl) {
    const trackedUrl = issueDate ? wrapTrackingUrl(twUrl, 'Footer', issueDate, issueId) : twUrl
    socialIcons.push(`
      <td style="padding: 0 8px;">
        <a href="${trackedUrl}" target="_blank">
          <img src="${STORAGE_PUBLIC_URL}/img/s/twitter_light.png" alt="Twitter/X" width="24" height="24" style="border: none; display: block;">
        </a>
      </td>`)
  }

  // LinkedIn
  if (liEnabled && liUrl) {
    const trackedUrl = issueDate ? wrapTrackingUrl(liUrl, 'Footer', issueDate, issueId) : liUrl
    socialIcons.push(`
      <td style="padding: 0 8px;">
        <a href="${trackedUrl}" target="_blank">
          <img src="${STORAGE_PUBLIC_URL}/img/s/linkedin_light.png" alt="LinkedIn" width="24" height="24" style="border: none; display: block;">
        </a>
      </td>`)
  }

  // Instagram
  if (igEnabled && igUrl) {
    const trackedUrl = issueDate ? wrapTrackingUrl(igUrl, 'Footer', issueDate, issueId) : igUrl
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
