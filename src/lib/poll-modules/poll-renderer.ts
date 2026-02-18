/**
 * Poll Module Renderer
 *
 * Renders poll modules with configurable block order.
 * Uses legacy poll styling for consistency with existing design.
 */

import { getBusinessSettings } from '../publication-settings'
import type { BlockStyleOptions } from '../blocks'
import { sanitizeAltText } from '../utils/sanitize-alt-text'
import type { PollModule, Poll, PollSnapshot, PollBlockType } from '@/types/database'

/**
 * Context for rendering (issue info for response URLs)
 */
interface RenderContext {
  issueId?: string
  publicationId?: string
  baseUrl?: string
}

/**
 * Result of rendering a poll module
 */
interface RenderResult {
  html: string
  moduleName: string
  pollId: string | null
}

/**
 * Poll Module Renderer
 * Renders poll modules with configurable block order
 */
export class PollModuleRenderer {
  /**
   * Wrap the content in the poll section container
   * Uses solid primary color background to match legacy poll design
   */
  private static wrapInSection(
    sectionName: string,
    content: string,
    styles: BlockStyleOptions
  ): string {
    // Note: sectionName is used for the module name, but the poll title/question
    // are rendered separately via block renderers
    return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
        <tr>
          <td style="padding:5px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                   style="width:100%; max-width:650px; margin:10px auto; background-color:${styles.primaryColor};
                          border:2px solid ${styles.primaryColor}; border-radius:10px; font-family:${styles.bodyFont}; box-shadow:0 4px 12px rgba(0,0,0,.15);">
              <tr>
                <td style="padding:14px; color:#ffffff; font-size:16px; line-height:1.5; text-align:center;">
                  ${content}
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
  }

  /**
   * Render a poll module with its blocks in the configured order
   */
  static async renderPollModule(
    module: PollModule,
    poll: Poll | PollSnapshot | null,
    publicationId: string,
    context: RenderContext = {}
  ): Promise<RenderResult> {
    // If no poll, return empty result
    if (!poll) {
      return {
        html: '',
        moduleName: module.name,
        pollId: null
      }
    }

    // Get publication styling
    const settings = await getBusinessSettings(publicationId)
    const styles: BlockStyleOptions = {
      primaryColor: settings.primary_color,
      secondaryColor: settings.secondary_color || '#764ba2',
      tertiaryColor: settings.tertiary_color || '#ffffff',
      headingFont: settings.heading_font,
      bodyFont: settings.body_font
    }

    // Render blocks in legacy poll style (not using generic block renderers)
    const blockOrder = module.block_order as PollBlockType[]
    let blocksHtml = ''
    const baseUrl = context.baseUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aiprodaily.com'

    for (const blockType of blockOrder) {
      if (blockType === 'title' && poll.title) {
        blocksHtml += `<p style="margin:0 0 6px 0; font-weight:bold; font-size:20px; color:#ffffff; text-align:center;">${poll.title}</p>`
      }
      else if (blockType === 'question' && poll.question) {
        blocksHtml += `<p style="margin:0 0 14px 0; font-size:16px; color:#ffffff; text-align:center;">${poll.question}</p>`
      }
      else if (blockType === 'image' && poll.image_url) {
        const pollAlt = sanitizeAltText((poll as any).image_alt || poll.title, 'Poll image')
        blocksHtml += `<img src="${poll.image_url}" alt="${pollAlt}" style="max-width:100%; height:auto; border-radius:8px; margin:0 0 14px 0;" />`
      }
      else if (blockType === 'options' && poll.options && poll.options.length > 0) {
        // Use tertiary color for button background, primary color for text
        const buttonBgColor = styles.tertiaryColor || '#ffffff'
        const buttonTextColor = styles.primaryColor

        const optionsHtml = poll.options.map((option: string, index: number) => {
          const isLast = index === poll.options.length - 1
          const paddingStyle = isLast ? 'padding:0;' : 'padding:0 0 8px 0;'
          const responseUrl = `${baseUrl}/api/polls/${poll.id}/respond?option=${encodeURIComponent(option)}&issue_id=${context.issueId || ''}&email={$email}`

          return `
            <tr>
              <td style="${paddingStyle}">
                <a href="${responseUrl}"
                   style="display:block; text-decoration:none; background:${buttonBgColor}; color:${buttonTextColor}; font-weight:bold;
                          font-size:16px; line-height:20px; padding:12px; border-radius:8px; text-align:center;">${option}</a>
              </td>
            </tr>`
        }).join('')

        blocksHtml += `
          <table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" style="margin:0 auto; width:100%; max-width:350px;">
            ${optionsHtml}
          </table>`
      }
    }

    // Wrap in section container
    const html = this.wrapInSection(module.name, blocksHtml, styles)

    return {
      html,
      moduleName: module.name,
      pollId: poll.id
    }
  }

