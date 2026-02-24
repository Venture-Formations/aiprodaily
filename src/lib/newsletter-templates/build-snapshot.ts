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

  return {
    issue,
    formattedDate,
    businessSettings,
    sortedSections,
    isReview,
  }
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
