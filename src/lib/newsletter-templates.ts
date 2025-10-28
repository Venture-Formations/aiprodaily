// Shared newsletter template generation functions
// Used by both preview route and MailerLite service for consistency

import { supabaseAdmin } from './supabase'
import { wrapTrackingUrl } from './url-tracking'
import { AdScheduler } from './ad-scheduler'

// ==================== UTILITY FUNCTIONS ====================

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

export async function generateNewsletterHeader(formattedDate: string, campaignDate?: string, campaignId?: string): Promise<string> {
  // Fetch business settings for header image, primary color, and website URL
  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .in('key', ['header_image_url', 'primary_color', 'newsletter_name', 'website_url'])

  const settingsMap: Record<string, string> = {}
  settings?.forEach(setting => {
    settingsMap[setting.key] = setting.value
  })

  const headerImageUrl = settingsMap.header_image_url || 'https://raw.githubusercontent.com/VFDavid/STCScoop/refs/heads/main/STCSCOOP_Logo_824X148_clear.png'
  const primaryColor = settingsMap.primary_color || '#1877F2'
  const newsletterName = settingsMap.newsletter_name || 'St. Cloud Scoop'
  const websiteUrl = settingsMap.website_url || 'https://www.aiaccountingdaily.com'

  // Add tracking to Sign Up link if campaign info available
  const signUpUrl = campaignDate
    ? wrapTrackingUrl(websiteUrl, 'Header', campaignDate, campaignId)
    : websiteUrl

  return `<html>
<head>
<style>
@media (min-width:621px){
  /* Add padding on desktop only */
  .email-wrapper {
    padding-left:10px !important;
    padding-right:10px !important;
  }
}
</style>
</head>
<body style='margin:0!important;padding:0!important;background-color:#f7f7f7;'>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f7f7f7" style="background-color:#f7f7f7;">
  <tr>
    <td class="email-wrapper" style="padding:0;">
     <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
       <tr>
         <td style="font-weight:bold;font-family:Arial,sans-serif;padding:5px 0;">
           <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
             <tr>
               <!-- spacer cell -->
               <td width="10">&nbsp;</td>
               <!-- content cell -->
               <td align="right">
                 <a href="{$url}" style="color:#000;text-decoration:underline;">View Online</a>&nbsp;|&nbsp;
                 <a href="${signUpUrl}" style="color:#000;text-decoration:underline;">Sign Up</a>&nbsp;|&nbsp;
                 <a href="{$forward}" style="color:#000;text-decoration:underline;">Share</a>
               </td>
             </tr>
           </table>
         </td>
       </tr>
     </table>
     <div style='width:100%;max-width:750px;margin:0 auto;padding:0px;'>
       <table width='100%' cellpadding='0' cellspacing='0' style='font-family:Arial,sans-serif;'>
         <tr>
           <td align='center' style='padding:0;'>
             <img alt='${newsletterName}' src='${headerImageUrl}' style='display:block;width:100%;max-width:500px;height:auto;margin:0 auto;'/>
           </td>
         </tr>
       </table>
       <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
         <tr>
           <td align="center" style="padding:5px 0;font-family:Arial,sans-serif;font-weight:bold;font-size:16px;color:#1C293D;text-align:center;">${formattedDate}
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

// ==================== HELPER: FETCH COLORS ====================

async function fetchBusinessColors(): Promise<{ primaryColor: string; secondaryColor: string }> {
  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .in('key', ['primary_color', 'secondary_color'])

  const settingsMap: Record<string, string> = {}
  settings?.forEach(setting => {
    settingsMap[setting.key] = setting.value
  })

  return {
    primaryColor: settingsMap.primary_color || '#1877F2',
    secondaryColor: settingsMap.secondary_color || '#10B981'
  }
}

// ==================== WELCOME SECTION ====================

export async function generateWelcomeSection(
  intro: string | null,
  tagline: string | null,
  summary: string | null
): Promise<string> {
  // Skip if all 3 parts are empty
  if ((!intro || intro.trim() === '') &&
      (!tagline || tagline.trim() === '') &&
      (!summary || summary.trim() === '')) {
    return ''
  }

  // Prepend personalized greeting to intro
  const greeting = `Hey, {$name|default('Accounting Pro')}!`
  const fullIntro = intro && intro.trim() ? `${greeting} ${intro.trim()}` : greeting

  // Build HTML for each part (only include non-empty parts)
  const introPart = greeting
    ? `<div style="font-size: 16px; line-height: 24px; color: #333; font-family: Arial, sans-serif; margin-bottom: 8px;">${greeting.replace(/\n/g, '<br>')}</div>`
    : ''

  const taglinePart = tagline && tagline.trim()
    ? `<div style="font-size: 16px; line-height: 24px; color: #333; font-family: Arial, sans-serif; font-weight: bold; margin-bottom: 8px;">${tagline.replace(/\n/g, '<br>')}</div>`
    : ''

  const summaryPart = summary && summary.trim()
    ? `<div style="font-size: 16px; line-height: 24px; color: #333; font-family: Arial, sans-serif;">${summary.replace(/\n/g, '<br>')}</div>`
    : ''

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ddd; border-radius: 10px; margin-top: 10px; max-width: 750px; margin: 0 auto; background-color: #fff; box-shadow:0 4px 12px rgba(0,0,0,.15);">
  <tr>
    <td style="padding: 20px;">
      ${introPart}
      ${taglinePart}
      ${summaryPart}
    </td>
  </tr>
</table>
<br>`
}

