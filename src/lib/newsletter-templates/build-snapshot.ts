// Data fetching layer: builds an IssueSnapshot with all data needed to render a newsletter

import { supabaseAdmin } from '../supabase'
import { fetchBusinessSettings } from './helpers'
import type { IssueSnapshot, SectionItem } from './types'

// Explicit column lists for module config tables (no select('*'))
const NEWSLETTER_SECTION_COLS = `id, newsletter_id, name, display_order, is_active, section_type, description, created_at`
const AD_MODULE_COLS = `id, publication_id, name, display_order, is_active, selection_mode, block_order, config, next_position, created_at, updated_at`
const POLL_MODULE_COLS = `id, publication_id, name, display_order, is_active, block_order, config, created_at, updated_at`
const PROMPT_MODULE_COLS = `id, publication_id, name, display_order, is_active, selection_mode, block_order, config, next_position, created_at, updated_at`
const ARTICLE_MODULE_COLS = `id, publication_id, name, display_order, is_active, selection_mode, block_order, config, articles_count, lookback_hours, ai_image_prompt, created_at, updated_at`
const TEXT_BOX_MODULE_COLS = `id, publication_id, name, display_order, is_active, show_name, config, created_at, updated_at`
const TEXT_BOX_BLOCK_COLS = `id, text_box_module_id, block_type, display_order, static_content, text_size, ai_prompt_json, generation_timing, image_type, static_image_url, ai_image_prompt, is_active, is_bold, is_italic, created_at, updated_at`
const FEEDBACK_MODULE_COLS = `id, publication_id, name, display_order, is_active, block_order, title_text, body_text, body_is_italic, sign_off_text, sign_off_is_italic, vote_options, team_photos, config, show_name, created_at, updated_at`

/**
 * Build an IssueSnapshot by fetching all module configs and business settings in parallel.
 * This replaces the sequential DB queries previously scattered across full-newsletter.ts.
 */
