/**
 * Feedback Module Renderer
 *
 * Renders feedback modules for newsletters with configurable blocks:
 * - Title
 * - Static text (body, sign-off, etc.)
 * - Vote options (star ratings)
 * - Team photos (circular)
 */

import { getBusinessSettings } from '../publication-settings'
import type { BlockStyleOptions } from '../blocks'
import type { FeedbackModuleWithBlocks, FeedbackBlock, FeedbackVoteOption, FeedbackTeamMember } from '@/types/database'
import { FeedbackModuleSelector } from './feedback-selector'

/**
 * Context for rendering (issue info for response URLs)
 */
interface RenderContext {
  issueId?: string
  baseUrl?: string
}

/**
 * Result of rendering a feedback module
 */
interface RenderResult {
  html: string
  moduleName: string
}

/**
 * Feedback Module Renderer
 * Renders feedback modules with configurable blocks
 */
export class FeedbackModuleRenderer {
  /**
   * Generate star rating HTML
   */
  private static generateStarRating(count: number, color: string = '#FFD700'): string {
    const fullStar = '★'
    return `<span style="color:${color}; font-size:18px; letter-spacing:2px;">${fullStar.repeat(count)}</span>`
  }

  /**
   * Wrap content in the feedback section container
   * Uses light border styling similar to text box modules
   */
  private static wrapInSection(
    sectionName: string,
    content: string,
    styles: BlockStyleOptions,
    showHeader: boolean = false
  ): string {
    const headerHtml = showHeader ? `
      <tr>
        <td style="background-color:${styles.primaryColor}; padding:8px 16px; border-radius:10px 10px 0 0;">
          <span style="color:#ffffff; font-size:1.625em; font-weight:bold; font-family:${styles.headingFont}; line-height:1.16em;">
            ${sectionName}
          </span>
        </td>
      </tr>` : ''

    return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
        <tr>
          <td style="padding:5px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                   style="width:100%; max-width:650px; margin:10px auto; background-color:#ffffff;
                          border:1px solid #ddd; border-radius:10px; font-family:${styles.bodyFont}; box-shadow:0 4px 12px rgba(0,0,0,.15);">
              ${headerHtml}
              <tr>
                <td style="padding:20px; color:#1a1a1a; font-size:16px; line-height:1.6;">
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
   * Render title block
   */
  private static renderTitleBlock(block: FeedbackBlock, styles: BlockStyleOptions): string {
    if (!block.title_text) return ''
    return `<p style="margin:0 0 12px 0; font-weight:bold; font-size:22px; color:#1a1a1a; font-family:${styles.headingFont};">${block.title_text}</p>`
  }

  /**
   * Render static text block (for body, sign-off, etc.)
   */
  private static renderStaticTextBlock(block: FeedbackBlock, styles: BlockStyleOptions): string {
    if (!block.static_content) return ''

    let fontStyle = ''
    if (block.is_italic) fontStyle += 'font-style:italic;'
    if (block.is_bold) fontStyle += 'font-weight:bold;'

    return `<p style="margin:0 0 16px 0; font-size:16px; line-height:1.6; color:#333333; ${fontStyle}">${block.static_content}</p>`
  }

  /**
   * Render vote options block with star ratings
   */
  private static renderVoteOptionsBlock(
    block: FeedbackBlock,
    moduleId: string,
    issueId: string,
    styles: BlockStyleOptions,
    baseUrl: string
  ): string {
    if (!block.vote_options || block.vote_options.length === 0) return ''

    // Sort options by value descending (highest first)
    const sortedOptions = [...block.vote_options].sort((a, b) => b.value - a.value)

    const optionsHtml = sortedOptions.map((option, index) => {
      const isLast = index === sortedOptions.length - 1
      const paddingStyle = isLast ? 'padding:0;' : 'padding:0 0 8px 0;'
      const responseUrl = `${baseUrl}/api/feedback/${moduleId}/respond?value=${option.value}&label=${encodeURIComponent(option.label)}&email={$email}&issue_id=${issueId}`
      const stars = this.generateStarRating(option.value)

      return `
        <tr>
          <td style="${paddingStyle}">
            <a href="${responseUrl}"
               style="display:block; text-decoration:none; background:#f9fafb; color:#1a1a1a;
                      padding:12px 16px; border:1px solid #e5e7eb; border-radius:8px; text-align:left;">
              ${stars}
              <span style="color:${styles.primaryColor}; font-weight:600; font-size:16px; margin-left:8px;">${option.label}</span>
            </a>
          </td>
        </tr>`
    }).join('')

    return `
      <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%; max-width:450px; margin:0 0 16px 0;">
        ${optionsHtml}
      </table>`
  }

  /**
   * Render team photos block with circular images
   */
  private static renderTeamPhotosBlock(block: FeedbackBlock, styles: BlockStyleOptions): string {
    if (!block.team_photos || block.team_photos.length === 0) return ''

    const photosHtml = block.team_photos.map(member => `
      <td align="center" style="padding:4px 8px;">
        <img src="${member.image_url}" alt="${member.name}"
             style="width:60px; height:60px; border-radius:50%; object-fit:cover; border:2px solid #e5e7eb;" />
      </td>`
    ).join('')

    return `
      <table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" style="margin:8px auto 0;">
        <tr>
          ${photosHtml}
        </tr>
      </table>`
  }

  /**
   * Render a single block based on its type
   */
  private static renderBlock(
    block: FeedbackBlock,
    moduleId: string,
    issueId: string,
    styles: BlockStyleOptions,
    baseUrl: string
  ): string {
    if (!block.is_enabled) return ''

    switch (block.block_type) {
      case 'title':
        return this.renderTitleBlock(block, styles)
      case 'static_text':
        return this.renderStaticTextBlock(block, styles)
      case 'vote_options':
        return this.renderVoteOptionsBlock(block, moduleId, issueId, styles, baseUrl)
      case 'team_photos':
        return this.renderTeamPhotosBlock(block, styles)
      default:
        return ''
    }
  }

  /**
   * Render a feedback module with its blocks in order
   */
  static async renderFeedbackModule(
    module: FeedbackModuleWithBlocks,
    publicationId: string,
    context: RenderContext = {}
  ): Promise<RenderResult> {
    // If module is not active, return empty
    if (!module.is_active) {
      return {
        html: '',
        moduleName: module.name
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

    const baseUrl = context.baseUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aiprodaily.com'
    const issueId = context.issueId || ''

    // Render blocks in order (blocks are already sorted by display_order)
    const blocksHtml = module.blocks
      .filter(block => block.is_enabled)
      .map(block => this.renderBlock(block, module.id, issueId, styles, baseUrl))
      .join('')

    // Wrap in section container (no header shown for feedback)
    const html = this.wrapInSection(module.name, blocksHtml, styles, false)

    return {
      html,
      moduleName: module.name
    }
  }

  /**
   * Render for preview (same as normal render)
   */
  static async renderForPreview(
    module: FeedbackModuleWithBlocks,
    publicationId: string
  ): Promise<string> {
    const result = await this.renderFeedbackModule(module, publicationId, {})
    return result.html
  }

  /**
   * Render for archive (static HTML, no response links)
   */
  static async renderForArchive(
    module: FeedbackModuleWithBlocks,
    publicationId: string
  ): Promise<string> {
    // For archive, we render a static version without voting links
    if (!module.is_active) {
      return ''
    }

    const settings = await getBusinessSettings(publicationId)
    const styles: BlockStyleOptions = {
      primaryColor: settings.primary_color,
      secondaryColor: settings.secondary_color || '#764ba2',
      tertiaryColor: settings.tertiary_color || '#ffffff',
      headingFont: settings.heading_font,
      bodyFont: settings.body_font
    }

    let blocksHtml = ''

    for (const block of module.blocks) {
      if (!block.is_enabled) continue

      if (block.block_type === 'title') {
        blocksHtml += this.renderTitleBlock(block, styles)
      }
      else if (block.block_type === 'static_text') {
        blocksHtml += this.renderStaticTextBlock(block, styles)
      }
      else if (block.block_type === 'vote_options' && block.vote_options && block.vote_options.length > 0) {
        // Render static vote options (no links)
        const sortedOptions = [...block.vote_options].sort((a, b) => b.value - a.value)
        const optionsHtml = sortedOptions.map((option, index) => {
          const isLast = index === sortedOptions.length - 1
          const paddingStyle = isLast ? 'padding:0;' : 'padding:0 0 8px 0;'
          const stars = this.generateStarRating(option.value)

          return `
            <tr>
              <td style="${paddingStyle}">
                <span style="display:block; background:#f9fafb; color:#1a1a1a;
                        padding:12px 16px; border:1px solid #e5e7eb; border-radius:8px; text-align:left;">
                  ${stars}
                  <span style="color:${styles.primaryColor}; font-weight:600; font-size:16px; margin-left:8px;">${option.label}</span>
                </span>
              </td>
            </tr>`
        }).join('')

        blocksHtml += `
          <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%; max-width:450px; margin:0 0 16px 0;">
            ${optionsHtml}
          </table>`
      }
      else if (block.block_type === 'team_photos') {
        blocksHtml += this.renderTeamPhotosBlock(block, styles)
      }
    }

    return this.wrapInSection(module.name, blocksHtml, styles, false)
  }

  /**
   * Render by publication ID (fetches module with blocks)
   */
  static async renderByPublicationId(
    publicationId: string,
    context: RenderContext = {}
  ): Promise<RenderResult | null> {
    const module = await FeedbackModuleSelector.getFeedbackModuleWithBlocks(publicationId)
    if (!module) return null
    return this.renderFeedbackModule(module, publicationId, context)
  }
}
