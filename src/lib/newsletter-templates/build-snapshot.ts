// Data fetching layer: builds an IssueSnapshot with all data needed to render a newsletter

import { supabaseAdmin } from '../supabase'
import { fetchBusinessSettings } from './helpers'
import type { IssueSnapshot, SectionItem } from './types'

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
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabaseAdmin
      .from('ad_modules')
      .select('*')
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabaseAdmin
      .from('poll_modules')
      .select('*')
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabaseAdmin
      .from('prompt_modules')
      .select('*')
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabaseAdmin
      .from('article_modules')
      .select('*')
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabaseAdmin
      .from('text_box_modules')
      .select(`
        *,
        blocks:text_box_blocks(*)
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
      .select('*')
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
    fetchIssueNewsBySection(issue.id, 'breaking').catch(e => { console.error('[Snapshot] breakingNews failed:', e.message); return [] }),
    fetchIssueNewsBySection(issue.id, 'beyond_feed').catch(e => { console.error('[Snapshot] beyondFeed failed:', e.message); return [] }),
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

  return {
    issue,
    formattedDate,
    businessSettings,
    sortedSections,
    isReview,
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
      *,
      prompt_module:prompt_modules(*),
      prompt:prompt_ideas(*)
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

async function fetchIssueNewsBySection(issueId: string, section: string) {
  const { data, error } = await supabaseAdmin
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
    .eq('issue_id', issueId)
    .eq('section', section)
    .order('position', { ascending: true })
    .limit(3)
  if (error) console.error(`[Snapshot] fetchIssueNewsBySection(${section}) error:`, error.message)
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