export async function buildIssueSnapshot(
  issue: any,
  options: { isReview?: boolean } = {}
): Promise<IssueSnapshot> {
  const { isReview = false } = options

  // Run all data fetches in parallel
  const [
    businessSettings,
    { data: allSections },
    { data: adModules },
    { data: pollModules },
    { data: promptModules },
    { data: articleModules },
    { data: textBoxModules },
    { data: sparkloopRecModules },
    { data: feedbackModules },
  ] = await Promise.all([
    fetchBusinessSettings(issue.publication_id),
    supabaseAdmin
      .from('newsletter_sections')
      .select(NEWSLETTER_SECTION_COLS)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabaseAdmin
      .from('ad_modules')
      .select(AD_MODULE_COLS)
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabaseAdmin
      .from('poll_modules')
      .select(POLL_MODULE_COLS)
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabaseAdmin
      .from('prompt_modules')
      .select(PROMPT_MODULE_COLS)
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabaseAdmin
      .from('article_modules')
      .select(ARTICLE_MODULE_COLS)
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabaseAdmin
      .from('text_box_modules')
      .select(`
        ${TEXT_BOX_MODULE_COLS},
        blocks:text_box_blocks(${TEXT_BOX_BLOCK_COLS})
      `)
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabaseAdmin
      .from('sparkloop_rec_modules')
      .select('id, name, display_order, is_active, selection_mode, block_order, config, recs_count')
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabaseAdmin
      .from('feedback_modules')
      .select(FEEDBACK_MODULE_COLS)
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true),
  ])

  // Filter out legacy article section types (now handled by article_modules)
  const sections = (allSections || []).filter(
    (s: any) => s.section_type !== 'primary_articles' && s.section_type !== 'secondary_articles'
  )

  // Merge all module types into a single sorted list
  const sortedSections: SectionItem[] = [
    ...(sections || []).map((s: any) => ({ type: 'section' as const, data: s })),
    ...(adModules || []).map((m: any) => ({ type: 'ad_module' as const, data: m })),
    ...(pollModules || []).map((m: any) => ({ type: 'poll_module' as const, data: m })),
    ...(promptModules || []).map((m: any) => ({ type: 'prompt_module' as const, data: m })),
    ...(articleModules || []).map((m: any) => ({ type: 'article_module' as const, data: m })),
    ...(textBoxModules || []).map((m: any) => ({ type: 'text_box_module' as const, data: m })),
    ...(feedbackModules || []).map((m: any) => ({ type: 'feedback_module' as const, data: m })),
    ...(sparkloopRecModules || []).map((m: any) => ({ type: 'sparkloop_rec_module' as const, data: m })),
  ].sort((a, b) => (a.data.display_order ?? 999) - (b.data.display_order ?? 999))

  // Format date using local date parsing
  const formattedDate = formatIssueDate(issue.date)

  // Phase 2.3: Pre-fetch all per-issue content in parallel
  // Dynamic imports match existing pattern in sections.ts to avoid circular deps
  const [
    { PollModuleSelector },
    { AppModuleSelector },
    { TextBoxModuleSelector },
    { FeedbackModuleSelector },
    { SparkLoopRecModuleSelector },
  ] = await Promise.all([
    import('../poll-modules'),
    import('../ai-app-modules'),
    import('../text-box-modules'),
    import('../feedback-modules'),
    import('../sparkloop-rec-modules'),
  ])

  // Each fetch has a .catch() so one failure doesn't abort the entire snapshot.
  // Generators handle empty arrays/null gracefully (return '' for missing sections).
  const [
    pollSelections,
    promptSelections,
    aiAppSelections,
    textBoxSelections,
    feedbackModule,
    sparkloopRecResult,
    adSelections,
    articleSelectionsRaw,
    breakingNewsArticles,
    beyondFeedArticles,
  ] = await Promise.all([
    PollModuleSelector.getIssuePollSelections(issue.id).catch(e => { console.error('[Snapshot] pollSelections failed:', e.message); return [] }),
    fetchPromptSelections(issue.id).catch(e => { console.error('[Snapshot] promptSelections failed:', e.message); return [] }),
    AppModuleSelector.getIssueSelections(issue.id).catch(e => { console.error('[Snapshot] aiAppSelections failed:', e.message); return [] }),
    TextBoxModuleSelector.getIssueSelections(issue.id).catch(e => { console.error('[Snapshot] textBoxSelections failed:', e.message); return [] }),
    FeedbackModuleSelector.getFeedbackModuleWithBlocks(issue.publication_id).catch(e => { console.error('[Snapshot] feedbackModule failed:', e.message); return null }),
    SparkLoopRecModuleSelector.getIssueSelections(issue.id).catch(e => { console.error('[Snapshot] sparkloopRecSelections failed:', e.message); return { selections: [] } }),
    fetchAdSelections(issue.id).catch(e => { console.error('[Snapshot] adSelections failed:', e.message); return [] }),
    fetchArticleSelections(issue.id).catch(e => { console.error('[Snapshot] articleSelections failed:', e.message); return [] }),
    Promise.resolve([] as any[]),
    Promise.resolve([] as any[]),
  ])

  // Group articles by module ID
  const articlesByModule: Record<string, any[]> = {}
  for (const article of articleSelectionsRaw) {
    const moduleId = article.article_module_id
    if (!articlesByModule[moduleId]) {
      articlesByModule[moduleId] = []
    }
    articlesByModule[moduleId].push(article)
  }

  // Derive preheader text: welcome_summary → subject_line → empty
  const rawPreheader = issue.welcome_summary || issue.subject_line || ''
  const preheaderText = rawPreheader ? String(rawPreheader).slice(0, 120) : ''

  return {
    issue,
    formattedDate,
    businessSettings,
    sortedSections,
    isReview,
    preheaderText,
    pollSelections,
    promptSelections,
    aiAppSelections,
    textBoxSelections,
    feedbackModule,
    sparkloopRecSelections: sparkloopRecResult.selections || [],
    adSelections,
    articlesByModule,
    breakingNewsArticles,
    beyondFeedArticles,
  }
}

// ==================== PRE-FETCH HELPERS ====================

async function fetchPromptSelections(issueId: string) {
  const { data, error } = await supabaseAdmin
    .from('issue_prompt_modules')
    .select(`
      id, issue_id, prompt_module_id, prompt_id, selection_mode, selected_at, used_at, created_at,
      prompt_module:prompt_modules(${PROMPT_MODULE_COLS}),
      prompt:prompt_ideas(id, publication_id, prompt_module_id, title, prompt_text, priority, times_used, is_active, created_at, updated_at)
    `)
    .eq('issue_id', issueId)
  if (error) console.error('[Snapshot] fetchPromptSelections error:', error.message)
  return data || []
}

async function fetchAdSelections(issueId: string) {
  const { data, error } = await supabaseAdmin
    .from('issue_module_ads')
    .select(`
      selection_mode,
      selected_at,
      ad_module_id,
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
        image_alt,
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
    .eq('issue_id', issueId)
    .order('ad_module(display_order)', { ascending: true })
  if (error) console.error('[Snapshot] fetchAdSelections error:', error.message)
  return data || []
}

async function fetchArticleSelections(issueId: string) {
  const { data, error } = await supabaseAdmin
    .from('module_articles')
    .select(`
      id,
      headline,
      content,
      is_active,
      rank,
      ai_image_url,
      image_alt,
      article_module_id,
      rss_post:rss_posts(
        source_url,
        image_url,
        image_alt
      )
    `)
    .eq('issue_id', issueId)
    .eq('is_active', true)
    .order('rank', { ascending: true })
  if (error) console.error('[Snapshot] fetchArticleSelections error:', error.message)
  return data || []
}

function formatIssueDate(dateString: string): string {
  try {
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch (e) {
    console.error('Date formatting error:', e)
    return dateString
  }
}