// ==================== PRIMARY ARTICLES SECTION ====================

export async function generatePrimaryArticlesSection(articles: any[], campaignDate: string, campaignId: string | undefined, sectionName: string): Promise<string> {
  if (!articles || articles.length === 0) {
    return ''
  }

  // Fetch colors from business settings
  const { primaryColor, secondaryColor } = await fetchBusinessColors()

  const articlesHtml = articles.map((article) => {
    const headline = article.headline || 'No headline'
    const content = article.content || ''
    const sourceUrl = article.rss_post?.source_url || '#'
    const emoji = getArticleEmoji(headline, content)

    // Wrap URL with tracking
    const trackedUrl = sourceUrl !== '#' ? wrapTrackingUrl(sourceUrl, sectionName, campaignDate, campaignId) : '#'

    return `
      <div style='padding: 16px 0; border-bottom: 1px solid #e0e0e0;'>
        <div style='font-size: 18px; font-weight: bold; margin-bottom: 8px;'>
          ${emoji} <a href='${trackedUrl}' style='color: ${secondaryColor}; text-decoration: underline;'>${headline}</a>
        </div>
        <div style='font-size: 16px; line-height: 24px; color: #333;'>${content}</div>
      </div>`
  }).join('')

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ddd; border-radius: 10px; margin-top: 10px; max-width: 750px; margin: 0 auto; background-color: #fff; box-shadow:0 4px 12px rgba(0,0,0,.15);">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: ${primaryColor}; margin: 0; padding: 0;">${sectionName}</h2>
    </td>
  </tr>
  <tr>
    <td style="padding: 0 20px 20px 20px;">
      ${articlesHtml}
    </td>
  </tr>
</table>
<br>`
}

// ==================== SECONDARY ARTICLES SECTION ====================

export async function generateSecondaryArticlesSection(campaign: any, sectionName: string): Promise<string> {
  // Fetch secondary articles for this campaign
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
    .eq('campaign_id', campaign.id)
    .eq('is_active', true)
    .order('rank', { ascending: true })

  if (!secondaryArticles || secondaryArticles.length === 0) {
    return ''
  }

  // Fetch colors from business settings
  const { primaryColor, secondaryColor } = await fetchBusinessColors()

  const articlesHtml = secondaryArticles.map((article) => {
    const headline = article.headline || 'No headline'
    const content = article.content || ''
    const rssPost = Array.isArray(article.rss_post) ? article.rss_post[0] : article.rss_post
    const sourceUrl = rssPost?.source_url || '#'
    const emoji = getArticleEmoji(headline, content)

    // Wrap URL with tracking
    const trackedUrl = sourceUrl !== '#' ? wrapTrackingUrl(sourceUrl, sectionName, campaign.date, campaign.mailerlite_campaign_id) : '#'

    return `
      <div style='padding: 16px 0; border-bottom: 1px solid #e0e0e0;'>
        <div style='font-size: 18px; font-weight: bold; margin-bottom: 8px;'>
          ${emoji} <a href='${trackedUrl}' style='color: ${secondaryColor}; text-decoration: underline;'>${headline}</a>
        </div>
        <div style='font-size: 16px; line-height: 24px; color: #333;'>${content}</div>
      </div>`
  }).join('')

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ddd; border-radius: 10px; margin-top: 10px; max-width: 750px; margin: 0 auto; background-color: #fff; box-shadow:0 4px 12px rgba(0,0,0,.15);">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: ${primaryColor}; margin: 0; padding: 0;">${sectionName}</h2>
    </td>
  </tr>
  <tr>
    <td style="padding: 0 20px 20px 20px;">
      ${articlesHtml}
    </td>
  </tr>
</table>
<br>`
}

