// Publication-specific settings helper module
// Provides typed access to publication_settings with fallback to app_settings

import { supabaseAdmin } from './supabase'

// ==================== CORE FUNCTIONS ====================

/**
 * Get a single setting for a publication with fallback to app_settings
 * Logs a warning when using fallback to identify missing migrations
 */
export async function getPublicationSetting(
  publicationId: string,
  key: string
): Promise<string | null> {
  // Try publication_settings first
  const { data, error } = await supabaseAdmin
    .from('publication_settings')
    .select('value')
    .eq('publication_id', publicationId)
    .eq('key', key)
    .maybeSingle()

  if (data?.value) {
    // Strip extra quotes if value was JSON stringified (e.g., '"true"' -> 'true')
    let cleanValue = data.value
    if (cleanValue.startsWith('"') && cleanValue.endsWith('"') && cleanValue.length > 2) {
      cleanValue = cleanValue.slice(1, -1)
    }
    return cleanValue
  }

  // Fallback to app_settings with WARNING log
  const { data: fallback } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (fallback?.value) {
    console.warn(
      `[SETTINGS FALLBACK] Using app_settings for key="${key}" (publication=${publicationId}). Migrate this setting!`
    )
    return fallback.value
  }

  return null
}

/**
 * Get multiple settings for a publication with fallback
 * Returns a map of key -> value
 */
export async function getPublicationSettings(
  publicationId: string,
  keys: string[]
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}

  // Try publication_settings first
  const { data: pubSettings } = await supabaseAdmin
    .from('publication_settings')
    .select('key, value')
    .eq('publication_id', publicationId)
    .in('key', keys)

  // Build map from publication_settings
  const foundKeys = new Set<string>()
  pubSettings?.forEach((setting) => {
    if (setting.value) {
      // Strip extra quotes if value was JSON stringified (e.g., '"#1C293D"' -> '#1C293D')
      let cleanValue = setting.value
      if (cleanValue.startsWith('"') && cleanValue.endsWith('"') && cleanValue.length > 2) {
        cleanValue = cleanValue.slice(1, -1)
      }
      result[setting.key] = cleanValue
      foundKeys.add(setting.key)
    }
  })

  // Find missing keys
  const missingKeys = keys.filter((key) => !foundKeys.has(key))

  // Fallback to app_settings for missing keys
  if (missingKeys.length > 0) {
    const { data: fallbackSettings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', missingKeys)

    fallbackSettings?.forEach((setting) => {
      if (setting.value) {
        console.warn(
          `[SETTINGS FALLBACK] Using app_settings for key="${setting.key}" (publication=${publicationId}). Migrate this setting!`
        )
        result[setting.key] = setting.value
      }
    })
  }

  return result
}

/**
 * Update a publication setting (creates if doesn't exist)
 */
