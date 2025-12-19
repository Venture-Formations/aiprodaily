/**
 * Poll Module Renderer
 *
 * Renders poll modules with configurable block order.
 * Uses the global block library for rendering individual blocks.
 */

import { getBusinessSettings } from '../publication-settings'
import { renderBlock } from '../blocks'
import type { BlockType, BlockStyleOptions, BlockData } from '../blocks'
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
   * Convert poll data to BlockData format for the global renderer
   */
  private static toBlockData(
    poll: Poll | PollSnapshot,
    context: RenderContext
  ): BlockData {
    return {
      title: poll.title,
      question: poll.question,
      options: poll.options,
      image_url: poll.image_url,
      poll_id: poll.id,
      issue_id: context.issueId,
      base_url: context.baseUrl || process.env.NEXT_PUBLIC_SITE_URL || ''
    }
  }

  /**
   * Wrap the content in the poll section container
   * Uses gradient background like the legacy poll section
   */
  private static wrapInSection(
    sectionName: string,
    content: string,
    styles: BlockStyleOptions
  ): string {
    return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width='100%' cellpadding='0' cellspacing='0' style='border-radius: 10px; background: linear-gradient(135deg, ${styles.primaryColor} 0%, ${styles.secondaryColor || '#764ba2'} 100%); font-family: ${styles.bodyFont}; font-size: 16px; line-height: 26px; box-shadow:0 4px 12px rgba(0,0,0,.15); margin-top: 10px; overflow: hidden;'>
        <tr>
          <td style="padding: 16px; text-align: center;">
            <h2 style="font-size: 1.5em; line-height: 1.2em; font-family: ${styles.headingFont}; color: #ffffff; margin: 0 0 8px 0; padding: 0;">${sectionName}</h2>
          </td>
        </tr>
        ${content}
        <tr>
          <td style="padding: 16px;"></td>
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
      headingFont: settings.heading_font,
      bodyFont: settings.body_font
    }

    // Prepare block data
    const blockData = this.toBlockData(poll, context)

    // Render each block in the configured order
    const blockOrder = module.block_order as PollBlockType[]
    let blocksHtml = ''

    for (const blockType of blockOrder) {
      // Skip image block if poll doesn't have an image
      if (blockType === 'image' && !poll.image_url) {
        continue
      }

      // Map poll block types to block registry types
      // 'title' and 'image' can reuse existing renderers
      // 'question' and 'options' use new poll-specific renderers
      const mappedType = blockType as BlockType
      blocksHtml += renderBlock(mappedType, blockData, styles)
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
    styles: { primaryColor: string; secondaryColor?: string; headingFont: string; bodyFont: string }
  ): string {
    // For archive, we render a static version without voting links
    const blockStyles: BlockStyleOptions = {
      primaryColor: styles.primaryColor,
      secondaryColor: styles.secondaryColor || '#764ba2',
      headingFont: styles.headingFont,
      bodyFont: styles.bodyFont
    }

    // Prepare block data without response URLs
    const blockData: BlockData = {
      title: pollSnapshot.title,
      question: pollSnapshot.question,
      options: pollSnapshot.options,
      image_url: pollSnapshot.image_url,
      // No poll_id or base_url = options won't have clickable links
    }

    let blocksHtml = ''

    for (const blockType of blockOrder) {
      if (blockType === 'image' && !pollSnapshot.image_url) {
        continue
      }
      blocksHtml += renderBlock(blockType as BlockType, blockData, blockStyles)
    }

    // Use section wrapper
    return `
<div style="border-radius: 10px; background: linear-gradient(135deg, ${styles.primaryColor} 0%, ${styles.secondaryColor || '#764ba2'} 100%); font-family: ${styles.bodyFont}; margin: 16px 0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,.15);">
  <div style="padding: 16px; text-align: center;">
    <h3 style="font-size: 1.5em; color: #ffffff; margin: 0 0 8px 0; font-family: ${styles.headingFont};">${moduleName}</h3>
    ${pollSnapshot.question ? `<p style="color: #ffffff; font-size: 18px; margin: 0 0 16px 0;">${pollSnapshot.question}</p>` : ''}
    ${pollSnapshot.image_url && blockOrder.includes('image') ? `<img src="${pollSnapshot.image_url}" alt="" style="max-width: 100%; border-radius: 8px; margin-bottom: 16px;" />` : ''}
    <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">
      ${pollSnapshot.options.map((option, i) => `
        <span style="display: inline-block; padding: 10px 20px; background: ${i % 2 === 0 ? styles.primaryColor : (styles.secondaryColor || '#6B7280')}; color: #ffffff; border-radius: 8px; font-weight: 600;">
          ${option}
        </span>
      `).join('')}
    </div>
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
