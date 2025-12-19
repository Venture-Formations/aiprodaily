// Shared newsletter template generation functions
// Used by both preview route and MailerLite service for consistency

import { supabaseAdmin } from './supabase'
import { wrapTrackingUrl } from './url-tracking'
import { AdScheduler } from './ad-scheduler'
import { normalizeEmailHtml } from './html-normalizer'
import { getBusinessSettings as getPublicationBusinessSettings } from './publication-settings'
import { AdModuleRenderer } from './ad-modules'
import type { AdBlockType } from '@/types/database'

// ==================== UTILITY FUNCTIONS ====================

// Helper function to create a light background color from a hex color
export function getLightBackground(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '')

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // Mix with white (90% white, 10% color) for a very light tint
  const lightR = Math.round(r * 0.1 + 255 * 0.9)
  const lightG = Math.round(g * 0.1 + 255 * 0.9)
  const lightB = Math.round(b * 0.1 + 255 * 0.9)

  return `rgb(${lightR}, ${lightG}, ${lightB})`
}

export function formatEventDate(dateStr: string): string {
  // Parse date as local date to avoid timezone offset issues
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day) // month is 0-indexed
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' })
  const monthName = date.toLocaleDateString('en-US', { month: 'long' })
  const dayNum = date.getDate()
  return `${dayOfWeek}, ${monthName} ${dayNum}`
}

export function formatEventTime(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)

  const formatTime = (date: Date) => {
    let hours = date.getHours()
    const minutes = date.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12 || 12
    const minuteStr = minutes === 0 ? '' : `:${minutes.toString().padStart(2, '0')}`
    return `${hours}${minuteStr}${ampm}`
  }

  return `${formatTime(start)} - ${formatTime(end)}`
}

export function getEventEmoji(title: string, venue: string): string {
  const titleLower = title.toLowerCase()
  const venueLower = venue ? venue.toLowerCase() : ''

  // Seasonal & Nature
  if (titleLower.includes('harvest') || titleLower.includes('corn maze') || titleLower.includes('farm')) return '🌽'
  if (titleLower.includes('fall') || titleLower.includes('autumn')) return '🍂'
  if (titleLower.includes('winter') || titleLower.includes('snow') || titleLower.includes('ice')) return '❄️'
  if (titleLower.includes('spring') || titleLower.includes('garden')) return '🌸'
  if (titleLower.includes('summer')) return '☀️'
  if (titleLower.includes('halloween') || titleLower.includes('spooky') || titleLower.includes('haunted')) return '🎃'
  if (titleLower.includes('christmas') || titleLower.includes('santa') || titleLower.includes('holiday lights')) return '🎄'
  if (titleLower.includes('valentine')) return '💝'
  if (titleLower.includes('patrick') || titleLower.includes('irish')) return '☘️'
  if (titleLower.includes('easter') || titleLower.includes('egg hunt')) return '🐰'
  if (titleLower.includes('fourth of july') || titleLower.includes('independence day') || titleLower.includes('fireworks')) return '🎆'
  if (titleLower.includes('thanksgiving')) return '🦃'

  // Arts & Culture
  if (titleLower.includes('art') || titleLower.includes('exhibition') || titleLower.includes('ceramic') || titleLower.includes('gallery') || titleLower.includes('sculpture')) return '🎨'
  if (titleLower.includes('paint') || titleLower.includes('canvas')) return '🖼️'
  if (titleLower.includes('photography') || titleLower.includes('photo')) return '📷'
  if (titleLower.includes('film') || titleLower.includes('movie') || titleLower.includes('cinema')) return '🎬'
  if (titleLower.includes('theater') || titleLower.includes('theatre') || titleLower.includes('play') || titleLower.includes('drama') || titleLower.includes('broadway')) return '🎭'
  if (titleLower.includes('comedy') || titleLower.includes('standup') || titleLower.includes('stand-up')) return '🎤'
  if (titleLower.includes('museum')) return '🏛️'
  if (titleLower.includes('library') || titleLower.includes('book') || titleLower.includes('reading') || titleLower.includes('author')) return '📚'

  // Music & Dance
  if (titleLower.includes('music') || titleLower.includes('concert') || titleLower.includes('song') || venueLower.includes('amphitheater')) return '🎶'
  if (titleLower.includes('bluegrass') || titleLower.includes('brews')) return '🎶'
  if (titleLower.includes('jazz')) return '🎷'
  if (titleLower.includes('rock') || titleLower.includes('band')) return '🎸'
  if (titleLower.includes('orchestra') || titleLower.includes('symphony') || titleLower.includes('classical')) return '🎻'
  if (titleLower.includes('karaoke')) return '🎤'
  if (titleLower.includes('dance') || titleLower.includes('ballet')) return '💃'
  if (titleLower.includes('choir') || titleLower.includes('singing')) return '🎵'

  // Food & Drink
  if (titleLower.includes('meat raffle') || titleLower.includes('meat')) return '🥩'
  if (titleLower.includes('farmers') || titleLower.includes('market')) return '🥕'
  if (titleLower.includes('food') || titleLower.includes('dinner') || titleLower.includes('lunch') || titleLower.includes('breakfast') || titleLower.includes('brunch')) return '🍽️'
  if (titleLower.includes('beer') || titleLower.includes('oktoberfest') || titleLower.includes('brewing') || titleLower.includes('brewery')) return '🍺'
  if (titleLower.includes('wine') || titleLower.includes('winery') || titleLower.includes('tasting')) return '🍷'
  if (titleLower.includes('coffee') || titleLower.includes('cafe')) return '☕'
  if (titleLower.includes('pizza')) return '🍕'
  if (titleLower.includes('taco')) return '🌮'
  if (titleLower.includes('bbq') || titleLower.includes('barbecue') || titleLower.includes('grill')) return '🍖'
  if (titleLower.includes('dessert') || titleLower.includes('cake') || titleLower.includes('bakery')) return '🍰'
  if (titleLower.includes('ice cream')) return '🍦'
  if (titleLower.includes('steak') || titleLower.includes('beef')) return '🥩'

  // Sports & Recreation
  if (titleLower.includes('hockey')) return '🏒'
  if (titleLower.includes('baseball')) return '⚾'
  if (titleLower.includes('basketball')) return '🏀'
  if (titleLower.includes('football')) return '🏈'
  if (titleLower.includes('soccer')) return '⚽'
  if (titleLower.includes('golf')) return '⛳'
  if (titleLower.includes('tennis')) return '🎾'
  if (titleLower.includes('volleyball')) return '🏐'
  if (titleLower.includes('run') || titleLower.includes('5k') || titleLower.includes('race') || titleLower.includes('marathon')) return '🏃'
  if (titleLower.includes('bike') || titleLower.includes('cycling')) return '🚴'
  if (titleLower.includes('swim') || titleLower.includes('pool')) return '🏊'
  if (titleLower.includes('skate') || titleLower.includes('skating')) return '🛼'
  if (titleLower.includes('ski') || titleLower.includes('snowboard')) return '⛷️'
  if (titleLower.includes('fish') || titleLower.includes('fishing')) return '🎣'
  if (titleLower.includes('hunt') || titleLower.includes('hunting')) return '🦌'
  if (titleLower.includes('yoga') || titleLower.includes('meditation')) return '🧘'
  if (titleLower.includes('gym') || titleLower.includes('fitness') || titleLower.includes('workout')) return '💪'

  // Family & Kids
  if (titleLower.includes('sensory') || titleLower.includes('kids') || titleLower.includes('children') || titleLower.includes('toddler')) return '🧒'
  if (titleLower.includes('baby') || titleLower.includes('infant')) return '👶'
  if (titleLower.includes('family')) return '👨‍👩‍👧‍👦'
  if (titleLower.includes('storytime') || titleLower.includes('story time')) return '📖'
  if (titleLower.includes('craft') || titleLower.includes('diy')) return '✂️'

  // Entertainment & Games
  if (titleLower.includes('carnival')) return '🎡'
  if (titleLower.includes('fair')) return '🎪'
  if (titleLower.includes('festival')) return '🎊'
  if (titleLower.includes('parade')) return '🎺'
  if (titleLower.includes('magic') || titleLower.includes('gathering') || titleLower.includes('commander')) return '🎲'
  if (titleLower.includes('dungeons') || titleLower.includes('dragons')) return '🐉'
  if (titleLower.includes('game') || titleLower.includes('board game') || titleLower.includes('trivia')) return '🎮'
  if (titleLower.includes('bingo')) return '🎰'
  if (titleLower.includes('blacklight') || titleLower.includes('adventure')) return '🎯'
  if (titleLower.includes('escape room')) return '🔐'

  // Community & Education
  if (titleLower.includes('pride')) return '🏳️‍🌈'
  if (titleLower.includes('raffle')) return '🎟️'
  if (titleLower.includes('volunteer') || titleLower.includes('fundraiser') || titleLower.includes('charity')) return '🤝'
  if (titleLower.includes('class') || titleLower.includes('workshop') || titleLower.includes('seminar')) return '🎓'
  if (titleLower.includes('meeting') || titleLower.includes('conference')) return '💼'
  if (titleLower.includes('networking')) return '🔗'
  if (titleLower.includes('auction')) return '🔨'

  // Animals & Pets
  if (titleLower.includes('dog') || titleLower.includes('puppy') || titleLower.includes('canine')) return '🐕'
  if (titleLower.includes('cat') || titleLower.includes('kitten') || titleLower.includes('feline')) return '🐱'
  if (titleLower.includes('pet')) return '🐾'
  if (titleLower.includes('zoo') || titleLower.includes('wildlife')) return '🦁'
  if (titleLower.includes('bird') || titleLower.includes('avian')) return '🦅'

  // Nature & Outdoors
  if (titleLower.includes('outdoor') || titleLower.includes('nature') || titleLower.includes('park')) return '🌳'
  if (titleLower.includes('hiking') || titleLower.includes('trail')) return '🥾'
  if (titleLower.includes('camping')) return '⛺'
  if (titleLower.includes('beach') || titleLower.includes('lake')) return '🏖️'
  if (titleLower.includes('boat') || titleLower.includes('sailing')) return '⛵'

  // Default
  return '🎉'
}

