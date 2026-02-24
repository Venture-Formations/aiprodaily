// Main orchestrator: generates the complete newsletter HTML

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
import { buildIssueSnapshot } from './build-snapshot'
import type { IssueSnapshot } from './types'

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
  const snapshot = await buildIssueSnapshot(issue, options)
  return renderNewsletterFromSnapshot(snapshot)
}

/**
 * Render a newsletter from a pre-built snapshot.
 * The snapshot contains all module configs and business settings,
 * so this function does not fetch them again.
 *
 * Note: Still async because individual section generators make their own
 * content-specific DB calls (e.g., polls fetch poll options, ads fetch ad content).
 * Making those pure is Phase 2.2b.
 */
export async function renderNewsletterFromSnapshot(
  snapshot: IssueSnapshot
): Promise<string> {
  const { issue, formattedDate, businessSettings, sortedSections, isReview } = snapshot

  try {
    console.log('Generating full newsletter HTML for issue:', issue?.id, isReview ? '(review)' : '(final)')

    // Filter active module_articles and sort by rank (custom order) for logging
    const activeArticles = (issue.module_articles || [])
      .filter((article: any) => article.is_active)
      .sort((a: any, b: any) => (a.rank || 999) - (b.rank || 999))

    console.log('Active mod articles to render:', activeArticles.length)
    console.log('Article order:', activeArticles.map((a: any) => `${a.headline} (rank: ${a.rank})`).join(', '))

    console.log('Combined section order:', sortedSections.map(item =>
      `${item.data.name} (${item.type}, order: ${item.data.display_order})`
    ).join(', '))

    console.log('Formatted date:', formattedDate)

    // Generate header and footer with tracking parameters
    const mailerliteId = issue.mailerlite_issue_id || undefined
    const header = await generateNewsletterHeader(formattedDate, issue.date, mailerliteId, issue.publication_id)
    const footer = await generateNewsletterFooter(issue.date, mailerliteId, issue.publication_id)

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

    // Generate sections in order based on merged configuration
    let sectionsHtml = ''
    let articleModuleCount = 0
    for (const item of sortedSections) {
      if (item.type === 'ad_module') {
        const adModuleHtml = await generateAdModulesSection(issue, item.data.id, businessSettings)
        if (adModuleHtml) {
          sectionsHtml += adModuleHtml
        }
      } else if (item.type === 'poll_module') {
        const pollModuleHtml = await generatePollModulesSection(issue, item.data.id)
        if (pollModuleHtml) {
          sectionsHtml += pollModuleHtml
        }
      } else if (item.type === 'prompt_module') {
        const promptModuleHtml = await generatePromptModulesSection(issue, item.data.id)
        if (promptModuleHtml) {
          sectionsHtml += promptModuleHtml
        }
      } else if (item.type === 'article_module') {
        articleModuleCount++
        const articleModuleHtml = await generateArticleModuleSection(issue, item.data.id, articleModuleCount === 2, businessSettings)
        if (articleModuleHtml) {
          sectionsHtml += articleModuleHtml
        }
      } else if (item.type === 'text_box_module') {
        const textBoxModuleHtml = await generateTextBoxModuleSection(issue, item.data.id)
        if (textBoxModuleHtml) {
          sectionsHtml += textBoxModuleHtml
        }
      } else if (item.type === 'feedback_module') {
        const feedbackModuleHtml = await generateFeedbackModuleSection(issue, item.data.id)
        if (feedbackModuleHtml) {
          sectionsHtml += feedbackModuleHtml
        }
      } else if (item.type === 'sparkloop_rec_module') {
        const slRecHtml = await generateSparkLoopRecModuleSection(issue, item.data.id, businessSettings)
        if (slRecHtml) {
          sectionsHtml += slRecHtml
        }
      } else {
        const section = item.data
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
          const breakingNewsHtml = await generateBreakingNewsSection(issue, businessSettings)
          if (breakingNewsHtml) {
            sectionsHtml += breakingNewsHtml
          }
        }
        else if (section.section_type === 'beyond_the_feed') {
          const beyondFeedHtml = await generateBeyondTheFeedSection(issue, businessSettings)
          if (beyondFeedHtml) {
            sectionsHtml += beyondFeedHtml
          }
        }
      }
    }

    // Combine all sections (review banner first if applicable, then header, sections, footer)
    const html = reviewBanner + header + sectionsHtml + footer

    console.log('Full newsletter HTML generated, length:', html.length)
    return html

  } catch (error) {
    console.error('Error generating full newsletter HTML:', error)
    throw new Error(`HTML generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