// ==================== LOCAL EVENTS ====================

export async function generateLocalEventsSection(campaign: any): Promise<string> {
  console.log('Generating Local Events section for campaign:', campaign?.id)

  // Fetch colors from business settings
  const { primaryColor } = await fetchBusinessColors()

  // Calculate the 3-day date range in Central Time
  const campaignDate = new Date(campaign.date + 'T00:00:00-05:00')
  const dates: string[] = []
  for (let i = 0; i < 3; i++) {
    const currentDate = new Date(campaignDate)
    currentDate.setDate(currentDate.getDate() + i)
    dates.push(currentDate.toISOString().split('T')[0])
  }

  const startDate = dates[0]
  const endDate = dates[2]

  console.log(`Looking for events between ${startDate} and ${endDate}`)

  // Fetch all active events in date range
  const { data: availableEvents } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('active', true)
    .gte('start_date', startDate + 'T00:00:00')
    .lte('start_date', endDate + 'T23:59:59')
    .order('start_date', { ascending: true })

  console.log(`Found ${availableEvents?.length || 0} events for date range ${startDate} to ${endDate}`)

  // Get the campaign events to determine which are selected and featured
  const { data: campaignEvents } = await supabaseAdmin
    .from('campaign_events')
    .select('*')
    .eq('campaign_id', campaign.id)

  // Create campaign events lookup
  const campaignEventsMap = new Map()
  campaignEvents?.forEach(ce => {
    const key = `${ce.event_id}_${ce.event_date}`
    campaignEventsMap.set(key, ce)
  })

  console.log('Campaign events loaded:', campaignEvents?.length || 0)

  // Filter events by date and selection status
  const eventsByDate: { [key: string]: any[] } = {}

  dates.forEach(date => {
    console.log(`Processing date: ${date}`)

    // Filter events that occur on this date
    const dateStart = new Date(date + 'T00:00:00-05:00')
    const dateEnd = new Date(date + 'T23:59:59-05:00')

    const eventsForDate = (availableEvents || []).filter(event => {
      const eventStart = new Date(event.start_date)
      const eventEnd = event.end_date ? new Date(event.end_date) : eventStart
      return (eventStart <= dateEnd && eventEnd >= dateStart)
    })

    console.log(`Found ${eventsForDate.length} available events for ${date}`)

    // Only include events that are selected for the campaign
    const selectedEvents = eventsForDate
      .map(event => {
        const lookupKey = `${event.id}_${date}`
        const campaignEvent = campaignEventsMap.get(lookupKey)

        if (campaignEvent && campaignEvent.is_selected) {
          console.log(`Including event: ${event.title} (featured: ${campaignEvent.is_featured}, order: ${campaignEvent.display_order})`)
          return {
            ...event,
            is_featured: campaignEvent.is_featured,
            display_order: campaignEvent.display_order
          }
        }
        return null
      })
      .filter(Boolean)
      .sort((a, b) => (a.display_order || 999) - (b.display_order || 999))

    console.log(`Selected ${selectedEvents.length} events for ${date}`)

    if (selectedEvents.length > 0) {
      eventsByDate[date] = selectedEvents
    }
  })

  console.log('Events by date:', Object.keys(eventsByDate).map(date => `${date}: ${eventsByDate[date].length} events`))

  if (Object.keys(eventsByDate).length === 0) {
    console.log('No events to display')
    return ''
  }

  // Generate each day column
  const dayColumns = dates.map(date => {
    const events = eventsByDate[date] || []
    const featuredEvents = events.filter(event => event.is_featured)
    const regularEvents = events.filter(event => !event.is_featured)

    // Generate featured events HTML (can be multiple)
    const featuredHtml = featuredEvents.map(featuredEvent => {
      // Link to our individual event page with tracking
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.aiaccountingdaily.com'
      const eventPageUrl = `${baseUrl}/events/${featuredEvent.id}`
      const eventUrl = wrapTrackingUrl(eventPageUrl, 'Local Events', campaign.date, campaign.mailerlite_campaign_id)

      return `
    <tr>
      <td style='padding:0; border-top: 1px solid #eee;'>
        <div style='padding:8px 16px; background:#E8F0FE; border:2px solid ${primaryColor}; border-radius:6px;'>
          ${featuredEvent.cropped_image_url ? `
          <img src='${featuredEvent.cropped_image_url}' alt='${featuredEvent.title}' style='width:100%; max-width:400px; height:auto; object-fit:cover; border-radius:4px; border:1px solid ${primaryColor}; display:block; margin-bottom:8px;' />
          <span style='font-size: 16px;'>${getEventEmoji(featuredEvent.title, featuredEvent.venue)} <strong>${featuredEvent.title}</strong></span><br>
          <span style='font-size:14px;'><a href='${eventUrl}' style='color: #000; text-decoration: underline;'>${formatEventTime(featuredEvent.start_date, featuredEvent.end_date)}</a>  | ${featuredEvent.venue || 'TBA'}</span><br><br>${(featuredEvent.event_summary || featuredEvent.description) ? `<span style='font-size:13px;'>${featuredEvent.event_summary || featuredEvent.description}</span><br>` : ''}
          ` : `
          <span style='font-size: 16px;'>${getEventEmoji(featuredEvent.title, featuredEvent.venue)} <strong>${featuredEvent.title}</strong></span><br>
          <span style='font-size:14px;'><a href='${eventUrl}' style='color: #000; text-decoration: underline;'>${formatEventTime(featuredEvent.start_date, featuredEvent.end_date)}</a>  | ${featuredEvent.venue || 'TBA'}</span><br><br>${(featuredEvent.event_summary || featuredEvent.description) ? `<span style='font-size:13px;'>${featuredEvent.event_summary || featuredEvent.description}</span><br>` : ''}
          `}
        </div>
      </td>
    </tr>`
    }).join('')

    // Generate regular events HTML
    const regularEventsHtml = regularEvents.map((event: any) => {
      // Link to our individual event page with tracking
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.aiaccountingdaily.com'
      const eventPageUrl = `${baseUrl}/events/${event.id}`
      const eventUrl = wrapTrackingUrl(eventPageUrl, 'Local Events', campaign.date, campaign.mailerlite_campaign_id)

      return `
    <tr>
      <td style='padding: 8px 16px; border-top: 1px solid #eee;'>
        <span style='font-size: 16px;'>${getEventEmoji(event.title, event.venue)} <strong>${event.title}</strong></span><br>
        <span style='font-size:14px;'><a href='${eventUrl}' style='color: #000; text-decoration: underline;'>${formatEventTime(event.start_date, event.end_date)}</a>  | ${event.venue || 'TBA'}</span>
      </td>
    </tr>`
    }).join('')

    return `
<td class='column' style='padding:8px; vertical-align: top;'>
  <table width='100%' cellpadding='0' cellspacing='0' style='table-layout: fixed; border: 1px solid #ddd; border-radius: 8px; background: #fff; height: 100%; font-family: Arial, sans-serif; font-size: 16px; line-height: 26px; box-shadow:0 4px 12px rgba(0,0,0,.15);'>
    <tr>
      <td style='background: #F8F9FA; padding: 8px; text-align: center; font-weight: normal; font-size: 16px; line-height: 26px; color: #3C4043; border-top-left-radius: 8px; border-top-right-radius: 8px;'>${formatEventDate(date)}</td>
    </tr>
    ${featuredHtml}
    ${regularEventsHtml}
  </table>
</td>`
  }).join(' ')

  // Add tracking to event action buttons
  const viewAllEventsUrl = wrapTrackingUrl('https://events.stcscoop.com/events/view', 'Local Events', campaign.date, campaign.mailerlite_campaign_id)
  const submitEventUrl = wrapTrackingUrl('https://events.stcscoop.com/events/submit', 'Local Events', campaign.date, campaign.mailerlite_campaign_id)

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 750px; margin: 0 auto; background-color: #f7f7f7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: ${primaryColor}; margin: 0; padding: 0;">Local Events</h2>
    </td>
  </tr><tr class="row">${dayColumns}
</td></table>
<div style="text-align: center; padding: 20px 10px; max-width: 750px; margin: 0 auto;">
  <a href="${viewAllEventsUrl}" style="display: inline-block; background-color: ${primaryColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 0 10px; font-family: Arial, sans-serif;">View All Events</a>
  <a href="${submitEventUrl}" style="display: inline-block; background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 0 10px; font-family: Arial, sans-serif;">Submit Your Event</a>
</div>
<br>`
}

// ==================== WORDLE ====================

export async function generateWordleSection(campaign: any): Promise<string> {
  try {
    console.log('Generating Wordle section for campaign:', campaign?.id)

    // Fetch colors from business settings
    const { primaryColor } = await fetchBusinessColors()

    // Get yesterday's date from the newsletter date (since this is for "Yesterday's Wordle")
    const newsletterDate = new Date(campaign.date + 'T00:00:00')
    const yesterday = new Date(newsletterDate)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayDate = yesterday.toISOString().split('T')[0]

    console.log('Looking for Wordle data for date:', yesterdayDate)

    // Fetch Wordle data for yesterday
    const { data: wordleData, error } = await supabaseAdmin
      .from('wordle')
      .select('*')
      .eq('date', yesterdayDate)
      .single()

    if (error || !wordleData) {
      console.log('No Wordle data found for yesterday:', yesterdayDate, 'excluding Wordle section')
      return '' // Don't include section if no data
    }

    console.log('Found Wordle data:', wordleData.word)

    // Generate the HTML using the template structure
    const wordleCard = `<table width='100%' cellpadding='0' cellspacing='0' style='border: 1px solid #ddd; border-radius: 12px; background-color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,.15); font-family: Arial, sans-serif; font-size: 16px; color: #333; line-height: 26px;'>
      <tr><td style='background-color: #F8F9FA; text-align: center; padding: 8px; font-weight: bold; font-size: 24px; color: #3C4043; text-transform: uppercase;'>${wordleData.word}</td></tr>
      <tr><td style='padding: 16px;'>
        <div style='margin-bottom: 12px;'><strong>Definition:</strong> ${wordleData.definition}</div>
        <div><strong>Interesting Fact:</strong> ${wordleData.interesting_fact}</div>
      </td></tr>
    </table>`

    const wordleColumn = `<td class='column' style='padding:8px; vertical-align: top;'>${wordleCard}</td>`

    return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 750px; margin: 0 auto; background-color: #f7f7f7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: ${primaryColor}; margin: 0; padding: 0;">Yesterday's Wordle</h2>
    </td>
  </tr>
  <tr class="row">${wordleColumn}</tr>
</table>
<br>`

  } catch (error) {
    console.error('Error generating Wordle section:', error)
    return '' // Return empty string on error to not break the newsletter
  }
}