  /**
   * Render for preview (same as normal, just without tracking)
   */
  static async renderForPreview(
    module: PollModule,
    poll: Poll | PollSnapshot,
    publicationId: string
  ): Promise<string> {
    const result = await this.renderPollModule(module, poll, publicationId, {})
    return result.html
  }

  /**
   * Render for archive (static HTML, no response links)
   */
  static renderForArchive(
    moduleName: string,
    pollSnapshot: PollSnapshot,
    blockOrder: PollBlockType[],
    styles: { primaryColor: string; secondaryColor?: string; tertiaryColor?: string; headingFont: string; bodyFont: string }
  ): string {
    // For archive, we render a static version without voting links
    let blocksHtml = ''
    const tertiaryColor = styles.tertiaryColor || '#ffffff'

    for (const blockType of blockOrder) {
      if (blockType === 'title' && pollSnapshot.title) {
        blocksHtml += `<p style="margin:0 0 6px 0; font-weight:bold; font-size:20px; color:#ffffff; text-align:center;">${pollSnapshot.title}</p>`
      }
      else if (blockType === 'question' && pollSnapshot.question) {
        blocksHtml += `<p style="margin:0 0 14px 0; font-size:16px; color:#ffffff; text-align:center;">${pollSnapshot.question}</p>`
      }
      else if (blockType === 'image' && pollSnapshot.image_url) {
        const archivePollAlt = sanitizeAltText((pollSnapshot as any).image_alt || pollSnapshot.title, 'Poll image')
        blocksHtml += `<img src="${pollSnapshot.image_url}" alt="${archivePollAlt}" style="max-width:100%; height:auto; border-radius:8px; margin:0 0 14px 0;" />`
      }
      else if (blockType === 'options' && pollSnapshot.options && pollSnapshot.options.length > 0) {
        // Static options display (no clickable links for archive)
        const optionsHtml = pollSnapshot.options.map((option: string, index: number) => {
          const isLast = index === pollSnapshot.options.length - 1
          const paddingStyle = isLast ? 'padding:0;' : 'padding:0 0 8px 0;'

          return `
            <tr>
              <td style="${paddingStyle}">
                <span style="display:block; background:${tertiaryColor}; color:${styles.primaryColor}; font-weight:bold;
                       font-size:16px; line-height:20px; padding:12px; border-radius:8px; text-align:center;">${option}</span>
              </td>
            </tr>`
        }).join('')

        blocksHtml += `
          <table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" style="margin:0 auto; width:100%; max-width:350px;">
            ${optionsHtml}
          </table>`
      }
    }

    // Use legacy poll section wrapper
    return `
<div style="max-width:650px; margin:10px auto; background-color:${styles.primaryColor}; border:2px solid ${styles.primaryColor}; border-radius:10px; font-family:${styles.bodyFont}; box-shadow:0 4px 12px rgba(0,0,0,.15);">
  <div style="padding:14px; color:#ffffff; font-size:16px; line-height:1.5; text-align:center;">
    ${blocksHtml}
  </div>
</div>`
  }

  /**
   * Render all poll modules for an issue
   */
  static async renderAllModules(
    modules: PollModule[],
    polls: Map<string, Poll | PollSnapshot | null>,
    publicationId: string,
    context: RenderContext = {}
  ): Promise<RenderResult[]> {
    const results: RenderResult[] = []

    // Sort by display_order
    const sorted = [...modules].sort((a, b) => a.display_order - b.display_order)

    for (const module of sorted) {
      const poll = polls.get(module.id) || null
      const result = await this.renderPollModule(module, poll, publicationId, context)
      results.push(result)
    }

    return results
  }

  /**
   * Generate combined HTML for all poll modules
   */
  static async generateCombinedHtml(
    modules: PollModule[],
    polls: Map<string, Poll | PollSnapshot | null>,
    publicationId: string,
    context: RenderContext = {}
  ): Promise<string> {
    const results = await this.renderAllModules(modules, polls, publicationId, context)
    return results.map(r => r.html).join('')
  }
}
