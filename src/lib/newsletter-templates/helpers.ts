// Shared helpers used across newsletter template sub-modules

import { supabaseAdmin } from '../supabase'
import { getBusinessSettings as getPublicationBusinessSettings } from '../publication-settings'
import type { BusinessSettings } from './types'

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

// ==================== ARTICLE EMOJI GENERATOR ====================

export function getArticleEmoji(headline: string, content: string): string {
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

export async function fetchBusinessSettings(publication_id?: string): Promise<BusinessSettings> {
  // If publication_id is provided, use the new helper mod (with fallback logging)
  if (publication_id) {
    const settings = await getPublicationBusinessSettings(publication_id)

    // Fetch social media fields (not in getBusinessSettings yet)
    const { data: socialSettings } = await supabaseAdmin
      .from('publication_settings')
      .select('key, value')
      .eq('publication_id', publication_id)
      .in('key', [
        'facebook_enabled', 'facebook_url',
        'twitter_enabled', 'twitter_url',
        'linkedin_enabled', 'linkedin_url',
        'instagram_enabled', 'instagram_url'
      ])

    const socialMap: Record<string, string> = {}
    socialSettings?.forEach(s => {
      let v = s.value
      if (v && v.startsWith('"') && v.endsWith('"') && v.length > 2) v = v.slice(1, -1)
      socialMap[s.key] = v
    })

    return {
      primaryColor: settings.primary_color,
      secondaryColor: settings.secondary_color,
      tertiaryColor: settings.tertiary_color,
      quaternaryColor: settings.quaternary_color,
      headingFont: settings.heading_font,
      bodyFont: settings.body_font,
      websiteUrl: settings.website_url,
      headerImageUrl: settings.header_image_url,
      newsletterName: settings.newsletter_name,
      businessName: settings.business_name,
      facebookEnabled: socialMap.facebook_enabled === 'true',
      facebookUrl: socialMap.facebook_url || '',
      twitterEnabled: socialMap.twitter_enabled === 'true',
      twitterUrl: socialMap.twitter_url || '',
      linkedinEnabled: socialMap.linkedin_enabled === 'true',
      linkedinUrl: socialMap.linkedin_url || '',
      instagramEnabled: socialMap.instagram_enabled === 'true',
      instagramUrl: socialMap.instagram_url || '',
    }
  }

  // Fallback to old behavior (logs warning so we know what to update)
  console.warn('[SETTINGS] fetchBusinessSettings called without publication_id - update caller to pass publication_id')

  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .in('key', [
      'primary_color', 'secondary_color', 'tertiary_color', 'quaternary_color',
      'heading_font', 'body_font', 'website_url', 'header_image_url', 'newsletter_name',
      'business_name', 'facebook_enabled', 'facebook_url', 'twitter_enabled', 'twitter_url',
      'linkedin_enabled', 'linkedin_url', 'instagram_enabled', 'instagram_url'
    ])

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
    websiteUrl: settingsMap.website_url || process.env.NEXT_PUBLIC_SITE_URL || 'https://aiprodaily.com',
    headerImageUrl: settingsMap.header_image_url || '',
    newsletterName: settingsMap.newsletter_name || 'Newsletter',
    businessName: settingsMap.business_name || 'Business',
    facebookEnabled: settingsMap.facebook_enabled === 'true',
    facebookUrl: settingsMap.facebook_url || '',
    twitterEnabled: settingsMap.twitter_enabled === 'true',
    twitterUrl: settingsMap.twitter_url || '',
    linkedinEnabled: settingsMap.linkedin_enabled === 'true',
    linkedinUrl: settingsMap.linkedin_url || '',
    instagramEnabled: settingsMap.instagram_enabled === 'true',
    instagramUrl: settingsMap.instagram_url || '',
  }
}

// ==================== BREAKING NEWS EMOJI ====================

export function getBreakingNewsEmoji(title: string, description: string): string {
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

// ==================== AI APP EMOJI ====================

export function getAIAppEmoji(appName: string, category: string, description: string): string {
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
