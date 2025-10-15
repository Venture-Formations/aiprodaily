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

export function generateNewsletterHeader(formattedDate: string): string {
  return `<html>
<body style='margin:0!important;padding:0!important;background-color:#f7f7f7;'>
   <div style='width:100%;margin:0 auto;padding:10px;background-color:#f7f7f7;box-sizing:border-box;overflow-x:auto;'>
     <div style='width:100%;max-width:990px;margin:0 auto;padding:5px;text-align:right;font-weight:bold;'>
       <a href='{$url}' style='color:#000;text-decoration:underline;'>View Online</a>&nbsp;|&nbsp;
       <a href='https://stcscoop.com/' style='color:#000;text-decoration:underline;'>Sign Up</a>&nbsp;|&nbsp;
       <a href='{$forward}' style='color:#000;text-decoration:underline;'>Share</a>
     </div>
     <div style='width:100%;max-width:990px;margin:0 auto;padding:0px;'>
       <div style='font-family:Arial,sans-serif;background-color:#1877F2;text-align:center;border-radius:12px;border:1px solid #333;'>
         <img alt='St. Cloud Scoop' src='https://raw.githubusercontent.com/VFDavid/STCScoop/refs/heads/main/STCSCOOP_Logo_824X148_clear.png' style='width:100%;max-width:500px;height:auto;margin-bottom:2px;'/>
         <div style='color:#fff;font-size:16px;font-weight:bold;padding:0 0 5px;'>${formattedDate}</div>
       </div>
     </div>
   </div>
<br>`
}

// ==================== LOCAL SCOOP (ARTICLES) ====================

export function generateLocalScoopSection(articles: any[], campaignDate: string, campaignId?: string): string {
  if (!articles || articles.length === 0) {
    return '<p style="text-align: center; color: #666;">No articles available</p>'
  }

  const articlesHtml = articles.map((article, index) => {
    const headline = article.headline || 'No headline'
    const content = article.content || ''
    const sourceUrl = article.rss_post?.source_url || '#'
    const imageUrl = article.rss_post?.image_url || ''
    const author = article.rss_post?.author || ''

    // Check if image URL is valid and not expired Facebook URL
    const isFacebookUrl = imageUrl && imageUrl.includes('fbcdn.net')
    const hasFacebookExpiration = isFacebookUrl && imageUrl.includes('&oe=')
    const validImageUrl = imageUrl && !hasFacebookExpiration ? imageUrl : null

    // Generate image HTML if valid URL exists
    const imageHtml = validImageUrl
      ? `<tr><td style='padding: 0 12px; text-align: center;'><img src='${validImageUrl}' alt='${headline}' style='max-width: 100%; max-height: 500px; border-radius: 4px;'></td></tr>${author ? `
<tr><td style='padding: 0 12px 12px; text-align: center; font-size: 12px; color: #555; font-style: italic;'>Photo by ${author}</td></tr>` : ''}`
      : ''

    // Wrap URL with tracking
    const trackedUrl = sourceUrl !== '#' ? wrapTrackingUrl(sourceUrl, 'Local Scoop', campaignDate, campaignId) : '#'

    return `
<tr class='row'>
 <td class='column' style='padding:8px; vertical-align: top;'>
 <table width='100%' cellpadding='0' cellspacing='0' style='border: 1px solid #ddd; border-radius: 8px; background: #fff; font-family: Arial, sans-serif; font-size: 16px; line-height: 26px; box-shadow:0 4px 12px rgba(0,0,0,.15);'>
 <tr><td style='padding: 12px 12px 4px; font-size: 20px; font-weight: bold;'>${headline}</td></tr>
 ${imageHtml}
 <tr><td style='padding: 0 12px 20px;'>${content} ${sourceUrl !== '#' ? `(<a href='${trackedUrl}' style='color: #0080FE; text-decoration: none;'>read more</a>)` : ''}</td></tr>
 </table>
 </td>
</tr>`
  }).join('')

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">The Local Scoop</h2>
    </td>
  </tr>
  ${articlesHtml}
</table>
<br>`
}

// ==================== LOCAL EVENTS ====================

export async function generateLocalEventsSection(campaign: any): Promise<string> {
  console.log('Generating Local Events section for campaign:', campaign?.id)

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
      const eventPageUrl = `https://st-cloud-scoop.vercel.app/events/${featuredEvent.id}`
      const eventUrl = wrapTrackingUrl(eventPageUrl, 'Local Events', campaign.date, campaign.mailerlite_campaign_id)

      return `
    <tr>
      <td style='padding:0; border-top: 1px solid #eee;'>
        <div style='padding:8px 16px; background:#E8F0FE; border:2px solid #1877F2; border-radius:6px;'>
          ${featuredEvent.cropped_image_url ? `
          <img src='${featuredEvent.cropped_image_url}' alt='${featuredEvent.title}' style='width:100%; max-width:400px; height:auto; object-fit:cover; border-radius:4px; border:1px solid #1877F2; display:block; margin-bottom:8px;' />
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
      const eventPageUrl = `https://st-cloud-scoop.vercel.app/events/${event.id}`
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

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">Local Events</h2>
    </td>
  </tr><tr class="row">${dayColumns}
</td></table>
<div style="text-align: center; padding: 20px 10px; max-width: 990px; margin: 0 auto;">
  <a href="https://events.stcscoop.com/events/view" style="display: inline-block; background-color: #1877F2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 0 10px; font-family: Arial, sans-serif;">View All Events</a>
  <a href="https://events.stcscoop.com/events/submit" style="display: inline-block; background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 0 10px; font-family: Arial, sans-serif;">Submit Your Event</a>
</div>
<br>`
}

// ==================== WORDLE ====================

export async function generateWordleSection(campaign: any): Promise<string> {
  try {
    console.log('Generating Wordle section for campaign:', campaign?.id)

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
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">Yesterday's Wordle</h2>
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://st-cloud-scoop.vercel.app'

  try {
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
                     style="display:block; text-decoration:none; background:#1877F2; color:#ffffff; font-weight:bold;
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
                    border:2px solid #1877F2; border-radius:10px; font-family:Arial, sans-serif;">
        <tr>
          <td style="padding:14px; color:#1a1a1a; font-size:16px; line-height:1.5; text-align:center;">

            <!-- Text Sections -->
            <p style="margin:0 0 6px 0; font-weight:bold; font-size:20px; color:#1877F2; text-align:center;">${pollData.title}</p>
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
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">Community Business Spotlight</h2>
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
      <tr><td style='padding: 12px 12px 4px; font-size: 20px; font-weight: bold;'>${emoji} <a href='${trackedUrl}' style='color: #000; text-decoration: none;'>${title}</a></td></tr>
      <tr><td style='padding: 0 12px 20px;'>${summary}</td></tr>
    </table>
  </td>
</tr>`
    }).join('')

    return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">Breaking News</h2>
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
      <tr><td style='padding: 12px 12px 4px; font-size: 20px; font-weight: bold;'>${emoji} <a href='${trackedUrl}' style='color: #000; text-decoration: none;'>${title}</a></td></tr>
      <tr><td style='padding: 0 12px 20px;'>${summary}</td></tr>
    </table>
  </td>
