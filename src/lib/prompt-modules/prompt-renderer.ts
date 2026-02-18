/**
 * Prompt Module Renderer
 *
 * Renders prompt modules with configurable block order.
 * Uses terminal styling (black background, white text, Courier font) for the prompt body.
 */

import { getBusinessSettings } from '../publication-settings'
import type { BlockStyleOptions } from '../blocks'
import type { PromptModule, PromptIdea, PromptBlockType } from '@/types/database'

/**
 * Context for rendering
 */
interface RenderContext {
  issueId?: string
  publicationId?: string
}

/**
 * Result of rendering a prompt mod
 */
interface RenderResult {
  html: string
  moduleName: string
  promptId: string | null
}

/**
 * Prompt Module Renderer
 * Renders prompt modules with configurable block order and terminal styling
 */
export class PromptModuleRenderer {
  /**
   * Wrap the content in the prompt section container
   * Uses standard section styling with header and content area
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
      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #ddd; border-radius: 10px; margin-top: 10px; background-color: #fff; box-shadow:0 4px 12px rgba(0,0,0,.15);">
        <tr>
          <td style="padding: 8px; background-color: ${styles.primaryColor}; border-top-left-radius: 10px; border-top-right-radius: 10px;">
            <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: ${styles.headingFont}; color: #ffffff; margin: 0; padding: 0;">${sectionName}</h2>
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
   * Render the title block
   */
  private static renderTitleBlock(title: string): string {
    return `<tr><td style="padding: 10px 10px 8px; font-size: 20px; font-weight: bold; text-align: center;">${title}</td></tr>`
  }

  /**
   * Render the body block with terminal styling
   * Black background, white text, Courier font
   */
  private static renderBodyBlock(promptText: string): string {
    // Convert line breaks to <br> tags for email compatibility
    const formattedText = promptText.replace(/\n/g, '<br>')

    return `
<tr>
  <td align="center" style="padding: 0 10px 10px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 550px; margin: 0 auto;">
      <tr>
        <td bgcolor="#000000" style="background-color: #000000; color: #FFFFFF; padding: 16px; border-radius: 6px; border: 2px solid #333; font-family: Courier New, Courier, monospace; font-size: 14px; line-height: 22px; text-align: left;">${formattedText}</td>
      </tr>
    </table>
  </td>
</tr>`
  }

  /**
   * Render a prompt mod with its blocks in the configured order
   */
  static async renderPromptModule(
    mod: PromptModule,
    prompt: PromptIdea | null,
    publicationId: string,
    context: RenderContext = {}
  ): Promise<RenderResult> {
    // If no prompt, return empty result
    if (!prompt) {
      return {
        html: '',
        moduleName: mod.name,
        promptId: null
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

    // Render blocks in order
    const blockOrder = mod.block_order as PromptBlockType[]
    let blocksHtml = ''

    for (const blockType of blockOrder) {
      if (blockType === 'title' && prompt.title) {
        blocksHtml += this.renderTitleBlock(prompt.title)
      }
      else if (blockType === 'body' && prompt.prompt_text) {
        blocksHtml += this.renderBodyBlock(prompt.prompt_text)
      }
    }

    // Wrap in section container
    const html = this.wrapInSection(mod.name, blocksHtml, styles)

    return {
      html,
      moduleName: mod.name,
      promptId: prompt.id
    }
  }

  /**
   * Render for preview (same as normal)
   */
  static async renderForPreview(
    mod: PromptModule,
    prompt: PromptIdea,
    publicationId: string
  ): Promise<string> {
    const result = await this.renderPromptModule(mod, prompt, publicationId, {})
    return result.html
  }

  /**
   * Render for archive (static HTML)
   */
  static renderForArchive(
    moduleName: string,
    prompt: PromptIdea,
    blockOrder: PromptBlockType[],
    styles: { primaryColor: string; headingFont: string; bodyFont: string }
  ): string {
    let blocksHtml = ''

    for (const blockType of blockOrder) {
      if (blockType === 'title' && prompt.title) {
        blocksHtml += `<tr><td style="padding: 10px 10px 8px; font-size: 20px; font-weight: bold; text-align: center;">${prompt.title}</td></tr>`
      }
      else if (blockType === 'body' && prompt.prompt_text) {
        const formattedText = prompt.prompt_text.replace(/\n/g, '<br>')
        blocksHtml += `
<tr>
  <td align="center" style="padding: 0 10px 10px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 550px; margin: 0 auto;">
      <tr>
        <td bgcolor="#000000" style="background-color: #000000; color: #FFFFFF; padding: 16px; border-radius: 6px; border: 2px solid #333; font-family: Courier New, Courier, monospace; font-size: 14px; line-height: 22px; text-align: left;">${formattedText}</td>
      </tr>
    </table>
  </td>
</tr>`
      }
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
   * Render all prompt modules for an issue
   */
  static async renderAllModules(
    modules: PromptModule[],
    prompts: Map<string, PromptIdea | null>,
    publicationId: string,
    context: RenderContext = {}
  ): Promise<RenderResult[]> {
    const results: RenderResult[] = []

    // Sort by display_order
    const sorted = [...modules].sort((a, b) => a.display_order - b.display_order)

    for (const mod of sorted) {
      const prompt = prompts.get(mod.id) || null
      const result = await this.renderPromptModule(mod, prompt, publicationId, context)
      results.push(result)
    }

    return results
  }

  /**
   * Generate combined HTML for all prompt modules
   */
  static async generateCombinedHtml(
    modules: PromptModule[],
    prompts: Map<string, PromptIdea | null>,
    publicationId: string,
    context: RenderContext = {}
  ): Promise<string> {
    const results = await this.renderAllModules(modules, prompts, publicationId, context)
    return results.map(r => r.html).join('')
  }
}