// ==================== HEADER ====================

export async function generateNewsletterHeader(formattedDate: string, issueDate?: string, issueId?: string, publication_id?: string): Promise<string> {
  // Fetch business settings for header image, primary color, and website URL
  let headerImageUrl = 'https://raw.githubusercontent.com/VFDavid/STCScoop/refs/heads/main/STCSCOOP_Logo_824X148_clear.png'
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
            <img alt="${newsletterName}" src="${headerImageUrl}" style="display:block;width:100%;max-width:500px;height:auto;margin:0 auto;" />
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

// ==================== ARTICLE EMOJI GENERATOR ====================

function getArticleEmoji(headline: string, content: string): string {
  const text = (headline + ' ' + content).toLowerCase()

  // Regulatory & Compliance
  if (text.includes('irs') || text.includes('sec') || text.includes('fasb') || text.includes('pcaob')) return '⚖️'
  if (text.includes('regulation') || text.includes('compliance')) return '📋'
  if (text.includes('audit') || text.includes('auditing')) return '🔍'

  // Tax Related
  if (text.includes('tax')) return '💰'

  // Technology & AI
  if (text.includes('ai') || text.includes('artificial intelligence')) return '🤖'
  if (text.includes('software') || text.includes('technology')) return '💻'
  if (text.includes('cybersecurity') || text.includes('security')) return '🔐'
  if (text.includes('automation') || text.includes('machine learning')) return '⚙️'

  // Business & Finance
  if (text.includes('accounting') || text.includes('cpa') || text.includes('accountant')) return '📊'
  if (text.includes('acquisition') || text.includes('merger')) return '🤝'
  if (text.includes('scandal') || text.includes('fraud')) return '⚠️'
  if (text.includes('lawsuit') || text.includes('court')) return '⚖️'
  if (text.includes('finance') || text.includes('financial')) return '💵'
  if (text.includes('revenue') || text.includes('profit')) return '💹'

  // Professional Development
  if (text.includes('training') || text.includes('education') || text.includes('course')) return '🎓'
  if (text.includes('career') || text.includes('job')) return '💼'

  // Default accounting icon
  return '📈'
}

// ==================== HELPER: FETCH COLORS & FONTS ====================

async function fetchBusinessSettings(publication_id?: string): Promise<{
  primaryColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  quaternaryColor: string;
  headingFont: string;
  bodyFont: string;
  websiteUrl: string;
}> {
  // If publication_id is provided, use the new helper module (with fallback logging)
  if (publication_id) {
    const settings = await getPublicationBusinessSettings(publication_id)
    return {
      primaryColor: settings.primary_color,
      secondaryColor: settings.secondary_color,
      tertiaryColor: settings.tertiary_color,
      quaternaryColor: settings.quaternary_color,
      headingFont: settings.heading_font,
      bodyFont: settings.body_font,
      websiteUrl: settings.website_url,
    }
  }

  // Fallback to old behavior (logs warning so we know what to update)
  console.warn('[SETTINGS] fetchBusinessSettings called without publication_id - update caller to pass publication_id')

  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .in('key', ['primary_color', 'secondary_color', 'tertiary_color', 'quaternary_color', 'heading_font', 'body_font', 'website_url'])

  const settingsMap: Record<string, string> = {}
  settings?.forEach(setting => {
    settingsMap[setting.key] = setting.value
  })

  return {
    primaryColor: settingsMap.primary_color || '#1877F2',
    secondaryColor: settingsMap.secondary_color || '#10B981',
    tertiaryColor: settingsMap.tertiary_color || '#F59E0B',
    quaternaryColor: settingsMap.quaternary_color || '#8B5CF6',
    headingFont: settingsMap.heading_font || 'Arial, sans-serif',
    bodyFont: settingsMap.body_font || 'Arial, sans-serif',
    websiteUrl: settingsMap.website_url || 'https://www.aiaccountingdaily.com'
  }
}

// ==================== WELCOME SECTION ====================

export async function generateWelcomeSection(
  intro: string | null,
  tagline: string | null,
  summary: string | null,
  publication_id?: string
): Promise<string> {
  // Skip if all 3 parts are empty
  if ((!intro || intro.trim() === '') &&
      (!tagline || tagline.trim() === '') &&
      (!summary || summary.trim() === '')) {
    return ''
  }

  // Fetch fonts from business settings
  const { bodyFont } = await fetchBusinessSettings(publication_id)

  // Prepend personalized greeting to intro
  const greeting = `Hey, {$name|default('Accounting Pro')}!`
  const fullIntro = intro && intro.trim() ? `${greeting} ${intro.trim()}` : greeting

  // Build HTML for each part (only include non-empty parts)
  const introPart = greeting
    ? `<div style="font-size: 16px; line-height: 24px; color: #333; font-family: ${bodyFont}; margin-bottom: 8px;">${greeting.replace(/\n/g, '<br>')}</div>`
    : ''

  const taglinePart = tagline && tagline.trim()
    ? `<div style="font-size: 16px; line-height: 24px; color: #333; font-family: ${bodyFont}; font-weight: bold; margin-bottom: 8px;">${tagline.replace(/\n/g, '<br>')}</div>`
    : ''

  const summaryPart = summary && summary.trim()
    ? `<div style="font-size: 16px; line-height: 24px; color: #333; font-family: ${bodyFont};">${summary.replace(/\n/g, '<br>')}</div>`
    : ''

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ddd; border-radius: 10px; margin-top: 10px; background-color: #fff; box-shadow:0 4px 12px rgba(0,0,0,.15);">
        <tr>
          <td style="padding: 10px;">
            ${introPart}
            ${taglinePart}
            ${summaryPart}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<br>`
}

// ==================== PRIMARY ARTICLES SECTION ====================

export async function generatePrimaryArticlesSection(articles: any[], issueDate: string, issueId: string | undefined, sectionName: string, publication_id?: string, mailerliteIssueId?: string): Promise<string> {
  if (!articles || articles.length === 0) {
    return ''
  }

  // Fetch colors and fonts from business settings
  const { primaryColor, secondaryColor, headingFont, bodyFont } = await fetchBusinessSettings(publication_id)

  const articlesHtml = articles.map((article) => {
    const headline = article.headline || 'No headline'
    const content = article.content || ''
    const sourceUrl = article.rss_post?.source_url || '#'
    const emoji = getArticleEmoji(headline, content)

    // Wrap URL with tracking (pass both mailerlite ID and database issue ID)
    const trackedUrl = sourceUrl !== '#' ? wrapTrackingUrl(sourceUrl, sectionName, issueDate, mailerliteIssueId, issueId) : '#'

    // Convert newlines to <br> for proper HTML display (AI responses contain \n for paragraphs)
    const formattedContent = content.replace(/\n/g, '<br>')

    return `
      <div style='padding: 16px 0; border-bottom: 1px solid #e0e0e0;'>
        <div style='font-size: 18px; font-weight: bold; margin-bottom: 8px; font-family: ${bodyFont};'>
          ${emoji} <a href='${trackedUrl}' style='color: ${secondaryColor}; text-decoration: underline;'>${headline}</a>
        </div>
        <div style='font-size: 16px; line-height: 24px; color: #333; font-family: ${bodyFont};'>${formattedContent}</div>
      </div>`
  }).join('')

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ddd; border-radius: 10px; margin-top: 10px; background-color: #fff; box-shadow:0 4px 12px rgba(0,0,0,.15);">
        <tr>
          <td style="padding: 8px; background-color: ${primaryColor}; border-top-left-radius: 10px; border-top-right-radius: 10px;">
            <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: ${headingFont}; color: #ffffff; margin: 0; padding: 0;">${sectionName}</h2>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 10px 10px 10px;">
            ${articlesHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<br>`
}

// ==================== SECONDARY ARTICLES SECTION ====================

export async function generateSecondaryArticlesSection(issue: any, sectionName: string): Promise<string> {
  // Fetch secondary articles for this issue
  const { data: secondaryArticles } = await supabaseAdmin
    .from('secondary_articles')
    .select(`
      id,
      headline,
      content,
      is_active,
      rank,
      rss_post:rss_posts(
        source_url
      )
    `)
    .eq('issue_id', issue.id)
    .eq('is_active', true)
    .order('rank', { ascending: true })

  if (!secondaryArticles || secondaryArticles.length === 0) {
    return ''
  }

  // Fetch colors and fonts from business settings (using publication_id if available)
  const { primaryColor, secondaryColor, headingFont, bodyFont } = await fetchBusinessSettings(issue?.publication_id)

  const articlesHtml = secondaryArticles.map((article) => {
    const headline = article.headline || 'No headline'
    const content = article.content || ''
    const rssPost = Array.isArray(article.rss_post) ? article.rss_post[0] : article.rss_post
    const sourceUrl = rssPost?.source_url || '#'
    const emoji = getArticleEmoji(headline, content)

    // Wrap URL with tracking
    const trackedUrl = sourceUrl !== '#' ? wrapTrackingUrl(sourceUrl, sectionName, issue.date, issue.mailerlite_issue_id, issue.id) : '#'

    // Convert newlines to <br> for proper HTML display (AI responses contain \n for paragraphs)
    const formattedContent = content.replace(/\n/g, '<br>')

    return `
      <div style='padding: 16px 0; border-bottom: 1px solid #e0e0e0;'>
        <div style='font-size: 18px; font-weight: bold; margin-bottom: 8px; font-family: ${bodyFont};'>
          ${emoji} <a href='${trackedUrl}' style='color: ${secondaryColor}; text-decoration: underline;'>${headline}</a>
        </div>
        <div style='font-size: 16px; line-height: 24px; color: #333; font-family: ${bodyFont};'>${formattedContent}</div>
      </div>`
  }).join('')

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ddd; border-radius: 10px; margin-top: 10px; background-color: #fff; box-shadow:0 4px 12px rgba(0,0,0,.15);">
        <tr>
          <td style="padding: 8px; background-color: ${primaryColor}; border-top-left-radius: 10px; border-top-right-radius: 10px;">
            <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: ${headingFont}; color: #ffffff; margin: 0; padding: 0;">${sectionName}</h2>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 10px 10px 10px;">
            ${articlesHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<br>`
}

// ==================== LOCAL EVENTS ====================
// Feature not needed in this newsletter

export async function generateLocalEventsSection(issue: any): Promise<string> {
  console.log('Local Events section disabled for AI Accounting Daily')
  return ''
}

// ==================== WORDLE ====================
// Feature not needed in this newsletter

export async function generateWordleSection(issue: any): Promise<string> {
  console.log('Wordle section disabled for AI Accounting Daily')
  return ''
}

// ==================== MINNESOTA GETAWAYS ====================
// Feature not needed in this newsletter

export async function generateMinnesotaGetawaysSection(issue: any): Promise<string> {
  console.log('Minnesota Getaways section disabled for AI Accounting Daily')
  return ''
}

// ==================== POLL SECTION ====================

export async function generatePollSection(issue: { id: string; publication_id: string; status?: string; poll_id?: string | null }): Promise<string> {
  try {
    // Fetch colors and website URL from business settings (using publication_id)
    const { primaryColor, tertiaryColor, headingFont, bodyFont } = await fetchBusinessSettings(issue.publication_id)
    // Use the main app domain for poll responses (where the poll pages are hosted)
    const baseUrl = process.env.NEXTAUTH_URL || 'https://www.aiprodaily.com'

    let pollData = null

    // For sent issues, use the poll that was sent with it (if any)
    if (issue.status === 'sent') {
      if (!issue.poll_id) {
        console.log(`[Polls] Sent issue ${issue.id} has no poll_id, skipping poll section`)
        return ''
      }
      // Fetch the specific poll that was sent with this issue
      const { data } = await supabaseAdmin
        .from('polls')
        .select('id, publication_id, title, question, options, is_active')
        .eq('id', issue.poll_id)
        .single()
      pollData = data
    } else {
      // For draft/review issues, get the current active poll
      const { data } = await supabaseAdmin
        .from('polls')
        .select('id, publication_id, title, question, options, is_active')
        .eq('publication_id', issue.publication_id)
        .eq('is_active', true)
        .limit(1)
        .single()
      pollData = data
    }

    if (!pollData) {
      console.log(`[Polls] No poll found for issue ${issue.id}, skipping poll section`)
      return ''
    }

    // Generate button HTML for each option
    // Button background: tertiary color, Button text: primary color
    const optionsHtml = pollData.options.map((option: string, index: number) => {
      const isLast = index === pollData.options.length - 1
      const paddingStyle = isLast ? 'padding:0;' : 'padding:0 0 8px 0;'

      return `
              <tr>
                <td style="${paddingStyle}">
                  <a href="${baseUrl}/api/polls/${pollData.id}/respond?option=${encodeURIComponent(option)}&amp;issue_id=${issue.id}&amp;email={$email}"
                     style="display:block; text-decoration:none; background:${tertiaryColor}; color:${primaryColor}; font-weight:bold;
                            font-size:16px; line-height:20px; padding:12px; border-radius:8px; text-align:center;">${option}</a>
                </td>
              </tr>`
    }).join('')

    return `
<!-- Poll card -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
        <tr>
          <td style="padding:5px;">
            <!-- Poll Box -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                   style="width:100%; max-width:650px; margin:10px auto; background-color:${primaryColor};
                          border:2px solid ${primaryColor}; border-radius:10px; font-family:Arial, sans-serif; box-shadow:0 4px 12px rgba(0,0,0,.15);">
              <tr>
                <td style="padding:14px; color:#ffffff; font-size:16px; line-height:1.5; text-align:center;">

                  <!-- Text Sections -->
                  <p style="margin:0 0 6px 0; font-weight:bold; font-size:20px; color:#ffffff; text-align:center;">${pollData.title}</p>
                  <p style="margin:0 0 14px 0; font-size:16px; color:#ffffff; text-align:center;">
                    ${pollData.question}
                  </p>

                  <!-- Button Stack: 1 per row, centered -->
                  <table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" style="margin:0 auto; width:100%; max-width:350px;">
${optionsHtml}
                  </table>

                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<br>`
  } catch (error) {
    console.error('Error generating poll section:', error)
    return ''
  }
}

// ==================== POLL MODULES SECTION ====================

/**
 * Generate HTML for a single poll module.
 * This uses the new modular poll system with block ordering.
 *
 * @param issue - The issue data
 * @param moduleId - The poll module ID to render
 * @returns The generated HTML for the poll module
 */
export async function generatePollModulesSection(
  issue: { id: string; publication_id: string; status?: string },
  moduleId: string
): Promise<string> {
  try {
    const { PollModuleSelector, PollModuleRenderer } = await import('./poll-modules')

    // Get all poll selections for this issue
    const selections = await PollModuleSelector.getIssuePollSelections(issue.id)

    // Find the selection for this specific module
    const selection = selections.find(s => s.poll_module_id === moduleId)

    if (!selection || !selection.poll || !selection.poll_module) {
      console.log(`[PollModules] No selection/poll found for module ${moduleId} in issue ${issue.id}`)
      return ''
    }

    // Render the poll module
    const result = await PollModuleRenderer.renderPollModule(
      selection.poll_module,
      selection.poll,
      issue.publication_id,
      { issueId: issue.id }
    )

    return result.html
  } catch (error) {
    console.error('[PollModules] Error generating poll module section:', error)
    return ''
  }
}

// ==================== DINING DEALS ====================
// Feature not needed in this newsletter

export async function generateDiningDealsSection(issue: any): Promise<string> {
  console.log('Dining Deals section disabled for AI Accounting Daily')
  return ''
}

// ==================== ADVERTORIAL ====================

// Shared interface for ad data used in advertorial rendering
export interface AdvertorialAdData {
  title: string
  body: string
  button_url: string
  image_url?: string
}

// Shared interface for advertorial styling options
export interface AdvertorialStyleOptions {
  primaryColor: string
  headingFont: string
  bodyFont: string
  sectionName?: string
  linkUrl?: string // URL to use for links (can be tracked or untracked)
}

/**
 * Generate the HTML for an advertorial card.
 * This is the shared function used by both generateAdvertorialSection and the ad preview API.
 * Any changes to the advertorial styling should be made here.
 */
export function generateAdvertorialHtml(
  ad: AdvertorialAdData,
  options: AdvertorialStyleOptions
): string {
  const { primaryColor, headingFont, bodyFont, sectionName = 'Advertorial', linkUrl } = options
  const buttonUrl = linkUrl || ad.button_url || '#'

  // Generate clickable image HTML if valid URL exists
  const imageHtml = ad.image_url
    ? `<tr><td style='padding: 0 12px; text-align: center;'><a href='${buttonUrl}'><img src='${ad.image_url}' alt='${ad.title}' style='max-width: 100%; max-height: 500px; border-radius: 4px; display: block; margin: 0 auto;'></a></td></tr>`
    : ''

  // Process ad body: normalize HTML for email compatibility, then make the last sentence a hyperlink
  let processedBody = normalizeEmailHtml(ad.body || '')
  if (buttonUrl !== '#' && processedBody) {
    // Check for arrow CTA in table format (created by normalizeEmailHtml)
    // This handles both single-row tables AND multi-row tables with arrows
    // We want to make the LAST arrow row's text into a clickable link
    
    // Pattern for the last row with an arrow in a table (handles bold arrows too)
    // Made more flexible: doesn't require table to be at very end, allows for trailing whitespace/content
    const tableArrowLastRowPattern = /(<table[^>]*>(?:[\s\S]*?<tr>[\s\S]*?<\/tr>)*?)(<tr>\s*<td[^>]*>\s*(?:<strong>)?\s*→\s*(?:<\/strong>)?\s*<\/td>\s*<td>)([^<]+)(<\/td>\s*<\/tr>\s*<\/table>)/i
    const tableArrowMatch = processedBody.match(tableArrowLastRowPattern)

    if (tableArrowMatch) {
      // Found table-based arrow CTA - keep the table structure but make the last row's text a link
      const beforeLastRow = tableArrowMatch[1]
      const lastRowStart = tableArrowMatch[2]
      const ctaText = tableArrowMatch[3].trim()
      const lastRowEnd = tableArrowMatch[4]

      processedBody = processedBody.replace(
        tableArrowLastRowPattern,
        `${beforeLastRow}${lastRowStart}<a href='${buttonUrl}' style='color: #000; text-decoration: underline; font-weight: bold;'>${ctaText}</a>${lastRowEnd}`
      )
    } else {
      // Check for arrow CTA pattern in paragraph format
      // Handle various structures:
      // 1. Plain: "→ Try Fiskl"
      // 2. Mid-line: "Some text → Try Fiskl"
      // 3. Separate tags: "<strong>→ </strong><strong>Send it to Shoeboxed.</strong>"

      let arrowHandled = false

      // First, try to match arrow in separate strong tag followed by CTA in another strong tag
      // Pattern: <strong>→ </strong><strong>CTA text</strong>
      const separateTagsPattern = /([\s\S]*?<strong[^>]*>)(→\s*)(<\/strong>\s*<strong[^>]*>)([^<]+)(<\/strong>)/i
      const separateTagsMatch = processedBody.match(separateTagsPattern)

      if (separateTagsMatch && separateTagsMatch[4].trim().length > 3) {
        const beforeArrow = separateTagsMatch[1]
        const arrow = separateTagsMatch[2]
        const betweenTags = separateTagsMatch[3]
        const ctaText = separateTagsMatch[4].trim()
        const closingTag = separateTagsMatch[5]

        processedBody = processedBody.replace(
          separateTagsPattern,
          `${beforeArrow}${arrow}${betweenTags}<a href='${buttonUrl}' style='color: #000; text-decoration: underline;'>${ctaText}</a>${closingTag}`
        )
        arrowHandled = true
      }

      // If not handled, try simpler mid-line pattern
      if (!arrowHandled) {
        const midLineArrowPattern = /([\s\S]*?)(→\s*)([^<\n→]+?)(\s*<\/p>|\s*<\/strong>|\s*$)/i
        const midLineMatch = processedBody.match(midLineArrowPattern)

        if (midLineMatch && midLineMatch[3].trim().length > 3) {
          const beforeArrow = midLineMatch[1]
          const arrow = midLineMatch[2]
          const ctaText = midLineMatch[3].trim()
          const afterCta = midLineMatch[4] || ''

          processedBody = processedBody.replace(
            midLineArrowPattern,
            `${beforeArrow}<strong>${arrow}</strong><a href='${buttonUrl}' style='color: #000; text-decoration: underline; font-weight: bold;'>${ctaText}</a>${afterCta}`
          )
          arrowHandled = true
        }
      }

      if (!arrowHandled) {
      // No arrow CTA - use existing last-sentence logic
      // Strip HTML to get plain text
      const plainText = processedBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

      // Find all sentence-ending punctuation marks (., !, ?)
      // But exclude periods that are part of domains (.com, .ai, .io, etc.) or abbreviations
      const sentenceEndPattern = /[.!?](?=\s+[A-Z]|$)/g
      const matches = Array.from(plainText.matchAll(sentenceEndPattern))

    if (matches.length > 0) {
      // Get the position of the last sentence-ending punctuation
      const lastMatch = matches[matches.length - 1] as RegExpMatchArray
      const lastPeriodIndex = lastMatch.index!

      // Find the second-to-last sentence-ending punctuation
      let startIndex = 0
      if (matches.length > 1) {
        const secondLastMatch = matches[matches.length - 2] as RegExpMatchArray
        startIndex = secondLastMatch.index! + 1
      }

      // Extract the last complete sentence (from after previous punctuation to end, including the final punctuation)
      const lastSentence = plainText.substring(startIndex, lastPeriodIndex + 1).trim()

      if (lastSentence.length > 5) {
        // Escape special regex characters
        const escapedSentence = lastSentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

        // Replace in the original HTML
        // Look for the sentence text, accounting for HTML tags that might be in between
        const parts = escapedSentence.split(/\s+/)
        const flexiblePattern = parts.join('\\s*(?:<[^>]*>\\s*)*')
        const sentenceRegex = new RegExp(flexiblePattern, 'i')

        processedBody = processedBody.replace(
          sentenceRegex,
          `<a href='${buttonUrl}' style='color: #000; text-decoration: underline; font-weight: bold;'>$&</a>`
        )
      }
    } else {
      // No sentence-ending punctuation found - wrap the entire text
      const trimmedText = plainText.trim()
      if (trimmedText.length > 5) {
        const escapedText = trimmedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const parts = escapedText.split(/\s+/)
        const flexiblePattern = parts.join('\\s*(?:<[^>]*>\\s*)*')
        const textRegex = new RegExp(flexiblePattern, 'i')

        processedBody = processedBody.replace(
          textRegex,
          `<a href='${buttonUrl}' style='color: #000; text-decoration: underline; font-weight: bold;'>$&</a>`
        )
      }
    }
      }
    }
  }

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width='100%' cellpadding='0' cellspacing='0' style='border: 1px solid #ddd; border-radius: 10px; background: #fff; font-family: ${bodyFont}; font-size: 16px; line-height: 26px; box-shadow:0 4px 12px rgba(0,0,0,.15); margin-top: 10px; overflow: hidden;'>
        <tr>
          <td style="padding: 8px; background-color: ${primaryColor}; border-top-left-radius: 10px; border-top-right-radius: 10px;">
            <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: ${headingFont}; color: #ffffff; margin: 0; padding: 0;">${sectionName}</h2>
          </td>
        </tr>
        <tr><td style='padding: 10px 10px 4px; font-size: 20px; font-weight: bold; text-align: left;'>${ad.title}</td></tr>
        ${imageHtml}
        <tr><td style='padding: 0 10px 10px; font-family: ${bodyFont}; font-size: 16px; line-height: 24px; color: #333;'>${processedBody}</td></tr>
      </table>
    </td>
  </tr>
</table>
<br>`
}

export async function generateAdvertorialSection(issue: any, _recordUsage: boolean = false, sectionName: string = 'Advertorial'): Promise<string> {
  // Note: _recordUsage parameter is deprecated - ad usage is now tracked exclusively
  // by AdScheduler.recordAdUsage() in send-final/route.ts to prevent double-counting
  try {
    console.log('Generating Advertorial section for issue:', issue?.id)

    // Fetch colors from business settings (using publication_id if available)
    const { primaryColor, headingFont, bodyFont } = await fetchBusinessSettings(issue?.publication_id)

    // Check if ad already selected for this issue
    const { data: existingAd } = await supabaseAdmin
      .from('issue_advertisements')
      .select('*, advertisement:advertisements(*)')
      .eq('issue_id', issue.id)
      .order('created_at', { ascending: false }) // Use created_at since used_at is NULL until send-final
      .limit(1)
      .maybeSingle()

    const selectedAd = existingAd?.advertisement

    // If no ad selected, return empty (RSS processing should have selected one)
    if (!selectedAd) {
      console.log('No ad selected for this issue (RSS processing may not have completed)')
      return ''
    }

    console.log(`Using selected ad: ${selectedAd.title}`)

    // Generate tracked URL for links
    const buttonUrl = selectedAd.button_url || '#'
    const trackedUrl = buttonUrl !== '#'
      ? wrapTrackingUrl(buttonUrl, 'Advertorial', issue.date, issue.mailerlite_issue_id, issue.id)
      : '#'

    // Use the shared advertorial HTML generator
    return generateAdvertorialHtml(
      {
        title: selectedAd.title,
        body: selectedAd.body || '',
        button_url: selectedAd.button_url || '#',
        image_url: selectedAd.image_url
      },
      {
        primaryColor,
        headingFont,
        bodyFont,
        sectionName,
        linkUrl: trackedUrl
      }
    )
  } catch (error) {
    console.error('Error generating Advertorial section:', error)
    return ''
  }
}

// ==================== AD MODULES (DYNAMIC AD SECTIONS) ====================

/**
 * Generate ad module sections for an issue
 * Uses the block-based renderer for configurable ad layouts
 * @param issue - The issue data
 * @param moduleId - Optional: Generate only for a specific module (used for ordered rendering)
 */
export async function generateAdModulesSection(issue: any, moduleId?: string): Promise<string> {
  try {
    console.log('Generating Ad Modules sections for issue:', issue?.id, moduleId ? `(module: ${moduleId})` : '(all modules)')

    // Fetch colors from business settings
    const { primaryColor, headingFont, bodyFont, websiteUrl } = await fetchBusinessSettings(issue?.publication_id)

    // Build query for ad module selections
    // Uses unified advertisements table
    let query = supabaseAdmin
      .from('issue_module_ads')
      .select(`
        selection_mode,
        selected_at,
        ad_module:ad_modules(
          id,
          name,
          display_order,
          block_order
        ),
        advertisement:advertisements(
          id,
          title,
          body,
          image_url,
          button_text,
          button_url,
          company_name,
          advertiser:advertisers(
            id,
            company_name,
            logo_url,
            website_url
          )
        )
      `)
      .eq('issue_id', issue.id)

    // Filter to specific module if provided
    if (moduleId) {
      query = query.eq('ad_module_id', moduleId)
    }

    const { data: selections, error } = await query.order('ad_module(display_order)', { ascending: true })

    if (error) {
      console.error('Error fetching ad module selections:', error)
      return ''
    }

    if (!selections || selections.length === 0) {
      console.log('No ad module selections found for issue')
      return ''
    }

    console.log(`Found ${selections.length} ad module selections`)

    // Generate HTML for each ad module
    const sectionsHtml: string[] = []

    for (const selection of selections) {
      const module = selection.ad_module as any
      const ad = selection.advertisement as any

      if (!module) {
        console.log('Skipping selection without module')
        continue
      }

      // If no ad selected (manual mode not filled), skip this section
      if (!ad) {
        console.log(`No ad selected for module "${module.name}" (mode: ${selection.selection_mode})`)
        continue
      }

      // Generate tracked URL for the ad
      const buttonUrl = ad.button_url || '#'
      const trackedUrl = buttonUrl !== '#'
        ? wrapTrackingUrl(buttonUrl, module.name, issue.date, issue.mailerlite_issue_id, issue.id)
        : '#'

      // Get block order from module config
      const blockOrder = (module.block_order || ['title', 'image', 'body', 'button']) as AdBlockType[]
      console.log(`[AdModules] Module "${module.name}" block_order:`, module.block_order, '-> using:', blockOrder)

      // Use the AdModuleRenderer for block-based rendering
      const html = AdModuleRenderer.renderForArchive(
        module.name,
        {
          title: ad.title,
          body: ad.body,
          image_url: ad.image_url,
          button_text: ad.button_text,
          button_url: trackedUrl // Use tracked URL
        },
        blockOrder,
        {
          primaryColor,
          headingFont,
          bodyFont
        }
      )

      sectionsHtml.push(html)
    }

    return sectionsHtml.join('')

  } catch (error) {
    console.error('Error generating Ad Modules sections:', error)
    return ''
  }
}

// ==================== BREAKING NEWS ====================

function getBreakingNewsEmoji(title: string, description: string): string {
  const text = (title + ' ' + description).toLowerCase()

  // Regulatory & Compliance
  if (text.includes('irs') || text.includes('sec') || text.includes('fasb')) return '⚖️'
  if (text.includes('regulation') || text.includes('compliance')) return '📋'
  if (text.includes('audit') || text.includes('auditing')) return '🔍'

  // Tax Related
  if (text.includes('tax')) return '💰'

  // Technology & AI
  if (text.includes('ai') || text.includes('artificial intelligence')) return '🤖'
  if (text.includes('software') || text.includes('technology')) return '💻'
  if (text.includes('cybersecurity') || text.includes('security')) return '🔐'

  // Business & Finance
  if (text.includes('accounting') || text.includes('cpa')) return '📊'
  if (text.includes('acquisition') || text.includes('merger')) return '🤝'
  if (text.includes('scandal') || text.includes('fraud')) return '⚠️'
  if (text.includes('lawsuit') || text.includes('court')) return '⚖️'

  // Default breaking news icon
  return '🔴'
}

export async function generateBreakingNewsSection(issue: any): Promise<string> {
  try {
    console.log('Generating Breaking News section for issue:', issue?.id)

    // Fetch colors from business settings (using publication_id if available)
    const { primaryColor, headingFont, bodyFont } = await fetchBusinessSettings(issue?.publication_id)

    // Fetch selected Breaking News articles
    const { data: selections } = await supabaseAdmin
      .from('issue_breaking_news')
      .select(`
        *,
        post:rss_posts(
          id,
          title,
          ai_title,
          ai_summary,
          description,
          source_url,
          breaking_news_score
        )
      `)
      .eq('issue_id', issue.id)
      .eq('section', 'breaking')
      .order('position', { ascending: true })
      .limit(3)

    if (!selections || selections.length === 0) {
      console.log('No Breaking News articles selected, skipping section')
      return ''
    }

    console.log(`Found ${selections.length} Breaking News articles`)

    // Generate HTML for each article
    const articlesHtml = selections.map((selection: any) => {
      const post = selection.post
      const title = post.ai_title || post.title
      const summary = post.ai_summary || post.description
      const sourceUrl = post.source_url || '#'
      const emoji = getBreakingNewsEmoji(title, summary)

      // Wrap URL with tracking
      const trackedUrl = sourceUrl !== '#'
        ? wrapTrackingUrl(sourceUrl, 'Breaking News', issue.date, issue.mailerlite_issue_id, issue.id)
        : '#'

      return `
<tr class='row'>
  <td class='column' style='padding:8px; vertical-align: top;'>
    <table width='100%' cellpadding='0' cellspacing='0' style='border: 1px solid #ddd; border-radius: 8px; background: #fff; font-family: ${bodyFont}; font-size: 16px; line-height: 26px; box-shadow:0 4px 12px rgba(0,0,0,.15);'>
      <tr><td style='padding: 10px 10px 4px; font-size: 20px; font-weight: bold;'>${emoji} <a href='${trackedUrl}' style='color: #000; text-decoration: underline;'>${title}</a></td></tr>
      <tr><td style='padding: 0 10px 10px;'>${summary}</td></tr>
    </table>
  </td>
</tr>`
    }).join('')

    return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; background-color: #f7f7f7;">
        <tr>
          <td style="padding: 8px; background-color: ${primaryColor}; border-top-left-radius: 10px; border-top-right-radius: 10px;">
            <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: ${headingFont}; color: #ffffff; margin: 0; padding: 0;">Breaking News</h2>
          </td>
        </tr>
        ${articlesHtml}
      </table>
    </td>
  </tr>
</table>
<br>`

  } catch (error) {
    console.error('Error generating Breaking News section:', error)
    return ''
  }
}

// ==================== BEYOND THE FEED ====================

export async function generateBeyondTheFeedSection(issue: any): Promise<string> {
  try {
    console.log('Generating Beyond the Feed section for issue:', issue?.id)

    // Fetch colors from business settings (using publication_id if available)
    const { primaryColor, headingFont, bodyFont } = await fetchBusinessSettings(issue?.publication_id)

    // Fetch selected Beyond the Feed articles
    const { data: selections } = await supabaseAdmin
      .from('issue_breaking_news')
      .select(`
        *,
        post:rss_posts(
          id,
          title,
          ai_title,
          ai_summary,
          description,
          source_url,
          breaking_news_score
        )
      `)
      .eq('issue_id', issue.id)
      .eq('section', 'beyond_feed')
      .order('position', { ascending: true })
      .limit(3)

    if (!selections || selections.length === 0) {
      console.log('No Beyond the Feed articles selected, skipping section')
      return ''
    }

    console.log(`Found ${selections.length} Beyond the Feed articles`)

    // Generate HTML for each article
    const articlesHtml = selections.map((selection: any) => {
      const post = selection.post
      const title = post.ai_title || post.title
      const summary = post.ai_summary || post.description
      const sourceUrl = post.source_url || '#'
      const emoji = getBreakingNewsEmoji(title, summary)

      // Wrap URL with tracking
      const trackedUrl = sourceUrl !== '#'
        ? wrapTrackingUrl(sourceUrl, 'Beyond the Feed', issue.date, issue.mailerlite_issue_id, issue.id)
        : '#'

      return `
<tr class='row'>
  <td class='column' style='padding:8px; vertical-align: top;'>
    <table width='100%' cellpadding='0' cellspacing='0' style='border: 1px solid #ddd; border-radius: 8px; background: #fff; font-family: ${bodyFont}; font-size: 16px; line-height: 26px; box-shadow:0 4px 12px rgba(0,0,0,.15);'>
      <tr><td style='padding: 10px 10px 4px; font-size: 20px; font-weight: bold;'>${emoji} <a href='${trackedUrl}' style='color: #000; text-decoration: underline;'>${title}</a></td></tr>
      <tr><td style='padding: 0 10px 10px;'>${summary}</td></tr>
    </table>
  </td>
</tr>`
    }).join('')

    return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; background-color: #f7f7f7;">
        <tr>
          <td style="padding: 8px; background-color: ${primaryColor}; border-top-left-radius: 10px; border-top-right-radius: 10px;">
            <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: ${headingFont}; color: #ffffff; margin: 0; padding: 0;">Beyond the Feed</h2>
          </td>
        </tr>
        ${articlesHtml}
      </table>
    </td>
  </tr>
</table>
<br>`

  } catch (error) {
    console.error('Error generating Beyond the Feed section:', error)
    return ''
  }
}

// ==================== AI APPS ====================

function getAIAppEmoji(appName: string, category: string, description: string): string {
  const text = (appName + ' ' + category + ' ' + description).toLowerCase()

  // Category-based emojis
  if (category.toLowerCase().includes('payroll')) return '💵'
  if (category.toLowerCase().includes('hr')) return '👥'
  if (category.toLowerCase().includes('accounting')) return '📊'
  if (category.toLowerCase().includes('finance')) return '💰'
  if (category.toLowerCase().includes('banking')) return '🏦'
  if (category.toLowerCase().includes('client management')) return '🤝'

  // Functionality-based emojis
  if (text.includes('elearning') || text.includes('education') || text.includes('training')) return '🎓'
  if (text.includes('calendar') || text.includes('schedule')) return '📅'
  if (text.includes('animation') || text.includes('photo') || text.includes('image')) return '🖼️'
  if (text.includes('language') || text.includes('translation')) return '🌎'
  if (text.includes('video') || text.includes('film')) return '🎬'
  if (text.includes('writing') || text.includes('content')) return '✍️'
  if (text.includes('voice') || text.includes('audio')) return '🎙️'
  if (text.includes('design') || text.includes('creative')) return '🎨'
  if (text.includes('data') || text.includes('analytics')) return '📈'
  if (text.includes('automation') || text.includes('workflow')) return '⚙️'
  if (text.includes('communication') || text.includes('chat')) return '💬'
  if (text.includes('project') || text.includes('task')) return '📋'
  if (text.includes('productivity')) return '⚡'

  // Default productivity icon
  return '🔧'
}

export async function generateAIAppsSection(issue: any): Promise<string> {
  try {
    console.log('Generating AI Apps section for issue:', issue?.id)

    // Import AppSelector
    const { AppSelector } = await import('./app-selector')

    // Fetch colors and fonts from business settings (using publication_id if available)
    const { primaryColor, secondaryColor, headingFont, bodyFont } = await fetchBusinessSettings(issue?.publication_id)

    // Get the selected apps for this issue
    const apps = await AppSelector.getAppsForissue(issue.id)

    if (!apps || apps.length === 0) {
      console.log('No AI apps selected for this issue, skipping AI Apps section')
      return ''
    }

    console.log(`Found ${apps.length} AI apps for issue`)

    // Generate numbered list HTML
    const appsHtml = apps.map((app, index) => {
      const emoji = getAIAppEmoji(app.app_name, app.category || '', app.description || '')
      const appUrl = app.app_url || '#'

      // Wrap URL with tracking
      const trackedUrl = appUrl !== '#'
        ? wrapTrackingUrl(appUrl, 'AI Apps', issue.date, issue.mailerlite_issue_id, issue.id)
        : '#'

      // Format: number. emoji Title Description
      return `
      <div style='padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-size: 16px; line-height: 24px; font-family: ${bodyFont};'>
        <strong>${index + 1}.</strong> ${emoji} <a href='${trackedUrl}' style='color: ${secondaryColor}; text-decoration: underline; font-weight: bold;'>${app.app_name}</a> ${app.description || 'AI-powered application'}
      </div>`
    }).join('')

    return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ddd; border-radius: 10px; margin-top: 10px; background-color: #fff; box-shadow:0 4px 12px rgba(0,0,0,.15);">
        <tr>
          <td style="padding: 8px; background-color: ${primaryColor}; border-top-left-radius: 10px; border-top-right-radius: 10px;">
            <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: ${headingFont}; color: #ffffff; margin: 0; padding: 0;">AI Applications</h2>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 10px 10px 10px;">
            ${appsHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<br>`

  } catch (error) {
    console.error('Error generating AI Apps section:', error)
    return ''
  }
}

// ==================== PROMPT IDEAS ====================

export async function generatePromptIdeasSection(issue: any): Promise<string> {
  try {
    console.log('Generating Prompt Ideas section for issue:', issue?.id)

    // Import PromptSelector
    const { PromptSelector } = await import('./prompt-selector')

    // Fetch colors from business settings (using publication_id if available)
    const { primaryColor, headingFont, bodyFont } = await fetchBusinessSettings(issue?.publication_id)

    // Get the selected prompt for this issue
    const prompt = await PromptSelector.getPromptForissue(issue.id)

    if (!prompt) {
      console.log('No prompt selected for this issue, skipping Prompt Ideas section')
      return ''
    }

    console.log(`Found prompt: ${prompt.title}`)

    // Convert line breaks to <br> tags for email compatibility
    const formattedPromptText = prompt.prompt_text.replace(/\n/g, '<br>')

    // Generate HTML with terminal styling (email-safe)
    return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ddd; border-radius: 10px; margin-top: 10px; background-color: #fff; box-shadow:0 4px 12px rgba(0,0,0,.15);">
        <tr>
          <td style="padding: 8px; background-color: ${primaryColor}; border-top-left-radius: 10px; border-top-right-radius: 10px;">
            <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: ${headingFont}; color: #ffffff; margin: 0; padding: 0;">Prompt Ideas</h2>
          </td>
        </tr>
        <tr class='row'>
          <td class='column' style='padding:8px; vertical-align: top;'>
            <table width='100%' cellpadding='0' cellspacing='0' style='font-family: ${bodyFont}; font-size: 16px; line-height: 26px;'>
              <tr><td style='padding: 10px 10px 8px; font-size: 20px; font-weight: bold; text-align: center;'>${prompt.title}</td></tr>
              <tr>
                <td align='center' style='padding: 0 10px 10px;'>
                  <table width="100%" cellpadding='0' cellspacing='0' style='max-width: 550px; margin: 0 auto;'>
                    <tr>
                      <td bgcolor="#000000" style='background-color: #000000; color: #FFFFFF; padding: 16px; border-radius: 6px; border: 2px solid #333; font-family: Courier New, Courier, monospace; font-size: 14px; line-height: 22px; text-align: left;'>${formattedPromptText}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<br>`

  } catch (error) {
    console.error('Error generating Prompt Ideas section:', error)
    return ''
  }
}

// ==================== ROAD WORK ====================
// Feature not needed in this newsletter

export async function generateRoadWorkSection(issue: any): Promise<string> {
  console.log('Road Work section disabled for AI Accounting Daily')
  return ''
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
        'primary_color', 'newsletter_name', 'business_name',
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
        'primary_color', 'newsletter_name', 'business_name',
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
  const currentYear = new Date().getFullYear()

  // Build social media icons array (only include if enabled and URL exists)
  const socialIcons = []

  // Facebook
  if (settingsMap.facebook_enabled === 'true' && settingsMap.facebook_url) {
    const trackedUrl = issueDate ? wrapTrackingUrl(settingsMap.facebook_url, 'Footer', issueDate, issueId) : settingsMap.facebook_url
    socialIcons.push(`
      <td style="padding: 0 8px;">
        <a href="${trackedUrl}" target="_blank">
          <img src="https://raw.githubusercontent.com/Venture-Formations/aiprodaily/master/public/images/social/facebook_light.png" alt="Facebook" width="24" height="24" style="border: none; display: block;">
        </a>
      </td>`)
  }

  // Twitter/X
  if (settingsMap.twitter_enabled === 'true' && settingsMap.twitter_url) {
    const trackedUrl = issueDate ? wrapTrackingUrl(settingsMap.twitter_url, 'Footer', issueDate, issueId) : settingsMap.twitter_url
    socialIcons.push(`
      <td style="padding: 0 8px;">
        <a href="${trackedUrl}" target="_blank">
          <img src="https://raw.githubusercontent.com/Venture-Formations/aiprodaily/master/public/images/social/twitter_light.png" alt="Twitter/X" width="24" height="24" style="border: none; display: block;">
        </a>
      </td>`)
  }

  // LinkedIn
  if (settingsMap.linkedin_enabled === 'true' && settingsMap.linkedin_url) {
    const trackedUrl = issueDate ? wrapTrackingUrl(settingsMap.linkedin_url, 'Footer', issueDate, issueId) : settingsMap.linkedin_url
    socialIcons.push(`
      <td style="padding: 0 8px;">
        <a href="${trackedUrl}" target="_blank">
          <img src="https://raw.githubusercontent.com/Venture-Formations/aiprodaily/master/public/images/social/linkedin_light.png" alt="LinkedIn" width="24" height="24" style="border: none; display: block;">
        </a>
      </td>`)
  }

  // Instagram
  if (settingsMap.instagram_enabled === 'true' && settingsMap.instagram_url) {
    const trackedUrl = issueDate ? wrapTrackingUrl(settingsMap.instagram_url, 'Footer', issueDate, issueId) : settingsMap.instagram_url
    socialIcons.push(`
      <td style="padding: 0 8px;">
        <a href="${trackedUrl}" target="_blank">
          <img src="https://raw.githubusercontent.com/Venture-Formations/aiprodaily/master/public/images/social/instagram_light.png" alt="Instagram" width="24" height="24" style="border: none; display: block;">
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

  return `
${socialMediaSection}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:770px;margin:0 auto;">
  <tr>
    <td style="font-family: Arial, sans-serif; font-size: 12px; color: #777; text-align: center; padding: 20px 10px; border-top: 1px solid #ccc; background-color: #ffffff;">
      <p style="margin: 0;text-align: center;">You're receiving this email because you subscribed to <strong>${newsletterName}</strong>.</p>
      <p style="margin: 5px 0 0;text-align: center;">
        <a href="{$unsubscribe}" style='text-decoration: underline;'>Unsubscribe</a>
      </p>
      <p style="margin: 5px;text-align: center;">©${currentYear} ${businessName}, all rights reserved</p>
    </td>
  </tr>
</table>
  </div>
</body>
</html>`
}