export async function updatePublicationSetting(
  publicationId: string,
  key: string,
  value: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('publication_settings')
    .upsert(
      {
        publication_id: publicationId,
        key,
        value,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'publication_id,key',
      }
    )

  if (error) {
    console.error(`[SETTINGS] Error updating ${key}:`, error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Get publication ID by domain (for public website routes)
 * Looks up the website_domain column in publications table
 */
export async function getPublicationByDomain(
  domain: string
): Promise<string | null> {
  // Strip port number if present (for local development)
  const cleanDomain = domain.split(':')[0]

  // Try exact match first
  const { data } = await supabaseAdmin
    .from('publications')
    .select('id')
    .eq('website_domain', cleanDomain)
    .maybeSingle()

  if (data?.id) {
    return data.id
  }

  // Try with/without www prefix
  const alternativeDomain = cleanDomain.startsWith('www.')
    ? cleanDomain.replace('www.', '')
    : `www.${cleanDomain}`

  const { data: altData } = await supabaseAdmin
    .from('publications')
    .select('id')
    .eq('website_domain', alternativeDomain)
    .maybeSingle()

  return altData?.id || null
}

/**
 * Get publication settings by domain (convenience function for public routes)
 * Looks up the publication by domain, then fetches the requested settings
 */
export async function getPublicationSettingsByDomain(
  domain: string,
  keys: string[]
): Promise<Record<string, string>> {
  const publicationId = await getPublicationByDomain(domain)
  
  if (!publicationId) {
    // Return empty object if no publication found
    // Callers should use fallback defaults
    return {}
  }
  
  return getPublicationSettings(publicationId, keys)
}

// ==================== TYPED HELPER FUNCTIONS ====================

/**
 * Get business/branding settings for a publication
 */
export async function getBusinessSettings(publicationId: string): Promise<{
  primary_color: string
  secondary_color: string
  tertiary_color: string
  quaternary_color: string
  heading_font: string
  body_font: string
  website_url: string
  logo_url: string
  header_image_url: string
  newsletter_name: string
  business_name: string
}> {
  console.log('[SETTINGS DEBUG] getBusinessSettings called with publicationId:', publicationId)
  const settings = await getPublicationSettings(publicationId, [
    'primary_color',
    'secondary_color',
    'tertiary_color',
    'quaternary_color',
    'heading_font',
    'body_font',
    'website_url',
    'logo_url',
    'header_image_url',
    'newsletter_name',
    'business_name',
  ])

  console.log('[SETTINGS DEBUG] Raw settings from DB:', settings)

  const result = {
    primary_color: settings.primary_color || '#1877F2',
    secondary_color: settings.secondary_color || '#10B981',
    tertiary_color: settings.tertiary_color || '#F59E0B',
    quaternary_color: settings.quaternary_color || '#8B5CF6',
    heading_font: settings.heading_font || 'Arial, sans-serif',
    body_font: settings.body_font || 'Arial, sans-serif',
    website_url: settings.website_url || 'https://www.example.com',
    logo_url: settings.logo_url || '',
    header_image_url: settings.header_image_url || '',
    newsletter_name: settings.newsletter_name || 'Newsletter',
    business_name: settings.business_name || 'Business',
  }

  console.log('[SETTINGS DEBUG] Returning business settings:', result)
  return result
}

/**
 * Get email/MailerLite settings for a publication
 */
export async function getEmailSettings(publicationId: string): Promise<{
  sender_name: string
  from_email: string
  review_group_id: string
  subject_line_emoji: string
  mailerlite_group_id: string
}> {
  const settings = await getPublicationSettings(publicationId, [
    'email_senderName',
    'email_fromEmail',
    'email_reviewGroupId',
    'subject_line_emoji',
    'mailerlite_group_id',
  ])

  return {
    sender_name: settings.email_senderName || 'Newsletter',
    from_email: settings.email_fromEmail || 'newsletter@example.com',
    review_group_id: settings.email_reviewGroupId || '',
    subject_line_emoji: settings.subject_line_emoji || '',
    mailerlite_group_id: settings.mailerlite_group_id || '',
  }
}

/**
 * Get article processing settings for a publication
 */
export async function getArticleSettings(publicationId: string): Promise<{
  primary_lookback_hours: number
  secondary_lookback_hours: number
  max_top_articles: number
  max_bottom_articles: number
  max_secondary_articles: number
  dedup_historical_days: number
  dedup_strictness_threshold: number
}> {
  const settings = await getPublicationSettings(publicationId, [
    'primary_article_lookback_hours',
    'secondary_article_lookback_hours',
    'max_top_articles',
    'max_bottom_articles',
    'max_secondary_articles',
    'dedup_historical_lookback_days',
    'dedup_strictness_threshold',
  ])

  return {
    primary_lookback_hours: parseInt(settings.primary_article_lookback_hours || '72', 10),
    secondary_lookback_hours: parseInt(settings.secondary_article_lookback_hours || '168', 10),
    max_top_articles: parseInt(settings.max_top_articles || '3', 10),
    max_bottom_articles: parseInt(settings.max_bottom_articles || '3', 10),
    max_secondary_articles: parseInt(settings.max_secondary_articles || '3', 10),
    dedup_historical_days: parseInt(settings.dedup_historical_lookback_days || '30', 10),
    dedup_strictness_threshold: parseFloat(settings.dedup_strictness_threshold || '0.85'),
  }
}

/**
 * Get an AI prompt for a publication with fallback
 */
export async function getAIPrompt(
  publicationId: string,
  promptKey: string
): Promise<string | null> {
  // Ensure the key has the correct prefix
  const key = promptKey.startsWith('ai_prompt_') ? promptKey : `ai_prompt_${promptKey}`
  return getPublicationSetting(publicationId, key)
}

/**
 * Get Slack notification settings for a publication
 */
export async function getSlackSettings(publicationId: string): Promise<{
  webhook_url: string
  low_article_count_enabled: boolean
  rss_processing_updates_enabled: boolean
}> {
  const settings = await getPublicationSettings(publicationId, [
    'slack_webhook_url',
    'slack_low_article_count_enabled',
    'slack_rss_processing_updates_enabled',
  ])

  return {
    webhook_url: settings.slack_webhook_url || '',
    low_article_count_enabled: settings.slack_low_article_count_enabled === 'true',
    rss_processing_updates_enabled: settings.slack_rss_processing_updates_enabled === 'true',
  }
}

/**
 * Get ad rotation settings for a publication
 */
export async function getAdSettings(publicationId: string): Promise<{
  next_ad_position: number
}> {
  const settings = await getPublicationSettings(publicationId, ['next_ad_position'])

  return {
    next_ad_position: parseInt(settings.next_ad_position || '1', 10),
  }
}

/**
 * Update the next ad position for a publication
 */
export async function updateNextAdPosition(
  publicationId: string,
  position: number
): Promise<{ success: boolean; error?: string }> {
  return updatePublicationSetting(publicationId, 'next_ad_position', position.toString())
}

/**
 * Get excluded RSS sources for a publication
 */
export async function getExcludedRssSources(publicationId: string): Promise<string[]> {
  const value = await getPublicationSetting(publicationId, 'excluded_rss_sources')
  if (!value) return []

  try {
    return JSON.parse(value)
  } catch {
    return []
  }
}

/**
 * Get criteria settings for a publication
 */
export async function getCriteriaSettings(publicationId: string): Promise<{
  primary_criteria_enabled_count: number
  secondary_criteria_enabled_count: number
}> {
  const settings = await getPublicationSettings(publicationId, [
    'primary_criteria_enabled_count',
    'secondary_criteria_enabled_count',
  ])

  return {
    primary_criteria_enabled_count: parseInt(settings.primary_criteria_enabled_count || '4', 10),
    secondary_criteria_enabled_count: parseInt(settings.secondary_criteria_enabled_count || '4', 10),
  }
}

/**
 * Get email schedule settings for a publication
 */
export async function getScheduleSettings(publicationId: string): Promise<{
  review_send_time: string
  final_send_time: string
  timezone_id: number
}> {
  const settings = await getPublicationSettings(publicationId, [
    'email_scheduledSendTime',
    'email_dailyScheduledSendTime',
    'email_timezone_id',
  ])

  return {
    review_send_time: settings.email_scheduledSendTime || '21:00',
    final_send_time: settings.email_dailyScheduledSendTime || '04:55',
    timezone_id: parseInt(settings.email_timezone_id || '157', 10), // 157 = Central Time
  }
}

// ==================== MIGRATION HELPER ====================

/**
 * Check if a setting exists in publication_settings
 * Useful for migration status checks
 */
export async function settingExistsInPublication(
  publicationId: string,
  key: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('publication_settings')
    .select('id')
    .eq('publication_id', publicationId)
    .eq('key', key)
    .maybeSingle()

  return !!data
}

/**
 * Get all settings for a publication (no fallback)
 * Useful for admin/debug views
 */
export async function getAllPublicationSettings(
  publicationId: string
): Promise<Array<{ key: string; value: string | null; updated_at: string }>> {
  const { data } = await supabaseAdmin
    .from('publication_settings')
    .select('key, value, updated_at')
    .eq('publication_id', publicationId)
    .order('key')

  return data || []
}
