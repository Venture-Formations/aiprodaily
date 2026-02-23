// Main orchestrator: generates the complete newsletter HTML

import { supabaseAdmin } from '../supabase'
import { generateNewsletterHeader, generateNewsletterFooter } from './layout'
import { generateArticleModuleSection } from './articles'
import {
  generateAdModulesSection,
} from './ads'
import {
  generatePollModulesSection,
  generateBreakingNewsSection,
  generateBeyondTheFeedSection,
  generateAIAppsSection,
  generatePromptModulesSection,
  generatePromptIdeasSection,
  generateTextBoxModuleSection,
  generateFeedbackModuleSection,
  generateSparkLoopRecModuleSection,
} from './sections'

// ==================== FULL NEWSLETTER HTML GENERATOR ====================

/**
 * Generate the complete newsletter HTML.
 * This is the single source of truth used by both preview and actual send.
 *
 * @param issue - The issue data with articles
 * @param options - Optional settings
 * @param options.isReview - Whether to include the review banner (default: false)
 * @returns The complete newsletter HTML
 */
export async function generateFullNewsletterHtml(
  issue: any,
  options: { isReview?: boolean } = {}
): Promise<string> {
  const { isReview = false } = options

  try {
    console.log('Generating full newsletter HTML for issue:', issue?.id, isReview ? '(review)' : '(final)')

    // Filter active module_articles and sort by rank (custom order) for logging
    const activeArticles = (issue.module_articles || [])
      .filter((article: any) => article.is_active)
      .sort((a: any, b: any) => (a.rank || 999) - (b.rank || 999))

    console.log('Active mod articles to render:', activeArticles.length)
    console.log('Article order:', activeArticles.map((a: any) => `${a.headline} (rank: ${a.rank})`).join(', '))

    // Fetch newsletter sections order (exclude legacy article section types - now handled by article_modules)
    const { data: allSections } = await supabaseAdmin
      .from('newsletter_sections')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    // Filter out legacy article section types (primary_articles and secondary_articles)
    // These are now handled by the article_modules system
    const sections = (allSections || []).filter(s =>
      s.section_type !== 'primary_articles' && s.section_type !== 'secondary_articles'
    )

    // Fetch ad modules for this publication
    const { data: adModules } = await supabaseAdmin
      .from('ad_modules')
      .select('*')
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    // Fetch poll modules for this publication
    const { data: pollModules } = await supabaseAdmin
      .from('poll_modules')
      .select('*')
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    // Fetch prompt modules for this publication
    const { data: promptModules } = await supabaseAdmin
      .from('prompt_modules')
      .select('*')
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    // Fetch article modules for this publication
    const { data: articleModules } = await supabaseAdmin
      .from('article_modules')
      .select('*')
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    // Fetch text box modules for this publication
    const { data: textBoxModules } = await supabaseAdmin
      .from('text_box_modules')
      .select(`
        *,
        blocks:text_box_blocks(*)
      `)
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    // Fetch sparkloop rec modules for this publication
    const { data: sparkloopRecModules } = await supabaseAdmin
      .from('sparkloop_rec_modules')
      .select('id, name, display_order, is_active, selection_mode, block_order, config, recs_count')
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    // Fetch feedback mod (singleton per publication)
    const { data: feedbackModules } = await supabaseAdmin
      .from('feedback_modules')
      .select('*')
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)

    console.log('Active newsletter sections:', sections?.map(s => `${s.name} (order: ${s.display_order})`).join(', '))
    console.log('Active ad modules:', adModules?.map(m => `${m.name} (order: ${m.display_order})`).join(', '))
    console.log('Active poll modules:', pollModules?.map(m => `${m.name} (order: ${m.display_order})`).join(', '))
    console.log('Active prompt modules:', promptModules?.map(m => `${m.name} (order: ${m.display_order})`).join(', '))
    console.log('Active article modules:', articleModules?.map(m => `${m.name} (order: ${m.display_order})`).join(', '))
    console.log('Active text box modules:', textBoxModules?.map(m => `${m.name} (order: ${m.display_order})`).join(', '))
    console.log('Active sparkloop rec modules:', sparkloopRecModules?.map(m => `${m.name} (order: ${m.display_order})`).join(', '))
    console.log('Active feedback modules:', feedbackModules?.map(m => `${m.name} (order: ${m.display_order})`).join(', '))

    // Format date using local date parsing
    const formatDate = (dateString: string) => {
      try {
        const [year, month, day] = dateString.split('-').map(Number)
        const date = new Date(year, month - 1, day)
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      } catch (e) {
        console.error('Date formatting error:', e)
        return dateString
      }
    }

    const formattedDate = formatDate(issue.date)
    console.log('Formatted date:', formattedDate)

    // Generate header and footer with tracking parameters
    const mailerliteId = issue.mailerlite_issue_id || undefined
    const header = await generateNewsletterHeader(formattedDate, issue.date, mailerliteId, issue.publication_id)
    const footer = await generateNewsletterFooter(issue.date, mailerliteId, issue.publication_id)

    // Note: Welcome section content is now handled by Text Box Modules
    // The legacy welcome section fields (welcome_intro, welcome_tagline, welcome_summary) are deprecated
    // Text box modules appear in the correct position based on their display_order in the unified sections list

    // Review banner for review emails
    const reviewBanner = isReview ? `
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin: 10px auto; max-width: 750px; background-color: #FEF3C7; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 12px; text-align: center;">
      <h3 style="margin: 0; color: #92400E; font-size: 18px; font-weight: bold;">📝 Newsletter Review</h3>
      <p style="margin: 8px 0 0 0; color: #92400E; font-size: 14px;">
        This is a preview of tomorrow's newsletter. Please review and make any necessary changes in the dashboard.
      </p>
    </td>
  </tr>
</table>
<br>` : ''

    // Section ID constants (stable across name changes)
    const SECTION_IDS = {
      AI_APPLICATIONS: '853f8d0b-bc76-473a-bfc6-421418266222',
      PROMPT_IDEAS: 'a917ac63-6cf0-428b-afe7-60a74fbf160b'
    }

    // Merge newsletter sections, ad modules, poll modules, prompt modules, article modules, text box modules, and feedback modules into a single sorted list
    type SectionItem =
      | { type: 'section'; data: any }
      | { type: 'ad_module'; data: any }
      | { type: 'poll_module'; data: any }
      | { type: 'prompt_module'; data: any }
      | { type: 'article_module'; data: any }
      | { type: 'text_box_module'; data: any }
      | { type: 'feedback_module'; data: any }
      | { type: 'sparkloop_rec_module'; data: any }

    const allItems: SectionItem[] = [
      ...(sections || []).map(s => ({ type: 'section' as const, data: s })),
      ...(adModules || []).map(m => ({ type: 'ad_module' as const, data: m })),
      ...(pollModules || []).map(m => ({ type: 'poll_module' as const, data: m })),
      ...(promptModules || []).map(m => ({ type: 'prompt_module' as const, data: m })),
      ...(articleModules || []).map(m => ({ type: 'article_module' as const, data: m })),
      ...(textBoxModules || []).map(m => ({ type: 'text_box_module' as const, data: m })),
      ...(feedbackModules || []).map(m => ({ type: 'feedback_module' as const, data: m })),
      ...(sparkloopRecModules || []).map(m => ({ type: 'sparkloop_rec_module' as const, data: m }))
    ].sort((a, b) => (a.data.display_order ?? 999) - (b.data.display_order ?? 999))

    console.log('Combined section order:', allItems.map(item =>
      `${item.data.name} (${item.type}, order: ${item.data.display_order})`
    ).join(', '))

    // Generate sections in order based on merged configuration
    let sectionsHtml = ''
    let articleModuleCount = 0
    for (const item of allItems) {
      if (item.type === 'ad_module') {
        // Generate single ad mod section
        const adModuleHtml = await generateAdModulesSection(issue, item.data.id)
        if (adModuleHtml) {
          sectionsHtml += adModuleHtml
        }
      } else if (item.type === 'poll_module') {
        // Generate single poll mod section
        const pollModuleHtml = await generatePollModulesSection(issue, item.data.id)
        if (pollModuleHtml) {
          sectionsHtml += pollModuleHtml
        }
      } else if (item.type === 'prompt_module') {
        // Generate single prompt mod section
        const promptModuleHtml = await generatePromptModulesSection(issue, item.data.id)
        if (promptModuleHtml) {
          sectionsHtml += promptModuleHtml
        }
      } else if (item.type === 'article_module') {
        // Generate single article mod section (second one / Updates in AI gets the unsubscribe link)
        articleModuleCount++
        const articleModuleHtml = await generateArticleModuleSection(issue, item.data.id, articleModuleCount === 2)
        if (articleModuleHtml) {
          sectionsHtml += articleModuleHtml
        }
      } else if (item.type === 'text_box_module') {
        // Generate single text box mod section
        const textBoxModuleHtml = await generateTextBoxModuleSection(issue, item.data.id)
        if (textBoxModuleHtml) {
          sectionsHtml += textBoxModuleHtml
        }
      } else if (item.type === 'feedback_module') {
        // Generate feedback mod section
        const feedbackModuleHtml = await generateFeedbackModuleSection(issue, item.data.id)
        if (feedbackModuleHtml) {
          sectionsHtml += feedbackModuleHtml
        }
      } else if (item.type === 'sparkloop_rec_module') {
        // Generate sparkloop recommendation mod section
        const slRecHtml = await generateSparkLoopRecModuleSection(issue, item.data.id)
        if (slRecHtml) {
          sectionsHtml += slRecHtml
        }
      } else {
        const section = item.data
        // Check section_type to determine what to render
        // Note: primary_articles and secondary_articles are now handled by article_modules
        if (section.section_type === 'ai_applications' || section.id === SECTION_IDS.AI_APPLICATIONS) {
          const aiAppsHtml = await generateAIAppsSection(issue)
          if (aiAppsHtml) {
            sectionsHtml += aiAppsHtml
          }
        }
        else if (section.section_type === 'prompt_ideas' || section.id === SECTION_IDS.PROMPT_IDEAS) {
          const promptHtml = await generatePromptIdeasSection(issue)
          if (promptHtml) {
            sectionsHtml += promptHtml
          }
        }
        else if (section.section_type === 'breaking_news') {
          const breakingNewsHtml = await generateBreakingNewsSection(issue)
          if (breakingNewsHtml) {
            sectionsHtml += breakingNewsHtml
          }
        }
        else if (section.section_type === 'beyond_the_feed') {
          const beyondFeedHtml = await generateBeyondTheFeedSection(issue)
          if (beyondFeedHtml) {
            sectionsHtml += beyondFeedHtml
          }
        }
      }
    }

    // Combine all sections (review banner first if applicable, then header, sections, footer)
    // Note: Welcome content is now part of sectionsHtml via Text Box Modules
    const html = reviewBanner + header + sectionsHtml + footer

    console.log('Full newsletter HTML generated, length:', html.length)
    return html

  } catch (error) {
    console.error('Error generating full newsletter HTML:', error)
    throw new Error(`HTML generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