// ==================== MINNESOTA GETAWAYS ====================
// Feature not needed in this newsletter

export async function generateMinnesotaGetawaysSection(campaign: any): Promise<string> {
  console.log('Minnesota Getaways section disabled for AI Accounting Daily')
  return ''
}

// ==================== POLL SECTION ====================

export async function generatePollSection(campaignId: string): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.aiaccountingdaily.com'

  try {
    // Fetch colors from business settings
    const { primaryColor } = await fetchBusinessColors()

    // Get active poll
    const { data: pollData } = await supabaseAdmin
      .from('polls')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!pollData) {
      console.log('No active poll found, skipping poll section')
      return ''
    }

    // Generate button HTML for each option
    const optionsHtml = pollData.options.map((option: string, index: number) => {
      const isLast = index === pollData.options.length - 1
      const paddingStyle = isLast ? 'padding:0;' : 'padding:0 0 8px 0;'

      return `
              <tr>
                <td style="${paddingStyle}">
                  <a href="${baseUrl}/api/polls/${pollData.id}/respond?option=${encodeURIComponent(option)}&amp;campaign_id=${campaignId}&amp;email={$email}"
                     style="display:block; text-decoration:none; background:${primaryColor}; color:#ffffff; font-weight:bold;
                            font-size:16px; line-height:20px; padding:12px; border-radius:8px; text-align:center;">${option}</a>
                </td>
              </tr>`
    }).join('')

    return `
<!-- Poll card -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
  <tr>
    <td style="padding:5px;">
      <!-- Poll Box -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
             style="width:100%; max-width:650px; margin:10px auto; background-color:#E8F0FE;
                    border:2px solid ${primaryColor}; border-radius:10px; font-family:Arial, sans-serif; box-shadow:0 4px 12px rgba(0,0,0,.15);">
        <tr>
          <td style="padding:14px; color:#1a1a1a; font-size:16px; line-height:1.5; text-align:center;">

            <!-- Text Sections -->
            <p style="margin:0 0 6px 0; font-weight:bold; font-size:20px; color:${primaryColor}; text-align:center;">${pollData.title}</p>
            <p style="margin:0 0 14px 0; font-size:16px; color:#333; text-align:center;">
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
<br>`
  } catch (error) {
    console.error('Error generating poll section:', error)
    return ''
  }
}

