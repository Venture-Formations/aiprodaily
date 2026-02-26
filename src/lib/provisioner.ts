import { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProvisionInput {
  // Required
  name: string
  slug: string
  // Optional — defaults to slug if omitted
  subdomain?: string
  contactEmail: string
  senderName: string
  fromEmail: string
  primaryColor: string
  websiteDomain: string
  logoUrl?: string
  headerImageUrl?: string
  facebookEnabled?: boolean
  facebookUrl?: string
  twitterEnabled?: boolean
  twitterUrl?: string
  linkedinEnabled?: boolean
  linkedinUrl?: string
  instagramEnabled?: boolean
  instagramUrl?: string
  mailerliteMainGroupId?: string
  mailerliteReviewGroupId?: string
  mailerliteTestGroupId?: string
  mailerliteSignupGroupId?: string
}

export interface ProvisionResult {
  publicationId: string
  slug: string
  settingsCount: number
  modules: {
    articleModuleId: string | null
    promptModuleId: string | null
    aiAppModuleId: string | null
    textBoxModuleId: string | null
    feedbackModuleId: string | null
  }
}

// ---------------------------------------------------------------------------
// Provisioner
// ---------------------------------------------------------------------------

/**
 * Provision a new publication with all required database rows.
 * Creates: publications row, ~53 settings, article module + criteria + prompts,
 * and content modules (prompt, ai_app, text_box, feedback).
 *
 * @param input - Publication configuration
 * @param client - Optional Supabase client (defaults to supabaseAdmin for Next.js context)
 */
export async function provisionPublication(
  input: ProvisionInput,
  client?: SupabaseClient
): Promise<ProvisionResult> {
  const db = client || supabaseAdmin

  // Phase 1: Check slug uniqueness and create publication
  const { data: existing } = await db
    .from('publications')
    .select('id')
    .eq('slug', input.slug)
    .maybeSingle()

  if (existing) {
    throw new Error(`Slug "${input.slug}" already exists (id: ${existing.id})`)
  }

  const { data: pub, error: pubError } = await db
    .from('publications')
    .insert({
      name: input.name,
      slug: input.slug,
      subdomain: input.subdomain || input.slug,
      website_domain: input.websiteDomain,
      primary_color: input.primaryColor,
      is_active: true,
    })
    .select('id')
    .single()

  if (pubError || !pub) {
    throw new Error(`Failed to create publication: ${pubError?.message}`)
  }

  const pubId = pub.id

  // Phase 2: Insert publication_settings (~53 rows)
  const settings = buildSettings(input, pubId)
  const settingsRows = settings.map((s) => ({
    publication_id: pubId,
    key: s.key,
    value: s.value,
  }))

  const { error: settingsError } = await db
    .from('publication_settings')
    .upsert(settingsRows, { onConflict: 'publication_id,key', ignoreDuplicates: true })

  if (settingsError) {
    throw new Error(`Failed to insert settings: ${settingsError.message}`)
  }

  // Phase 3: Create article module + criteria + prompts
  const articleModuleId = await createArticleModule(db, pubId)

  // Phase 4: Create content modules
  const promptModuleId = await createPromptModule(db, pubId)
  const aiAppModuleId = await createAiAppModule(db, pubId)
  const textBoxModuleId = await createTextBoxModule(db, pubId, input.name)
  const feedbackModuleId = await createFeedbackModule(db, pubId)

  return {
    publicationId: pubId,
    slug: input.slug,
    settingsCount: settings.length,
    modules: {
      articleModuleId,
      promptModuleId,
      aiAppModuleId,
      textBoxModuleId,
      feedbackModuleId,
    },
  }
}

// ---------------------------------------------------------------------------
// Settings builder
// ---------------------------------------------------------------------------

function buildSettings(
  input: ProvisionInput,
  _pubId: string
): Array<{ key: string; value: string }> {
  return [
    // Branding
    { key: 'newsletter_name', value: input.name },
    { key: 'business_name', value: input.name },
    { key: 'primary_color', value: input.primaryColor },
    { key: 'secondary_color', value: '#10B981' },
    { key: 'tertiary_color', value: '#F59E0B' },
    { key: 'quaternary_color', value: '#8B5CF6' },
    { key: 'heading_font', value: 'Arial, sans-serif' },
    { key: 'body_font', value: 'Arial, sans-serif' },
    { key: 'website_url', value: input.websiteDomain ? `https://${input.websiteDomain}` : '' },
    { key: 'contact_email', value: input.contactEmail },
    { key: 'logo_url', value: input.logoUrl || '' },
    { key: 'header_image_url', value: input.headerImageUrl || '' },

    // Social
    { key: 'facebook_enabled', value: String(input.facebookEnabled || false) },
    { key: 'facebook_url', value: input.facebookUrl || '' },
    { key: 'twitter_enabled', value: String(input.twitterEnabled || false) },
    { key: 'twitter_url', value: input.twitterUrl || '' },
    { key: 'linkedin_enabled', value: String(input.linkedinEnabled || false) },
    { key: 'linkedin_url', value: input.linkedinUrl || '' },
    { key: 'instagram_enabled', value: String(input.instagramEnabled || false) },
    { key: 'instagram_url', value: input.instagramUrl || '' },

    // Email provider
    { key: 'email_provider', value: 'mailerlite' },
    { key: 'email_senderName', value: input.senderName },
    { key: 'email_fromEmail', value: input.fromEmail },
    { key: 'subject_line_emoji', value: '' },

    // MailerLite groups
    { key: 'mailerlite_main_group_id', value: input.mailerliteMainGroupId || '' },
    { key: 'mailerlite_review_group_id', value: input.mailerliteReviewGroupId || '' },
    { key: 'mailerlite_test_group_id', value: input.mailerliteTestGroupId || '' },
    { key: 'mailerlite_signup_group_id', value: input.mailerliteSignupGroupId || '' },

    // Schedule (all disabled)
    { key: 'email_reviewScheduleEnabled', value: 'false' },
    { key: 'email_dailyScheduleEnabled', value: 'false' },
    { key: 'email_rssProcessingTime', value: '20:30' },
    { key: 'email_issueCreationTime', value: '20:50' },
    { key: 'email_scheduledSendTime', value: '21:00' },
    { key: 'email_dailyissueCreationTime', value: '04:30' },
    { key: 'email_dailyScheduledSendTime', value: '04:55' },
    { key: 'email_timezone_id', value: '157' },
    { key: 'email_secondaryScheduleEnabled', value: 'false' },
    { key: 'email_secondaryissueCreationTime', value: '06:00' },
    { key: 'email_secondaryScheduledSendTime', value: '06:30' },
    { key: 'secondary_send_days', value: '[]' },

    // Article processing
    { key: 'primary_article_lookback_hours', value: '72' },
    { key: 'secondary_article_lookback_hours', value: '168' },
    { key: 'max_top_articles', value: '3' },
    { key: 'max_bottom_articles', value: '3' },
    { key: 'max_secondary_articles', value: '3' },
    { key: 'dedup_historical_lookback_days', value: '30' },
    { key: 'dedup_strictness_threshold', value: '0.85' },

    // AI apps
    { key: 'ai_apps_per_newsletter', value: '6' },
    { key: 'ai_apps_max_per_category', value: '3' },
    { key: 'affiliate_cooldown_days', value: '7' },

    // Misc
    { key: 'next_ad_position', value: '1' },
    { key: 'excluded_rss_sources', value: '[]' },
    { key: 'blocked_domains', value: '[]' },
  ]
}

// ---------------------------------------------------------------------------
// Module creators (Phase 3 & 4)
// ---------------------------------------------------------------------------

async function createArticleModule(
  db: SupabaseClient,
  pubId: string
): Promise<string | null> {
  const { data: articleModule, error: amError } = await db
    .from('article_modules')
    .insert({
      publication_id: pubId,
      name: 'Top Stories',
      display_order: 10,
      is_active: true,
      selection_mode: 'top_score',
      block_order: ['source_image', 'title', 'body'],
      config: {},
      articles_count: 3,
      lookback_hours: 72,
    })
    .select('id')
    .single()

  if (amError || !articleModule) {
    console.warn('[Provisioner] Failed to create article module:', amError?.message)
    return null
  }

  // 4 criteria rows
  const criteria = [
    { criteria_number: 1, name: 'Relevance', weight: 0.30 },
    { criteria_number: 2, name: 'Timeliness', weight: 0.25 },
    { criteria_number: 3, name: 'Impact', weight: 0.25 },
    { criteria_number: 4, name: 'Novelty', weight: 0.20 },
  ]

  const criteriaRows = criteria.map((c) => ({
    article_module_id: articleModule.id,
    criteria_number: c.criteria_number,
    name: c.name,
    weight: c.weight,
    is_active: true,
    display_order: c.criteria_number,
    ai_prompt: `Score this article on ${c.name.toLowerCase()} from 1-10. Consider how ${c.name.toLowerCase()} the content is to the publication's audience.`,
  }))

  const { error: criteriaError } = await db
    .from('article_module_criteria')
    .insert(criteriaRows)

  if (criteriaError) {
    console.warn('[Provisioner] Failed to create criteria:', criteriaError.message)
  }

  // 2 prompt rows
  const promptRows = [
    {
      article_module_id: articleModule.id,
      prompt_type: 'article_title',
      ai_prompt: 'Write a concise, engaging newsletter headline for this article. Keep it under 80 characters.',
    },
    {
      article_module_id: articleModule.id,
      prompt_type: 'article_body',
      ai_prompt: 'Write a 2-3 sentence newsletter summary of this article. Be informative and engaging.',
    },
  ]

  const { error: promptsError } = await db
    .from('article_module_prompts')
    .insert(promptRows)

  if (promptsError) {
    console.warn('[Provisioner] Failed to create article prompts:', promptsError.message)
  }

  return articleModule.id
}

async function createPromptModule(
  db: SupabaseClient,
  pubId: string
): Promise<string | null> {
  const { data, error } = await db
    .from('prompt_modules')
    .insert({
      publication_id: pubId,
      name: 'Prompt of the Day',
      display_order: 20,
      is_active: true,
      selection_mode: 'random',
      block_order: ['title', 'body'],
      config: {},
    })
    .select('id')
    .single()

  if (error) {
    console.warn('[Provisioner] Failed to create prompt module:', error.message)
    return null
  }
  return data.id
}

async function createAiAppModule(
  db: SupabaseClient,
  pubId: string
): Promise<string | null> {
  const { data, error } = await db
    .from('ai_app_modules')
    .insert({
      publication_id: pubId,
      name: 'AI Applications',
      display_order: 30,
      is_active: true,
      selection_mode: 'affiliate_priority',
      block_order: ['title', 'description', 'button'],
      config: {},
      apps_count: 6,
      max_per_category: 3,
      affiliate_cooldown_days: 7,
    })
    .select('id')
    .single()

  if (error) {
    console.warn('[Provisioner] Failed to create AI app module:', error.message)
    return null
  }
  return data.id
}

async function createTextBoxModule(
  db: SupabaseClient,
  pubId: string,
  pubName: string
): Promise<string | null> {
  const { data, error } = await db
    .from('text_box_modules')
    .insert({
      publication_id: pubId,
      name: 'Welcome',
      display_order: 5,
      is_active: true,
      show_name: false,
      config: {},
    })
    .select('id')
    .single()

  if (error) {
    console.warn('[Provisioner] Failed to create text box module:', error.message)
    return null
  }

  const { error: blockError } = await db
    .from('text_box_blocks')
    .insert({
      text_box_module_id: data.id,
      block_type: 'static_text',
      display_order: 0,
      static_content: `Welcome to ${pubName}! Here's your daily briefing.`,
      text_size: 'medium',
      is_active: true,
    })

  if (blockError) {
    console.warn('[Provisioner] Failed to create text block:', blockError.message)
  }

  return data.id
}

async function createFeedbackModule(
  db: SupabaseClient,
  pubId: string
): Promise<string | null> {
  const { data, error } = await db
    .from('feedback_modules')
    .insert({
      publication_id: pubId,
      name: 'Feedback',
      display_order: 999,
      is_active: true,
      block_order: ['title', 'body', 'vote_options', 'sign_off', 'team_photos'],
      title_text: "That's it for today!",
      sign_off_text: 'See you tomorrow!',
      sign_off_is_italic: true,
      vote_options: [
        { emoji: 'star', label: 'Nailed it', value: 5 },
        { emoji: 'star', label: 'Average', value: 3 },
        { emoji: 'star', label: 'Fail', value: 1 },
      ],
      team_photos: [],
      config: {},
      show_name: true,
    })
    .select('id')
    .single()

  if (error) {
    console.warn('[Provisioner] Failed to create feedback module:', error.message)
    return null
  }
  return data.id
}
