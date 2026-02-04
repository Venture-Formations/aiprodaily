/**
 * Text Box Module Renderer
 *
 * Renders text box modules as HTML for newsletters.
 * Supports static text, AI-generated content, and images.
 */

import { getBusinessSettings } from '../publication-settings'
import type { BlockStyleOptions } from '../blocks'
import type {
  TextBoxModule,
  TextBoxBlock,
  IssueTextBoxBlock,
  TextSize
} from '@/types/database'

/**
 * Context for rendering
 */
interface RenderContext {
  issueId?: string
  publicationId?: string
  isArchive?: boolean
}

/**
 * Result of rendering a text box module
 */
interface RenderResult {
  html: string
  moduleName: string
  moduleId: string
}

/**
 * Text size to CSS mapping
 */
const TEXT_SIZE_STYLES: Record<TextSize, { fontSize: string; fontWeight: string; lineHeight: string }> = {
  small: { fontSize: '14px', fontWeight: 'normal', lineHeight: '22px' },
  medium: { fontSize: '16px', fontWeight: 'normal', lineHeight: '26px' },
  large: { fontSize: '20px', fontWeight: '600', lineHeight: '30px' }
}

/**
 * Text Box Module Renderer
 */
export class TextBoxModuleRenderer {
  /**
   * Wrap content in the module section container
   * If show_name is false, renders without the header
   */
  private static wrapInSection(
    module: TextBoxModule,
    content: string,
    styles: BlockStyleOptions
  ): string {
    // If show_name is false, render without header (like Welcome section)
    if (!module.show_name) {
      return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ddd; border-radius: 10px; margin-top: 10px; background-color: #fff; box-shadow:0 4px 12px rgba(0,0,0,.15);">
        <tr class="row">
          <td class="column" style="padding:16px; vertical-align: top;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-family: ${styles.bodyFont}; font-size: 16px; line-height: 26px;">
              ${content}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<br>`
    }

    // Standard section with header
    return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ddd; border-radius: 10px; margin-top: 10px; background-color: #fff; box-shadow:0 4px 12px rgba(0,0,0,.15);">
        <tr>
          <td style="padding: 8px; background-color: ${styles.primaryColor}; border-top-left-radius: 10px; border-top-right-radius: 10px;">
            <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: ${styles.headingFont}; color: #ffffff; margin: 0; padding: 0;">${module.name}</h2>
          </td>
        </tr>
        <tr class="row">
          <td class="column" style="padding:8px; vertical-align: top;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-family: ${styles.bodyFont}; font-size: 16px; line-height: 26px;">
              ${content}
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
   * Render a static text block
   */
  private static renderStaticTextBlock(
    block: TextBoxBlock,
    issueBlock: IssueTextBoxBlock | null,
    styles: BlockStyleOptions
  ): string {
    // Use override content if available, otherwise use static content
    const content = issueBlock?.override_content || block.static_content || ''

    if (!content) {
      return ''
    }

    const textStyles = TEXT_SIZE_STYLES[block.text_size || 'medium']

    // Reset paragraph margins for consistent spacing
    const normalizedContent = content.replace(/<p/g, '<p style="margin: 0 0 4px 0;"')

    return `
<tr>
  <td style="padding: 12px 10px; font-size: ${textStyles.fontSize}; font-weight: ${textStyles.fontWeight}; line-height: ${textStyles.lineHeight};">
    ${normalizedContent}
  </td>
</tr>`
  }

  /**
   * Render an AI prompt block (generated content)
   */
  private static renderAIPromptBlock(
    block: TextBoxBlock,
    issueBlock: IssueTextBoxBlock | null,
    styles: BlockStyleOptions
  ): string {
    // Use override content first, then generated content
    const content = issueBlock?.override_content || issueBlock?.generated_content || ''

    if (!content) {
      // If no content, show placeholder in preview/draft mode
      if (issueBlock?.generation_status === 'pending') {
        return `
<tr>
  <td style="padding: 8px 10px; color: #999; font-style: italic;">
    [AI content pending generation]
  </td>
</tr>`
      }
      if (issueBlock?.generation_status === 'failed') {
        return `
<tr>
  <td style="padding: 8px 10px; color: #cc0000; font-style: italic;">
    [Content generation failed: ${issueBlock?.generation_error || 'Unknown error'}]
  </td>
</tr>`
      }
      return ''
    }

    // Convert line breaks to HTML and normalize paragraph margins
    let formattedContent = content.replace(/\n/g, '<br>')
    formattedContent = formattedContent.replace(/<p/g, '<p style="margin: 0 0 4px 0;"')

    // Apply bold and/or italic styling
    if (block.is_bold && block.is_italic) {
      formattedContent = `<strong><em>${formattedContent}</em></strong>`
    } else if (block.is_bold) {
      formattedContent = `<strong>${formattedContent}</strong>`
    } else if (block.is_italic) {
      formattedContent = `<em>${formattedContent}</em>`
    }

    return `
<tr>
  <td style="padding: 12px 10px; font-size: 16px; line-height: 26px;">
    ${formattedContent}
  </td>
</tr>`
  }

  /**
   * Render an image block
   */
  private static renderImageBlock(
    block: TextBoxBlock,
    issueBlock: IssueTextBoxBlock | null
  ): string {
    // Determine which image URL to use
    let imageUrl = ''

    if (block.image_type === 'static') {
      imageUrl = block.static_image_url || ''
    } else if (block.image_type === 'ai_generated') {
      // Use override URL first, then generated URL
      imageUrl = issueBlock?.override_image_url || issueBlock?.generated_image_url || ''
    }

    if (!imageUrl) {
      // Show placeholder for pending AI images
      if (block.image_type === 'ai_generated' && issueBlock?.generation_status === 'pending') {
        return `
<tr>
  <td align="center" style="padding: 10px;">
    <div style="background: #f0f0f0; padding: 40px; border-radius: 8px; color: #999;">
      [AI image pending generation]
    </div>
  </td>
</tr>`
      }
      return ''
    }

    return `
<tr>
  <td align="center" style="padding: 16px 10px;">
    <img src="${imageUrl}" alt="" style="max-width: 100%; height: auto; border-radius: 8px; display: block;" />
  </td>
</tr>`
  }

  /**
   * Render a complete text box module
   */
  static async renderModule(
    module: TextBoxModule,
    blocks: TextBoxBlock[],
    issueBlocks: Map<string, IssueTextBoxBlock>,
    publicationId: string,
    context: RenderContext = {}
  ): Promise<RenderResult> {
    // Get publication styling
    const settings = await getBusinessSettings(publicationId)
    const styles: BlockStyleOptions = {
      primaryColor: settings.primary_color,
      secondaryColor: settings.secondary_color || '#764ba2',
      tertiaryColor: settings.tertiary_color || '#ffffff',
      headingFont: settings.heading_font,
      bodyFont: settings.body_font
    }

    // Render blocks in order
    const activeBlocks = blocks.filter(b => b.is_active)
    let blocksHtml = ''

    for (const block of activeBlocks) {
      const issueBlock = issueBlocks.get(block.id) || null

      switch (block.block_type) {
        case 'static_text':
          blocksHtml += this.renderStaticTextBlock(block, issueBlock, styles)
          break
        case 'ai_prompt':
          blocksHtml += this.renderAIPromptBlock(block, issueBlock, styles)
          break
        case 'image':
          blocksHtml += this.renderImageBlock(block, issueBlock)
          break
      }
    }

    // Wrap in section container
    const html = this.wrapInSection(module, blocksHtml, styles)

    return {
      html,
      moduleName: module.name,
      moduleId: module.id
    }
  }

  /**
   * Render for preview (same as normal rendering)
   */
  static async renderForPreview(
    module: TextBoxModule,
    blocks: TextBoxBlock[],
    issueBlocks: Map<string, IssueTextBoxBlock>,
    publicationId: string
  ): Promise<string> {
    const result = await this.renderModule(module, blocks, issueBlocks, publicationId, {})
    return result.html
  }

  /**
   * Render for archive (static HTML, no database lookups)
   */
  static renderForArchive(
    moduleName: string,
    showName: boolean,
    blocksData: Array<{
      type: 'static_text' | 'ai_prompt' | 'image'
      content?: string
      imageUrl?: string
      textSize?: TextSize
      isBold?: boolean
      isItalic?: boolean
    }>,
    styles: { primaryColor: string; headingFont: string; bodyFont: string }
  ): string {
    let blocksHtml = ''

    for (const block of blocksData) {
      if (block.type === 'static_text' || block.type === 'ai_prompt') {
        if (block.content) {
          const textStyles = TEXT_SIZE_STYLES[block.textSize || 'medium']
          // Normalize paragraph margins for consistent spacing
          let formattedContent = block.content.replace(/\n/g, '<br>')
          formattedContent = formattedContent.replace(/<p/g, '<p style="margin: 0 0 4px 0;"')
          // Apply bold and/or italic styling for AI prompt blocks
          if (block.type === 'ai_prompt') {
            if (block.isBold && block.isItalic) {
              formattedContent = `<strong><em>${formattedContent}</em></strong>`
            } else if (block.isBold) {
              formattedContent = `<strong>${formattedContent}</strong>`
            } else if (block.isItalic) {
              formattedContent = `<em>${formattedContent}</em>`
            }
          }
          blocksHtml += `
<tr>
  <td style="padding: 12px 10px; font-size: ${textStyles.fontSize}; font-weight: ${textStyles.fontWeight}; line-height: ${textStyles.lineHeight};">
    ${formattedContent}
  </td>
</tr>`
        }
      } else if (block.type === 'image' && block.imageUrl) {
        blocksHtml += `
<tr>
  <td align="center" style="padding: 16px 10px;">
    <img src="${block.imageUrl}" alt="" style="max-width: 100%; height: auto; border-radius: 8px; display: block;" />
  </td>
</tr>`
      }
    }

    // Build section wrapper
    if (!showName) {
      return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ddd; border-radius: 10px; margin-top: 10px; background-color: #fff; box-shadow:0 4px 12px rgba(0,0,0,.15);">
        <tr class="row">
          <td class="column" style="padding:16px; vertical-align: top;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-family: ${styles.bodyFont}; font-size: 16px; line-height: 26px;">
              ${blocksHtml}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<br>`
    }

    return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ddd; border-radius: 10px; margin-top: 10px; background-color: #fff; box-shadow:0 4px 12px rgba(0,0,0,.15);">
        <tr>
          <td style="padding: 8px; background-color: ${styles.primaryColor}; border-top-left-radius: 10px; border-top-right-radius: 10px;">
            <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: ${styles.headingFont}; color: #ffffff; margin: 0; padding: 0;">${moduleName}</h2>
          </td>
        </tr>
        <tr class="row">
          <td class="column" style="padding:8px; vertical-align: top;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-family: ${styles.bodyFont}; font-size: 16px; line-height: 26px;">
              ${blocksHtml}
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
   * Get effective content for a block (respecting overrides)
   */
  static getEffectiveContent(
    block: TextBoxBlock,
    issueBlock: IssueTextBoxBlock | null
  ): { content: string | null; imageUrl: string | null } {
    if (block.block_type === 'static_text') {
      return {
        content: issueBlock?.override_content || block.static_content,
        imageUrl: null
      }
    }

    if (block.block_type === 'ai_prompt') {
      return {
        content: issueBlock?.override_content || issueBlock?.generated_content || null,
        imageUrl: null
      }
    }

    if (block.block_type === 'image') {
      if (block.image_type === 'static') {
        return {
          content: null,
          imageUrl: block.static_image_url
        }
      }
      return {
        content: null,
        imageUrl: issueBlock?.override_image_url || issueBlock?.generated_image_url || null
      }
    }

    return { content: null, imageUrl: null }
  }
}