// ==================== DINING DEALS ====================
// Feature not needed in this newsletter

export async function generateDiningDealsSection(campaign: any): Promise<string> {
  console.log('Dining Deals section disabled for AI Accounting Daily')
  return ''
}

// ==================== COMMUNITY BUSINESS SPOTLIGHT ====================

export async function generateCommunityBusinessSpotlightSection(campaign: any, recordUsage: boolean = false): Promise<string> {
  try {
    console.log('Generating Community Business Spotlight section for campaign:', campaign?.id, 'recordUsage:', recordUsage)

    // Fetch colors from business settings
    const { primaryColor } = await fetchBusinessColors()

    // Check if ad already selected for this campaign
    const { data: existingAd } = await supabaseAdmin
      .from('campaign_advertisements')
      .select('*, advertisement:advertisements(*)')
      .eq('campaign_id', campaign.id)
      .single()

    let selectedAd = existingAd?.advertisement

    // If no ad selected yet, use scheduler to select one
    if (!selectedAd) {
      console.log('No ad selected yet, using scheduler...')
      selectedAd = await AdScheduler.selectAdForCampaign({
        campaignId: campaign.id,
        campaignDate: campaign.date
      })

      // Record the usage ONLY if recordUsage is true (final campaign creation)
      if (selectedAd && recordUsage) {
        await AdScheduler.recordAdUsage(campaign.id, selectedAd.id, campaign.date)
        console.log(`Selected and recorded ad usage: ${selectedAd.title}`)
      } else if (selectedAd) {
        console.log(`Selected ad (usage NOT recorded - preview only): ${selectedAd.title}`)
      }
    } else {
      console.log(`Using existing ad: ${selectedAd.title}`)
    }

    // If no ad available, return empty section
    if (!selectedAd) {
      console.log('No advertisement available for this campaign')
      return ''
    }

    // Generate HTML for the ad - matching Local Scoop layout
    const businessUrl = selectedAd.business_website || '#'
    const trackedUrl = businessUrl !== '#'
      ? wrapTrackingUrl(businessUrl, 'Community Business Spotlight', campaign.date, campaign.mailerlite_campaign_id)
      : '#'

    const imageUrl = selectedAd.image_url || ''

    // Generate image HTML if valid URL exists
    const imageHtml = imageUrl
      ? `<tr><td style='padding: 0 12px; text-align: center;'><img src='${imageUrl}' alt='${selectedAd.title}' style='max-width: 100%; max-height: 500px; border-radius: 4px;'></td></tr>`
      : ''

    return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 750px; margin: 0 auto; background-color: #f7f7f7;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: ${primaryColor}; margin: 0; padding: 0;">Community Business Spotlight</h2>
    </td>
  </tr>
  <tr class='row'>
    <td class='column' style='padding:8px; vertical-align: top;'>
      <table width='100%' cellpadding='0' cellspacing='0' style='border: 1px solid #ddd; border-radius: 8px; background: #fff; font-family: Arial, sans-serif; font-size: 16px; line-height: 26px; box-shadow:0 4px 12px rgba(0,0,0,.15);'>
        <tr><td style='padding: 12px 12px 4px; font-size: 20px; font-weight: bold;'>${selectedAd.title}</td></tr>
        ${imageHtml}
        <tr><td style='padding: 0 12px 20px;'>${selectedAd.body}${businessUrl !== '#' ? ` (<a href='${trackedUrl}' style='color: #0080FE; text-decoration: none;'>visit website</a>)` : ''}</td></tr>
      </table>
    </td>
  </tr>
</table>
<br>`
  } catch (error) {
    console.error('Error generating Community Business Spotlight section:', error)
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

export async function generateBreakingNewsSection(campaign: any): Promise<string> {
  try {
    console.log('Generating Breaking News section for campaign:', campaign?.id)

    // Fetch colors from business settings
    const { primaryColor } = await fetchBusinessColors()

    // Fetch selected Breaking News articles
    const { data: selections } = await supabaseAdmin
      .from('campaign_breaking_news')
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
      .eq('campaign_id', campaign.id)
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
        ? wrapTrackingUrl(sourceUrl, 'Breaking News', campaign.date, campaign.mailerlite_campaign_id)
        : '#'

      return `
<tr class='row'>
  <td class='column' style='padding:8px; vertical-align: top;'>
    <table width='100%' cellpadding='0' cellspacing='0' style='border: 1px solid #ddd; border-radius: 8px; background: #fff; font-family: Arial, sans-serif; font-size: 16px; line-height: 26px; box-shadow:0 4px 12px rgba(0,0,0,.15);'>
      <tr><td style='padding: 12px 12px 4px; font-size: 20px; font-weight: bold;'>${emoji} <a href='${trackedUrl}' style='color: #000; text-decoration: underline;'>${title}</a></td></tr>
      <tr><td style='padding: 0 12px 20px;'>${summary}</td></tr>
    </table>
  </td>
</tr>`
    }).join('')

    return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 750px; margin: 0 auto; background-color: #f7f7f7;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: ${primaryColor}; margin: 0; padding: 0;">Breaking News</h2>
    </td>
  </tr>
  ${articlesHtml}
</table>
<br>`

  } catch (error) {
    console.error('Error generating Breaking News section:', error)
    return ''
  }
}

