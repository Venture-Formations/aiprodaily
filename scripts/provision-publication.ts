/**
 * Provision a new publication with all required database rows.
 *
 * Run with: npx tsx scripts/provision-publication.ts
 *
 * Creates:
 *   1. publications row
 *   2. ~50 publication_settings key-value pairs
 *   3. article_modules + article_module_criteria + article_module_prompts
 *   4. prompt_modules, ai_app_modules, text_box_modules + blocks, feedback_modules
 *
 * All schedules are disabled by default. MailerLite group IDs are left blank.
 * AI prompts are NOT inserted — they fall back to global app_settings defaults.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as readline from 'readline'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  console.error('  SUPABASE_URL:', supabaseUrl ? 'OK' : 'MISSING')
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'OK' : 'MISSING')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ---------------------------------------------------------------------------
// Interactive prompt helper
// ---------------------------------------------------------------------------

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function ask(question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : ''
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue || '')
    })
  })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function provision() {
  console.log('='.repeat(60))
  console.log('  Publication Provisioning Script')
  console.log('='.repeat(60))
  console.log()

  // Gather required inputs
  const name = await ask('Publication name (e.g. "AI Pros Daily")')
  if (!name) { console.error('Name is required.'); process.exit(1) }

  const slug = await ask('Slug (lowercase, hyphens)', name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
  const subdomain = await ask('Subdomain', slug)
  const websiteDomain = await ask('Website domain (e.g. aiprodaily.com)', '')
  const contactEmail = await ask('Contact email')
  const senderName = await ask('Sender name (for emails)', name)
  const fromEmail = await ask('From email', contactEmail)
  const primaryColor = await ask('Primary color', '#1C293D')

  console.log()
  console.log('Will create publication:')
  console.log(`  Name:      ${name}`)
  console.log(`  Slug:      ${slug}`)
  console.log(`  Subdomain: ${subdomain}`)
  console.log(`  Domain:    ${websiteDomain || '(none)'}`)
  console.log(`  Email:     ${contactEmail}`)
  console.log(`  Color:     ${primaryColor}`)
  console.log()

  const confirm = await ask('Proceed? (y/N)', 'N')
  if (confirm.toLowerCase() !== 'y') {
    console.log('Aborted.')
    process.exit(0)
  }

  console.log()

  // =========================================================================
  // Phase 1: Create publication
  // =========================================================================
  console.log('Phase 1: Creating publication...')

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from('publications')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    console.error(`  ERROR: Slug "${slug}" already exists (id: ${existing.id}). Aborting.`)
    process.exit(1)
  }

  const { data: pub, error: pubError } = await supabase
    .from('publications')
    .insert({
      name,
      slug,
      subdomain,
      website_domain: websiteDomain || null,
      primary_color: primaryColor,
      is_active: true,
    })
    .select('id')
    .single()

  if (pubError || !pub) {
    console.error('  Failed to create publication:', pubError?.message)
    process.exit(1)
  }

  const pubId = pub.id
  console.log(`  Created publication: ${pubId}`)

  // =========================================================================
  // Phase 2: Insert publication_settings (~50 rows)
  // =========================================================================
  console.log('\nPhase 2: Inserting publication settings...')

  const settings: Array<{ key: string; value: string }> = [
    // --- Branding ---
    { key: 'newsletter_name', value: name },
    { key: 'business_name', value: name },
    { key: 'primary_color', value: primaryColor },
    { key: 'secondary_color', value: '#10B981' },
    { key: 'tertiary_color', value: '#F59E0B' },
    { key: 'quaternary_color', value: '#8B5CF6' },
    { key: 'heading_font', value: 'Arial, sans-serif' },
    { key: 'body_font', value: 'Arial, sans-serif' },
    { key: 'website_url', value: websiteDomain ? `https://${websiteDomain}` : '' },
    { key: 'contact_email', value: contactEmail },
    { key: 'logo_url', value: '' },
    { key: 'header_image_url', value: '' },

    // --- Social (all disabled) ---
    { key: 'facebook_enabled', value: 'false' },
    { key: 'facebook_url', value: '' },
    { key: 'twitter_enabled', value: 'false' },
    { key: 'twitter_url', value: '' },
    { key: 'linkedin_enabled', value: 'false' },
    { key: 'linkedin_url', value: '' },
    { key: 'instagram_enabled', value: 'false' },
    { key: 'instagram_url', value: '' },

    // --- Email provider ---
    { key: 'email_provider', value: 'mailerlite' },
    { key: 'email_senderName', value: senderName },
    { key: 'email_fromEmail', value: fromEmail },
    { key: 'subject_line_emoji', value: '' },

    // --- MailerLite groups (blank — set manually after creating in ML dashboard) ---
    { key: 'mailerlite_main_group_id', value: '' },
    { key: 'mailerlite_review_group_id', value: '' },
    { key: 'mailerlite_test_group_id', value: '' },
    { key: 'mailerlite_signup_group_id', value: '' },

    // --- Schedule (all disabled) ---
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

    // --- Article processing ---
    { key: 'primary_article_lookback_hours', value: '72' },
    { key: 'secondary_article_lookback_hours', value: '168' },
    { key: 'max_top_articles', value: '3' },
    { key: 'max_bottom_articles', value: '3' },
    { key: 'max_secondary_articles', value: '3' },
    { key: 'dedup_historical_lookback_days', value: '30' },
    { key: 'dedup_strictness_threshold', value: '0.85' },

    // --- AI apps ---
    { key: 'ai_apps_per_newsletter', value: '6' },
    { key: 'ai_apps_max_per_category', value: '3' },
    { key: 'affiliate_cooldown_days', value: '7' },

    // --- Misc ---
    { key: 'next_ad_position', value: '1' },
    { key: 'excluded_rss_sources', value: '[]' },
    { key: 'blocked_domains', value: '[]' },
  ]

  const settingsRows = settings.map((s) => ({
    publication_id: pubId,
    key: s.key,
    value: s.value,
  }))

  const { error: settingsError } = await supabase
    .from('publication_settings')
    .upsert(settingsRows, { onConflict: 'publication_id,key', ignoreDuplicates: true })

  if (settingsError) {
    console.error('  Failed to insert settings:', settingsError.message)
    process.exit(1)
  }

  console.log(`  Inserted ${settings.length} settings`)

  // =========================================================================
  // Phase 3: Create article module + criteria + prompts
  // =========================================================================
  console.log('\nPhase 3: Creating article module...')

  const { data: articleModule, error: amError } = await supabase
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
    console.error('  Failed to create article module:', amError?.message)
    process.exit(1)
  }

  console.log(`  Article module: ${articleModule.id}`)

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

  const { error: criteriaError } = await supabase
    .from('article_module_criteria')
    .insert(criteriaRows)

  if (criteriaError) {
    console.error('  Failed to create criteria:', criteriaError.message)
  } else {
    console.log(`  Created ${criteriaRows.length} criteria`)
  }

  // 2 prompt rows (article_title + article_body)
  const prompts = [
    {
      prompt_type: 'article_title',
      ai_prompt: 'Write a concise, engaging newsletter headline for this article. Keep it under 80 characters.',
    },
    {
      prompt_type: 'article_body',
      ai_prompt: 'Write a 2-3 sentence newsletter summary of this article. Be informative and engaging.',
    },
  ]

  const promptRows = prompts.map((p) => ({
    article_module_id: articleModule.id,
    prompt_type: p.prompt_type,
    ai_prompt: p.ai_prompt,
  }))

  const { error: promptsError } = await supabase
    .from('article_module_prompts')
    .insert(promptRows)

  if (promptsError) {
    console.error('  Failed to create prompts:', promptsError.message)
  } else {
    console.log(`  Created ${promptRows.length} article prompts`)
  }

  // =========================================================================
  // Phase 4: Create content modules
  // =========================================================================
  console.log('\nPhase 4: Creating content modules...')

  // Prompt module
  const { data: promptModule, error: pmError } = await supabase
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

  if (pmError) {
    console.error('  Failed to create prompt module:', pmError.message)
  } else {
    console.log(`  Prompt module: ${promptModule?.id}`)
  }

  // AI App module
  const { data: aiAppModule, error: aaError } = await supabase
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

  if (aaError) {
    console.error('  Failed to create AI app module:', aaError.message)
  } else {
    console.log(`  AI app module: ${aiAppModule?.id}`)
  }

  // Text box module (Welcome)
  const { data: textBoxModule, error: tbError } = await supabase
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

  if (tbError) {
    console.error('  Failed to create text box module:', tbError.message)
  } else {
    console.log(`  Text box module: ${textBoxModule?.id}`)

    // Add a placeholder welcome text block
    const { error: blockError } = await supabase
      .from('text_box_blocks')
      .insert({
        text_box_module_id: textBoxModule.id,
        block_type: 'static_text',
        display_order: 0,
        static_content: `Welcome to ${name}! Here's your daily briefing.`,
        text_size: 'medium',
        is_active: true,
      })

    if (blockError) {
      console.error('  Failed to create text block:', blockError.message)
    } else {
      console.log('  Created welcome text block')
    }
  }

  // Feedback module
  const { data: feedbackModule, error: fbError } = await supabase
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

  if (fbError) {
    console.error('  Failed to create feedback module:', fbError.message)
  } else {
    console.log(`  Feedback module: ${feedbackModule?.id}`)
  }

  // =========================================================================
  // Phase 5: Summary
  // =========================================================================
  console.log()
  console.log('='.repeat(60))
  console.log('  Provisioning Complete')
  console.log('='.repeat(60))
  console.log()
  console.log(`  Publication ID:      ${pubId}`)
  console.log(`  Publication slug:    ${slug}`)
  console.log(`  Settings inserted:   ${settings.length}`)
  console.log(`  Article module:      ${articleModule?.id || 'FAILED'}`)
  console.log(`  Prompt module:       ${promptModule?.id || 'FAILED'}`)
  console.log(`  AI App module:       ${aiAppModule?.id || 'FAILED'}`)
  console.log(`  Text Box module:     ${textBoxModule?.id || 'FAILED'}`)
  console.log(`  Feedback module:     ${feedbackModule?.id || 'FAILED'}`)
  console.log()
  console.log('  Manual steps remaining:')
  console.log('  1. Create MailerLite groups and set group IDs in publication_settings')
  console.log('  2. Add RSS feeds to rss_feeds table')
  console.log('  3. Upload logo and header images, update logo_url/header_image_url')
  console.log('  4. Add prompt ideas to prompt_ideas table (for Prompt of the Day)')
  console.log('  5. Add AI applications to ai_applications table')
  console.log('  6. Enable schedules when ready (email_reviewScheduleEnabled, email_dailyScheduleEnabled)')
  console.log('  7. Customize article module criteria AI prompts for your audience')
  console.log()
  console.log('  See: docs/recipes/provision-publication.md for full checklist')
  console.log('='.repeat(60))

  rl.close()
}

// Run
provision().catch((err) => {
  console.error('Provisioning failed:', err)
  process.exit(1)
})
