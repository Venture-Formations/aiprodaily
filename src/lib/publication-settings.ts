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
    return data.value
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
      result[setting.key] = setting.value
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

// ==================== TYPED HELPER FUNCTIONS ====================

/**
 * Get business/branding settings for a publication
 */
export async function getBusinessSettings(publicationId: string): Promise<{
  primaryColor: string
  secondaryColor: string
  headingFont: string
  bodyFont: string
  websiteUrl: string
  logoUrl: string
  headerImageUrl: string
  newsletterName: string
  businessName: string
}> {
  const settings = await getPublicationSettings(publicationId, [
    'primary_color',
    'secondary_color',
    'heading_font',
    'body_font',
    'website_url',
    'logo_url',
    'header_image_url',
    'newsletter_name',
    'business_name',
  ])

  return {
    primaryColor: settings.primary_color || '#1877F2',
    secondaryColor: settings.secondary_color || '#10B981',
    headingFont: settings.heading_font || 'Arial, sans-serif',
    bodyFont: settings.body_font || 'Arial, sans-serif',
    websiteUrl: settings.website_url || 'https://www.example.com',
    logoUrl: settings.logo_url || '',
    headerImageUrl: settings.header_image_url || '',
    newsletterName: settings.newsletter_name || 'Newsletter',
    businessName: settings.business_name || 'Business',
  }
}

/**
 * Get email/MailerLite settings for a publication
 */
export async function getEmailSettings(publicationId: string): Promise<{
  senderName: string
  fromEmail: string
  reviewGroupId: string
  subjectLineEmoji: string
  mailerliteGroupId: string
}> {
  const settings = await getPublicationSettings(publicationId, [
    'email_senderName',
    'email_fromEmail',
    'email_reviewGroupId',
    'subject_line_emoji',
    'mailerlite_group_id',
  ])

  return {
    senderName: settings.email_senderName || 'Newsletter',
    fromEmail: settings.email_fromEmail || 'newsletter@example.com',
    reviewGroupId: settings.email_reviewGroupId || '',
    subjectLineEmoji: settings.subject_line_emoji || '',
    mailerliteGroupId: settings.mailerlite_group_id || '',
  }
}

/**
 * Get article processing settings for a publication
 */
export async function getArticleSettings(publicationId: string): Promise<{
  primaryLookbackHours: number
  secondaryLookbackHours: number
  maxTopArticles: number
  maxBottomArticles: number
  maxSecondaryArticles: number
  dedupHistoricalDays: number
  dedupStrictnessThreshold: number
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
    primaryLookbackHours: parseInt(settings.primary_article_lookback_hours || '72', 10),
    secondaryLookbackHours: parseInt(settings.secondary_article_lookback_hours || '168', 10),
    maxTopArticles: parseInt(settings.max_top_articles || '3', 10),
    maxBottomArticles: parseInt(settings.max_bottom_articles || '3', 10),
    maxSecondaryArticles: parseInt(settings.max_secondary_articles || '3', 10),
    dedupHistoricalDays: parseInt(settings.dedup_historical_lookback_days || '30', 10),
    dedupStrictnessThreshold: parseFloat(settings.dedup_strictness_threshold || '0.85'),
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
  webhookUrl: string
  lowArticleCountEnabled: boolean
  rssProcessingUpdatesEnabled: boolean
}> {
  const settings = await getPublicationSettings(publicationId, [
    'slack_webhook_url',
    'slack_low_article_count_enabled',
    'slack_rss_processing_updates_enabled',
  ])

  return {
    webhookUrl: settings.slack_webhook_url || '',
    lowArticleCountEnabled: settings.slack_low_article_count_enabled === 'true',
    rssProcessingUpdatesEnabled: settings.slack_rss_processing_updates_enabled === 'true',
  }
}

/**
 * Get ad rotation settings for a publication
 */
export async function getAdSettings(publicationId: string): Promise<{
  nextAdPosition: number
}> {
  const settings = await getPublicationSettings(publicationId, ['next_ad_position'])

  return {
    nextAdPosition: parseInt(settings.next_ad_position || '1', 10),
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
  primaryCriteriaEnabledCount: number
  secondaryCriteriaEnabledCount: number
}> {
  const settings = await getPublicationSettings(publicationId, [
    'primary_criteria_enabled_count',
    'secondary_criteria_enabled_count',
  ])

  return {
    primaryCriteriaEnabledCount: parseInt(settings.primary_criteria_enabled_count || '4', 10),
    secondaryCriteriaEnabledCount: parseInt(settings.secondary_criteria_enabled_count || '4', 10),
  }
}

/**
 * Get email schedule settings for a publication
 */
export async function getScheduleSettings(publicationId: string): Promise<{
  reviewSendTime: string
  finalSendTime: string
  timezoneId: number
}> {
  const settings = await getPublicationSettings(publicationId, [
    'email_scheduledSendTime',
    'email_dailyScheduledSendTime',
    'email_timezone_id',
  ])

  return {
    reviewSendTime: settings.email_scheduledSendTime || '21:00',
    finalSendTime: settings.email_dailyScheduledSendTime || '04:55',
    timezoneId: parseInt(settings.email_timezone_id || '157', 10), // 157 = Central Time
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