// ==================== BEYOND THE FEED ====================

export async function generateBeyondTheFeedSection(campaign: any): Promise<string> {
  try {
    console.log('Generating Beyond the Feed section for campaign:', campaign?.id)

    // Fetch colors from business settings
    const { primaryColor } = await fetchBusinessColors()

    // Fetch selected Beyond the Feed articles
    const { data: selections } = await supabaseAdmin
      .from('campaign_breaking_news')
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
      .eq('campaign_id', campaign.id)
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
        ? wrapTrackingUrl(sourceUrl, 'Beyond the Feed', campaign.date, campaign.mailerlite_campaign_id)
        : '#'

      return `
<tr class='row'>
  <td class='column' style='padding:8px; vertical-align: top;'>
    <table width='100%' cellpadding='0' cellspacing='0' style='border: 1px solid #ddd; border-radius: 8px; background: #fff; font-family: Arial, sans-serif; font-size: 16px; line-height: 26px; box-shadow:0 4px 12px rgba(0,0,0,.15);'>
      <tr><td style='padding: 12px 12px 4px; font-size: 20px; font-weight: bold;'>${emoji} <a href='${trackedUrl}' style='color: #000; text-decoration: underline;'>${title}</a></td></tr>
      <tr><td style='padding: 0 12px 20px;'>${summary}</td></tr>
    </table>
  </td>
</tr>`
    }).join('')

    return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 750px; margin: 0 auto; background-color: #f7f7f7;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: ${primaryColor}; margin: 0; padding: 0;">Beyond the Feed</h2>
    </td>
  </tr>
  ${articlesHtml}
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

