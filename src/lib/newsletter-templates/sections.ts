// All other section generators: polls, breaking news, AI apps, prompts, text boxes, feedback, sparkloop, welcome, stubs

import { supabaseAdmin } from '../supabase'
import { wrapTrackingUrl } from '../url-tracking'
import { fetchBusinessSettings, getBreakingNewsEmoji } from './helpers'
import type { BusinessSettings } from './types'

// ==================== WELCOME SECTION ====================

export async function generateWelcomeSection(
  intro: string | null,
  tagline: string | null,
  summary: string | null,
  publication_id?: string,
  businessSettings?: BusinessSettings
): Promise<string> {
  // Skip if all 3 parts are empty
  if ((!intro || intro.trim() === '') &&
      (!tagline || tagline.trim() === '') &&
      (!summary || summary.trim() === '')) {
    return ''
  }

  // Fetch fonts from business settings (use passed-in settings if available)
  const { bodyFont } = businessSettings || await fetchBusinessSettings(publication_id)

  // Prepend personalized greeting to intro
  const greeting = `Hey, {$name|default('Accounting Pro')}!`
  const fullIntro = intro && intro.trim() ? `${greeting} ${intro.trim()}` : greeting

  // Build HTML for each part (only include non-empty parts)
  const introPart = greeting
    ? `<div style="font-size: 16px; line-height: 24px; color: #333; font-family: ${bodyFont}; margin-bottom: 8px;">${greeting.replace(/\n/g, '<br>')}</div>`
    : ''

  const taglinePart = tagline && tagline.trim()
    ? `<div style="font-size: 16px; line-height: 24px; color: #333; font-family: ${bodyFont}; font-weight: bold; margin-bottom: 8px;">${tagline.replace(/\n/g, '<br>')}</div>`
    : ''

  const summaryPart = summary && summary.trim()
    ? `<div style="font-size: 16px; line-height: 24px; color: #333; font-family: ${bodyFont};">${summary.replace(/\n/g, '<br>')}</div>`
    : ''

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ddd; border-radius: 10px; margin-top: 10px; background-color: #fff; box-shadow:0 4px 12px rgba(0,0,0,.15);">
        <tr>
          <td style="padding: 10px;">
            ${introPart}
            ${taglinePart}
            ${summaryPart}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<br>`
}

// ==================== POLL SECTION ====================

export async function generatePollSection(issue: { id: string; publication_id: string; status?: string; poll_id?: string | null }, businessSettings?: BusinessSettings): Promise<string> {
  try {
    // Fetch colors and website URL from business settings (use passed-in settings if available)
    const { primaryColor, tertiaryColor, headingFont, bodyFont } = businessSettings || await fetchBusinessSettings(issue.publication_id)
    // Use the main app domain for poll responses (where the poll pages are hosted)
    const baseUrl = process.env.NEXTAUTH_URL || 'https://www.aiprodaily.com'

    let pollData = null

    // For sent issues, use the poll that was sent with it (if any)
    if (issue.status === 'sent') {
      if (!issue.poll_id) {
        console.log(`[Polls] Sent issue ${issue.id} has no poll_id, skipping poll section`)
        return ''
      }
      // Fetch the specific poll that was sent with this issue
      const { data } = await supabaseAdmin
        .from('polls')
        .select('id, publication_id, title, question, options, is_active')
        .eq('id', issue.poll_id)
        .single()
      pollData = data
    } else {
      // For draft/review issues, get the current active poll
      const { data } = await supabaseAdmin
        .from('polls')
        .select('id, publication_id, title, question, options, is_active')
        .eq('publication_id', issue.publication_id)
        .eq('is_active', true)
        .limit(1)
        .single()
      pollData = data
    }

    if (!pollData) {
      console.log(`[Polls] No poll found for issue ${issue.id}, skipping poll section`)
      return ''
    }

    // Generate button HTML for each option
    // Button background: tertiary color, Button text: primary color
    const optionsHtml = pollData.options.map((option: string, index: number) => {
      const isLast = index === pollData.options.length - 1
      const paddingStyle = isLast ? 'padding:0;' : 'padding:0 0 8px 0;'

      return `
              <tr>
                <td style="${paddingStyle}">
                  <a href="${baseUrl}/api/polls/${pollData.id}/respond?option=${encodeURIComponent(option)}&amp;issue_id=${issue.id}&amp;email={$email}"
                     style="display:block; text-decoration:none; background:${tertiaryColor}; color:${primaryColor}; font-weight:bold;
                            font-size:16px; line-height:20px; padding:12px; border-radius:8px; text-align:center;">${option}</a>
                </td>
              </tr>`
    }).join('')

    return `
<!-- Poll card -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
        <tr>
          <td style="padding:5px;">
            <!-- Poll Box -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                   style="width:100%; max-width:650px; margin:10px auto; background-color:${primaryColor};
                          border:2px solid ${primaryColor}; border-radius:10px; font-family:Arial, sans-serif; box-shadow:0 4px 12px rgba(0,0,0,.15);">
              <tr>
                <td style="padding:14px; color:#ffffff; font-size:16px; line-height:1.5; text-align:center;">

                  <!-- Text Sections -->
                  <p style="margin:0 0 6px 0; font-weight:bold; font-size:20px; color:#ffffff; text-align:center;">${pollData.title}</p>
                  <p style="margin:0 0 14px 0; font-size:16px; color:#ffffff; text-align:center;">
                    ${pollData.question}
                  </p>

                  <!-- Button Stack: 1 per row, centered -->
                  <table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" style="margin:0 auto; width:100%; max-width:350px;">
${optionsHtml}
                  </table>

                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<br>`
  } catch (error) {
    console.error('Error generating poll section:', error)
    return ''
  }
}

// ==================== POLL MODULES SECTION ====================

/**
 * Generate HTML for a single poll mod.
 * This uses the new modular poll system with block ordering.
 *
 * @param issue - The issue data
 * @param moduleId - The poll mod ID to render
 * @returns The generated HTML for the poll mod
 */
export async function generatePollModulesSection(
  issue: { id: string; publication_id: string; status?: string },
  moduleId: string,
  businessSettings?: BusinessSettings
): Promise<string> {
  try {
    const { PollModuleSelector, PollModuleRenderer } = await import('../poll-modules')

    // Get all poll selections for this issue
    const selections = await PollModuleSelector.getIssuePollSelections(issue.id)

    // Find the selection for this specific mod
    const selection = selections.find(s => s.poll_module_id === moduleId)

    if (!selection || !selection.poll || !selection.poll_module) {
      console.log(`[PollModules] No selection/poll found for mod ${moduleId} in issue ${issue.id}`)
      return ''
    }

    // Render the poll mod
    const result = await PollModuleRenderer.renderPollModule(
      selection.poll_module,
      selection.poll,
      issue.publication_id,
      { issueId: issue.id },
      businessSettings
    )

    return result.html
  } catch (error) {
    console.error('[PollModules] Error generating poll mod section:', error)
    return ''
  }
}

// ==================== BREAKING NEWS ====================

export async function generateBreakingNewsSection(issue: any, businessSettings?: BusinessSettings): Promise<string> {
  try {
    console.log('Generating Breaking News section for issue:', issue?.id)

    // Fetch colors from business settings (use passed-in settings if available)
    const { primaryColor, headingFont, bodyFont } = businessSettings || await fetchBusinessSettings(issue?.publication_id)

    // Fetch selected Breaking News articles
    const { data: selections } = await supabaseAdmin
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
      .eq('issue_id', issue.id)
      .eq('section', 'breaking')
      .order('position', { ascending: true })
      .limit(3)

    if (!selections || selections.length === 0) {
      console.log('No Breaking News articles selected, skipping section')
      return ''
    }

    console.log(`Found ${selections.length} Breaking News articles`)

    // Generate HTML for each article
    const articlesHtml = selections.map((selection: any) => {
      const post = selection.post
      const title = post.ai_title || post.title
      const summary = post.ai_summary || post.description
      const sourceUrl = post.source_url || '#'
      const emoji = getBreakingNewsEmoji(title, summary)

      // Wrap URL with tracking
      const trackedUrl = sourceUrl !== '#'
        ? wrapTrackingUrl(sourceUrl, 'Breaking News', issue.date, issue.mailerlite_issue_id, issue.id)
        : '#'

      return `
<tr class='row'>
  <td class='column' style='padding:8px; vertical-align: top;'>
    <table width='100%' cellpadding='0' cellspacing='0' style='border: 1px solid #ddd; border-radius: 8px; background: #fff; font-family: ${bodyFont}; font-size: 16px; line-height: 26px; box-shadow:0 4px 12px rgba(0,0,0,.15);'>
      <tr><td style='padding: 10px 10px 4px; font-size: 20px; font-weight: bold;'>${emoji} <a href='${trackedUrl}' style='color: #000; text-decoration: underline;'>${title}</a></td></tr>
      <tr><td style='padding: 0 10px 10px;'>${summary}</td></tr>
    </table>
  </td>
</tr>`
    }).join('')

    return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; background-color: #f7f7f7;">
        <tr>
          <td style="padding: 8px; background-color: ${primaryColor}; border-top-left-radius: 10px; border-top-right-radius: 10px;">
            <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: ${headingFont}; color: #ffffff; margin: 0; padding: 0;">Breaking News</h2>
          </td>
        </tr>
        ${articlesHtml}
      </table>
    </td>
  </tr>
</table>
<br>`

  } catch (error) {
    console.error('Error generating Breaking News section:', error)
    return ''
  }
}