</tr>`
    }).join('')

    return `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; max-width: 990px; margin: 0 auto; background-color: #f7f7f7;">
  <tr>
    <td style="padding: 5px;">
      <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: Arial, sans-serif; color: #1877F2; margin: 0; padding: 0;">Beyond the Feed</h2>
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

// ==================== ROAD WORK ====================
// Feature not needed in this newsletter

export async function generateRoadWorkSection(campaign: any): Promise<string> {
  console.log('Road Work section disabled for AI Accounting Daily')
  return ''
}

// ==================== FOOTER ====================

export function generateNewsletterFooter(): string {
  return `
<div style="max-width: 990px; margin: 0 auto; background-color: #1877F2; padding: 8px 0; text-align: center;">
  <a href="https://www.facebook.com/61578947310955/" target="_blank">
    <img src="https://raw.githubusercontent.com/VFDavid/STCScoop/refs/heads/main/facebook_light.png" alt="Facebook" width="24" height="24" style="border: none; display: inline-block;">
  </a>
</div>
<div style="font-family: Arial, sans-serif; font-size: 12px; color: #777; text-align: center; padding: 20px 10px; border-top: 1px solid #ccc; background-color: #ffffff; max-width: 990px; margin: 0 auto ;">
  <p style="margin: 0;text-align: center;">You're receiving this email because you subscribed to <strong>St. Cloud Scoop</strong>.</p>
  <p style="margin: 5px 0 0;text-align: center;">
    <a href="{$unsubscribe}" style='text-decoration: underline;'>Unsubscribe</a>
  </p>
  <p style="margin: 5px;text-align: center;">©2025 Venture Formations LLC, all rights reserved</p>
</div>
    </div>
  </div>
</div>
</body>
</html>`
}