export async function generateAIAppsSection(campaign: any): Promise<string> {
  try {
    console.log('Generating AI Apps section for campaign:', campaign?.id)

    // Import AppSelector
    const { AppSelector } = await import('./app-selector')

    // Fetch colors from business settings
    const { primaryColor, secondaryColor } = await fetchBusinessColors()

    // Get the selected apps for this campaign
    const apps = await AppSelector.getAppsForCampaign(campaign.id)

    if (!apps || apps.length === 0) {
      console.log('No AI apps selected for this campaign, skipping AI Apps section')
      return ''
    }

    console.log(`Found ${apps.length} AI apps for campaign`)

    // Generate numbered list HTML
    const appsHtml = apps.map((app, index) => {
      const emoji = getAIAppEmoji(app.app_name, app.category || '', app.description || '')
      const appUrl = app.app_url || '#'

      // Wrap URL with tracking
      const trackedUrl = appUrl !== '#'
        ? wrapTrackingUrl(appUrl, 'AI Apps', campaign.date, campaign.mailerlite_campaign_id)
        : '#'

      // Format: number. emoji Title - Description
      return `
      <div style='padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-size: 16px; line-height: 24px;'>
        <strong>${index + 1}.</strong> ${emoji} <a href='${trackedUrl}' style='color: ${secondaryColor}; text-decoration: underline; font-weight: bold;'>${app.app_name}</a> - ${app.description || 'AI-powered application'}
      </div>`
    }).join('')

    return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ddd; border-radius: 10px; margin-top: 10px; max-width: 750px; margin: 0 auto; background-color: #fff; box-shadow:0 4px 12px rgba(0,0,0,.15);">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: ${primaryColor}; margin: 0; padding: 0;">AI Applications</h2>
    </td>
  </tr>
  <tr>
    <td style="padding: 0 20px 20px 20px;">
      ${appsHtml}
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

export async function generatePromptIdeasSection(campaign: any): Promise<string> {
  try {
    console.log('Generating Prompt Ideas section for campaign:', campaign?.id)

    // Import PromptSelector
    const { PromptSelector } = await import('./prompt-selector')

    // Fetch colors from business settings
    const { primaryColor } = await fetchBusinessColors()

    // Get the selected prompt for this campaign
    const prompt = await PromptSelector.getPromptForCampaign(campaign.id)

    if (!prompt) {
      console.log('No prompt selected for this campaign, skipping Prompt Ideas section')
      return ''
    }

    console.log(`Found prompt: ${prompt.title}`)

    // Convert line breaks to <br> tags for email compatibility
    const formattedPromptText = prompt.prompt_text.replace(/\n/g, '<br>')

    // Generate HTML with terminal styling (email-safe)
    return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ddd; border-radius: 10px; margin-top: 10px; max-width: 750px; margin: 0 auto; background-color: #fff; box-shadow:0 4px 12px rgba(0,0,0,.15);">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: ${primaryColor}; margin: 0; padding: 0;">Prompt Ideas</h2>
    </td>
  </tr>
  <tr class='row'>
    <td class='column' style='padding:8px; vertical-align: top;'>
      <table width='100%' cellpadding='0' cellspacing='0' style='font-family: Arial, sans-serif; font-size: 16px; line-height: 26px;'>
        <tr><td style='padding: 12px 12px 8px; font-size: 20px; font-weight: bold; text-align: center;'>${prompt.title}</td></tr>
        <tr>
          <td align='center' style='padding: 0 12px 12px;'>
            <table width="100%" cellpadding='0' cellspacing='0' style='max-width: 550px; margin: 0 auto;'>
              <tr>
                <td bgcolor="#000000" style='background-color: #000000; color: #00FF00; padding: 16px; border-radius: 6px; border: 2px solid #333; font-family: Courier New, Courier, monospace; font-size: 14px; line-height: 22px; text-align: left;'>${formattedPromptText}</td>
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

export async function generateRoadWorkSection(campaign: any): Promise<string> {
  console.log('Road Work section disabled for AI Accounting Daily')
  return ''
}

// ==================== FOOTER ====================

export async function generateNewsletterFooter(campaignDate?: string, campaignId?: string): Promise<string> {
  // Fetch business settings for primary color, newsletter name, business name, and social media settings
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

  const settingsMap: Record<string, string> = {}
  settings?.forEach(setting => {
    settingsMap[setting.key] = setting.value
  })

  const primaryColor = settingsMap.primary_color || '#1877F2'
  const newsletterName = settingsMap.newsletter_name || 'St. Cloud Scoop'
  const businessName = settingsMap.business_name || 'Venture Formations LLC'
  const currentYear = new Date().getFullYear()

  // Build social media icons array (only include if enabled and URL exists)
  const socialIcons = []

  // Facebook
  if (settingsMap.facebook_enabled === 'true' && settingsMap.facebook_url) {
    const trackedUrl = campaignDate ? wrapTrackingUrl(settingsMap.facebook_url, 'Footer', campaignDate, campaignId) : settingsMap.facebook_url
    socialIcons.push(`
      <td style="padding: 0 8px;">
        <a href="${trackedUrl}" target="_blank">
          <img src="https://raw.githubusercontent.com/Venture-Formations/aiprodaily/refs/heads/master/facebook_light.png" alt="Facebook" width="24" height="24" style="border: none; display: block;">
        </a>
      </td>`)
  }

  // Twitter/X
  if (settingsMap.twitter_enabled === 'true' && settingsMap.twitter_url) {
    const trackedUrl = campaignDate ? wrapTrackingUrl(settingsMap.twitter_url, 'Footer', campaignDate, campaignId) : settingsMap.twitter_url
    socialIcons.push(`
      <td style="padding: 0 8px;">
        <a href="${trackedUrl}" target="_blank">
          <img src="https://raw.githubusercontent.com/Venture-Formations/aiprodaily/refs/heads/master/twitter_light.png" alt="Twitter/X" width="24" height="24" style="border: none; display: block;">
        </a>
      </td>`)
  }

  // LinkedIn
  if (settingsMap.linkedin_enabled === 'true' && settingsMap.linkedin_url) {
    const trackedUrl = campaignDate ? wrapTrackingUrl(settingsMap.linkedin_url, 'Footer', campaignDate, campaignId) : settingsMap.linkedin_url
    socialIcons.push(`
      <td style="padding: 0 8px;">
        <a href="${trackedUrl}" target="_blank">
          <img src="https://raw.githubusercontent.com/Venture-Formations/aiprodaily/refs/heads/master/linkedin_light.png" alt="LinkedIn" width="24" height="24" style="border: none; display: block;">
        </a>
      </td>`)
  }

  // Instagram
  if (settingsMap.instagram_enabled === 'true' && settingsMap.instagram_url) {
    const trackedUrl = campaignDate ? wrapTrackingUrl(settingsMap.instagram_url, 'Footer', campaignDate, campaignId) : settingsMap.instagram_url
    socialIcons.push(`
      <td style="padding: 0 8px;">
        <a href="${trackedUrl}" target="_blank">
          <img src="https://raw.githubusercontent.com/Venture-Formations/aiprodaily/refs/heads/master/instagram_light.png" alt="Instagram" width="24" height="24" style="border: none; display: block;">
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
    </td>
  </tr>
</table>
</body>
</html>`
}