// ==================== BEYOND THE FEED ====================

export async function generateBeyondTheFeedSection(issue: any, businessSettings?: BusinessSettings): Promise<string> {
  try {
    console.log('Generating Beyond the Feed section for issue:', issue?.id)

    // Fetch colors from business settings (use passed-in settings if available)
    const { primaryColor, headingFont, bodyFont } = businessSettings || await fetchBusinessSettings(issue?.publication_id)

    // Fetch selected Beyond the Feed articles
    const { data: selections } = await supabaseAdmin
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
      .eq('issue_id', issue.id)
      .eq('section', 'beyond_feed')
      .order('position', { ascending: true })
      .limit(3)

    if (!selections || selections.length === 0) {
      console.log('No Beyond the Feed articles selected, skipping section')
      return ''
    }

    console.log(`Found ${selections.length} Beyond the Feed articles`)

    // Generate HTML for each article
    const articlesHtml = selections.map((selection: any) => {
      const post = selection.post
      const title = post.ai_title || post.title
      const summary = post.ai_summary || post.description
      const sourceUrl = post.source_url || '#'
      const emoji = getBreakingNewsEmoji(title, summary)

      // Wrap URL with tracking
      const trackedUrl = sourceUrl !== '#'
        ? wrapTrackingUrl(sourceUrl, 'Beyond the Feed', issue.date, issue.mailerlite_issue_id, issue.id)
        : '#'

      return `
<tr class='row'>
  <td class='column' style='padding:8px; vertical-align: top;'>
    <table width='100%' cellpadding='0' cellspacing='0' style='border: 1px solid #ddd; border-radius: 8px; background: #fff; font-family: ${bodyFont}; font-size: 16px; line-height: 26px; box-shadow:0 4px 12px rgba(0,0,0,.15);'>
      <tr><td style='padding: 10px 10px 4px; font-size: 20px; font-weight: bold;'>${emoji} <a href='${trackedUrl}' style='color: #000; text-decoration: underline;'>${title}</a></td></tr>
      <tr><td style='padding: 0 10px 10px;'>${summary}</td></tr>
    </table>
  </td>
</tr>`
    }).join('')

    return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #f7f7f7; border-radius: 10px; margin-top: 10px; background-color: #f7f7f7;">
        <tr>
          <td style="padding: 8px; background-color: ${primaryColor}; border-top-left-radius: 10px; border-top-right-radius: 10px;">
            <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: ${headingFont}; color: #ffffff; margin: 0; padding: 0;">Beyond the Feed</h2>
          </td>
        </tr>
        ${articlesHtml}
      </table>
    </td>
  </tr>
</table>
<br>`

  } catch (error) {
    console.error('Error generating Beyond the Feed section:', error)
    return ''
  }
}

// ==================== AI APPS ====================

export async function generateAIAppsSection(issue: any, businessSettings?: BusinessSettings): Promise<string> {
  try {
    console.log('Generating AI Apps section for issue:', issue?.id)

    // Try new mod-based rendering first
    const { AppModuleSelector, AppModuleRenderer } = await import('../ai-app-modules')

    const moduleSelections = await AppModuleSelector.getIssueSelections(issue.id)

    if (moduleSelections && moduleSelections.length > 0) {
      // Use new mod-based rendering
      console.log(`Found ${moduleSelections.length} AI app mod(s) for issue`)

      let combinedHtml = ''
      for (const selection of moduleSelections) {
        const mod = selection.ai_app_module
        const apps = selection.apps || []

        if (!mod || apps.length === 0) continue

        const result = await AppModuleRenderer.renderModule(
          mod,
          apps,
          issue.publication_id,
          {
            issueDate: issue.date,
            issueId: issue.id,
            mailerliteIssueId: issue.mailerlite_issue_id
          },
          businessSettings
        )

        combinedHtml += result.html
        console.log(`Rendered mod "${result.moduleName}" with ${result.appCount} apps`)
      }

      if (combinedHtml) {
        return combinedHtml
      }
    }

    // No modules configured
    console.log('No AI app modules found, skipping AI Apps section')
    return ''

  } catch (error) {
    console.error('Error generating AI Apps section:', error)
    return ''
  }
}

// ==================== PROMPT IDEAS ====================

/**
 * Generate a single prompt mod section (mod-based system)
 * Used when iterating through prompt_modules
 */
export async function generatePromptModulesSection(
  issue: { id: string; publication_id: string; status?: string },
  moduleId: string,
  businessSettings?: BusinessSettings
): Promise<string> {
  try {
    const { PromptModuleRenderer } = await import('../prompt-modules')

    // Directly query the specific selection for this mod
    const { data: selection, error } = await supabaseAdmin
      .from('issue_prompt_modules')
      .select(`
        *,
        prompt_module:prompt_modules(*),
        prompt:prompt_ideas(*)
      `)
      .eq('issue_id', issue.id)
      .eq('prompt_module_id', moduleId)
      .single()

    if (error) {
      console.log(`[PromptModules] No selection found for mod ${moduleId} in issue ${issue.id}: ${error.message}`)
      return ''
    }

    if (!selection || !selection.prompt || !selection.prompt_module) {
      console.log(`[PromptModules] Selection exists but prompt/mod is null for mod ${moduleId} in issue ${issue.id}`)
      console.log(`[PromptModules] Selection details: prompt_id=${selection?.prompt_id}, has_prompt=${!!selection?.prompt}, has_module=${!!selection?.prompt_module}`)
      return ''
    }

    // Render the prompt mod
    const result = await PromptModuleRenderer.renderPromptModule(
      selection.prompt_module,
      selection.prompt,
      issue.publication_id,
      { issueId: issue.id },
      businessSettings
    )

    return result.html
  } catch (error) {
    console.error('[PromptModules] Error generating prompt mod section:', error)
    return ''
  }
}

/**
 * Generate all prompt mod sections for an issue
 * Legacy function - used for backward compatibility
 * @deprecated Use generatePromptModulesSection with individual mod IDs instead
 */
export async function generatePromptIdeasSection(issue: any): Promise<string> {
  try {
    console.log('Generating Prompt Ideas section for issue:', issue?.id)

    const { PromptModuleSelector, PromptModuleRenderer } = await import('../prompt-modules')

    // Get all prompt selections for this issue
    const selections = await PromptModuleSelector.getIssuePromptSelections(issue.id)

    if (!selections || selections.length === 0) {
      console.log('No prompt mod selections for this issue')
      return ''
    }

    // Generate HTML for all modules
    let combinedHtml = ''
    for (const selection of selections) {
      if (selection.prompt && selection.prompt_module) {
        const result = await PromptModuleRenderer.renderPromptModule(
          selection.prompt_module,
          selection.prompt,
          issue.publication_id,
          { issueId: issue.id }
        )
        combinedHtml += result.html
      }
    }

    return combinedHtml

  } catch (error) {
    console.error('Error generating Prompt Ideas section:', error)
    return ''
  }
}

// ==================== TEXT BOX MODULES SECTION ====================

/**
 * Generate a single text box mod section
 * Uses the new modular text box system with block rendering
 */
export async function generateTextBoxModuleSection(
  issue: { id: string; publication_id: string; status?: string },
  moduleId: string,
  businessSettings?: BusinessSettings
): Promise<string> {
  try {
    const { TextBoxModuleSelector, TextBoxModuleRenderer } = await import('../text-box-modules')

    // Get all text box selections for this issue
    const selections = await TextBoxModuleSelector.getIssueSelections(issue.id)

    // Find the selection for this specific module (match by module.id)
    const selection = selections.find(s => s.module?.id === moduleId)

    if (!selection || !selection.module) {
      console.log(`[TextBoxModules] No selection/module found for module ${moduleId} in issue ${issue.id}`)
      return ''
    }

    // Build issue blocks map (blockId -> IssueTextBoxBlock)
    const issueBlocksMap = new Map<string, any>()
    for (const issueBlock of selection.issueBlocks || []) {
      issueBlocksMap.set(issueBlock.text_box_block_id, issueBlock)
    }

    // Render the text box module
    const result = await TextBoxModuleRenderer.renderModule(
      selection.module,
      selection.blocks || [],
      issueBlocksMap,
      issue.publication_id,
      { issueId: issue.id },
      businessSettings
    )

    return result.html
  } catch (error) {
    console.error('[TextBoxModules] Error generating text box mod section:', error)
    return ''
  }
}

// ==================== FEEDBACK MODULE ====================

export async function generateFeedbackModuleSection(
  issue: { id: string; publication_id: string; status?: string },
  moduleId: string,
  businessSettings?: BusinessSettings
): Promise<string> {
  try {
    const { FeedbackModuleSelector, FeedbackModuleRenderer } = await import('../feedback-modules')

    // Get the feedback mod with blocks
    const mod = await FeedbackModuleSelector.getFeedbackModuleWithBlocks(issue.publication_id)

    if (!mod || mod.id !== moduleId) {
      console.log(`[FeedbackModules] No feedback mod found for mod ${moduleId} in publication ${issue.publication_id}`)
      return ''
    }

    // Render the feedback mod
    const result = await FeedbackModuleRenderer.renderFeedbackModule(
      mod,
      issue.publication_id,
      { issueId: issue.id },
      businessSettings
    )

    return result.html
  } catch (error) {
    console.error('[FeedbackModules] Error generating feedback mod section:', error)
    return ''
  }
}

// ==================== SPARKLOOP REC MODULE ====================

export async function generateSparkLoopRecModuleSection(
  issue: { id: string; publication_id: string; status?: string },
  moduleId: string,
  businessSettings?: BusinessSettings
): Promise<string> {
  try {
    const { SparkLoopRecModuleSelector, SparkLoopRecModuleRenderer } = await import('../sparkloop-rec-modules')

    // Get mod config
    const { data: mod } = await supabaseAdmin
      .from('sparkloop_rec_modules')
      .select('id, name, recs_count')
      .eq('id', moduleId)
      .single()

    if (!mod) return ''

    // Get issue selections
    const { selections } = await SparkLoopRecModuleSelector.getIssueSelections(issue.id)
    const sel = selections.find(s => s.sparkloop_rec_module_id === moduleId)

    if (!sel || sel.ref_codes.length === 0 || sel.recommendations.length === 0) {
      console.log(`[SparkLoop Rec Module] No selections for mod ${mod.name} on issue ${issue.id}`)
      return ''
    }

    // Fetch business settings for consistent section styling (use passed-in settings if available)
    const { primaryColor, headingFont, bodyFont } = businessSettings || await fetchBusinessSettings(issue.publication_id)

    // Render cards
    const html = SparkLoopRecModuleRenderer.renderSection(
      mod.name,
      sel.recommendations.map(r => ({
        ref_code: r.ref_code,
        publication_name: r.publication_name,
        publication_logo: r.publication_logo,
        description: r.description,
      })),
      issue.id,
      primaryColor,
      headingFont,
      bodyFont
    )

    return html
  } catch (error) {
    console.error('[SparkLoop Rec Module] Error generating section:', error)
    return ''
  }
}

// ==================== STUB SECTIONS ====================
// Features not needed in this newsletter

export async function generateLocalEventsSection(issue: any): Promise<string> {
  console.log('Local Events section disabled for AI Accounting Daily')
  return ''
}

export async function generateWordleSection(issue: any): Promise<string> {
  console.log('Wordle section disabled for AI Accounting Daily')
  return ''
}

export async function generateMinnesotaGetawaysSection(issue: any): Promise<string> {
  console.log('Minnesota Getaways section disabled for AI Accounting Daily')
  return ''
}

export async function generateRoadWorkSection(issue: any): Promise<string> {
  console.log('Road Work section disabled for AI Accounting Daily')
  return ''
}
