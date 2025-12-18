import { wrapTrackingUrl } from '../url-tracking'
import { normalizeEmailHtml } from '../html-normalizer'
import { getBusinessSettings } from '../publication-settings'
import type {
  AdModule,
  ModuleAd,
  AdBlockType,
  ModuleAdWithAdvertiser
} from '@/types/database'

/**
 * Styling options passed to block renderers
 */
interface BlockStyleOptions {
  primaryColor: string
  headingFont: string
  bodyFont: string
}

/**
 * Context for rendering (issue info for URL tracking)
 */
interface RenderContext {
  issueDate?: string
  issueId?: string
  mailerliteIssueId?: string
}

/**
 * Result of rendering an ad module
 */
interface RenderResult {
  html: string
  moduleName: string
  adId: string | null
}

/**
 * Ad Module Renderer
 * Renders ad modules with configurable block order
 */
export class AdModuleRenderer {
  /**
   * Render a title block
   */
  private static renderTitleBlock(
    title: string | undefined,
    styles: BlockStyleOptions
  ): string {
    if (!title) return ''

    return `
        <tr>
          <td style='padding: 10px 10px 4px; font-size: 20px; font-weight: bold; text-align: left; font-family: ${styles.headingFont};'>
            ${title}
          </td>
        </tr>`
  }

  /**
   * Render an image block with optional link
   */
  private static renderImageBlock(
    imageUrl: string | undefined,
    linkUrl: string,
    title: string | undefined
  ): string {
    if (!imageUrl) return ''

    const altText = title || 'Advertisement'
    const imageTag = `<img src='${imageUrl}' alt='${altText}' style='max-width: 100%; max-height: 500px; border-radius: 4px; display: block; margin: 0 auto;'>`

    if (linkUrl && linkUrl !== '#') {
      return `
        <tr>
          <td style='padding: 0 12px; text-align: center;'>
            <a href='${linkUrl}'>${imageTag}</a>
          </td>
        </tr>`
    }

    return `
        <tr>
          <td style='padding: 0 12px; text-align: center;'>
            ${imageTag}
          </td>
        </tr>`
  }

  /**
   * Render a body block (HTML content)
   * Processes content for email compatibility
   */
  private static renderBodyBlock(
    body: string | undefined,
    linkUrl: string,
    styles: BlockStyleOptions
  ): string {
    if (!body) return ''

    // Normalize HTML for email compatibility
    let processedBody = normalizeEmailHtml(body)

    // Make the last sentence a hyperlink if we have a valid URL
    if (linkUrl && linkUrl !== '#' && processedBody) {
      processedBody = this.addLastSentenceLink(processedBody, linkUrl)
    }

    return `
        <tr>
          <td style='padding: 0 10px 10px; font-family: ${styles.bodyFont}; font-size: 16px; line-height: 24px; color: #333;'>
            ${processedBody}
          </td>
        </tr>`
  }

  /**
   * Render a button/CTA block
   */
  private static renderButtonBlock(
    buttonText: string | undefined,
    buttonUrl: string,
    styles: BlockStyleOptions
  ): string {
    if (!buttonUrl || buttonUrl === '#') return ''

    const text = buttonText || 'Learn More'

    return `
        <tr>
          <td style='padding: 10px; text-align: center;'>
            <a href='${buttonUrl}' style='display: inline-block; padding: 12px 24px; background-color: ${styles.primaryColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-family: ${styles.headingFont}; font-weight: bold; font-size: 14px;'>
              ${text}
            </a>
          </td>
        </tr>`
  }

  /**
   * Add hyperlink to the last sentence of body text
   * Adapted from newsletter-templates.ts advertorial logic
   */
  private static addLastSentenceLink(body: string, linkUrl: string): string {
    // Check for arrow CTA pattern (→ text)
    const arrowPattern = /(→\s*)([^<\n→]+?)(\s*<\/p>|\s*<\/strong>|\s*$)/i
    const arrowMatch = body.match(arrowPattern)

    if (arrowMatch && arrowMatch[2].trim().length > 3) {
      const arrow = arrowMatch[1]
      const ctaText = arrowMatch[2].trim()
      const afterCta = arrowMatch[3] || ''

      return body.replace(
        arrowPattern,
        `<strong>${arrow}</strong><a href='${linkUrl}' style='color: #000; text-decoration: underline; font-weight: bold;'>${ctaText}</a>${afterCta}`
      )
    }

    // Strip HTML to get plain text for sentence detection
    const plainText = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    // Find sentence-ending punctuation
    const sentenceEndPattern = /[.!?](?=\s+[A-Z]|$)/g
    const matches = Array.from(plainText.matchAll(sentenceEndPattern))

    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1] as RegExpMatchArray
      const lastPeriodIndex = lastMatch.index!

      let startIndex = 0
      if (matches.length > 1) {
        const secondLastMatch = matches[matches.length - 2] as RegExpMatchArray
        startIndex = secondLastMatch.index! + 1
      }

      const lastSentence = plainText.substring(startIndex, lastPeriodIndex + 1).trim()

      if (lastSentence.length > 5) {
        const escapedSentence = lastSentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const parts = escapedSentence.split(/\s+/)
        const flexiblePattern = parts.join('\\s*(?:<[^>]*>\\s*)*')
        const sentenceRegex = new RegExp(flexiblePattern, 'i')

        return body.replace(
          sentenceRegex,
          `<a href='${linkUrl}' style='color: #000; text-decoration: underline; font-weight: bold;'>$&</a>`
        )
      }
    }

    return body
  }

  /**
   * Render a single block based on its type
   */
  private static renderBlock(
    blockType: AdBlockType,
    ad: ModuleAd | ModuleAdWithAdvertiser,
    linkUrl: string,
    styles: BlockStyleOptions
  ): string {
    switch (blockType) {
      case 'title':
        return this.renderTitleBlock(ad.title, styles)
      case 'image':
        return this.renderImageBlock(ad.image_url, linkUrl, ad.title)
      case 'body':
        return this.renderBodyBlock(ad.body, linkUrl, styles)
      case 'button':
        return this.renderButtonBlock(ad.button_text, linkUrl, styles)
      default:
        console.warn(`[AdRenderer] Unknown block type: ${blockType}`)
        return ''
    }
  }

  /**
   * Wrap the content in the standard section container
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
      <table width='100%' cellpadding='0' cellspacing='0' style='border: 1px solid #ddd; border-radius: 10px; background: #fff; font-family: ${styles.bodyFont}; font-size: 16px; line-height: 26px; box-shadow:0 4px 12px rgba(0,0,0,.15); margin-top: 10px; overflow: hidden;'>
        <tr>
          <td style="padding: 8px; background-color: ${styles.primaryColor}; border-top-left-radius: 10px; border-top-right-radius: 10px;">
            <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: ${styles.headingFont}; color: #ffffff; margin: 0; padding: 0;">${sectionName}</h2>
          </td>
        </tr>
        ${content}
      </table>
    </td>
  </tr>
</table>
<br>`
  }

  /**
   * Render an ad module with its blocks in the configured order
   */
  static async renderAdModule(
    module: AdModule,
    ad: ModuleAd | ModuleAdWithAdvertiser | null,
    publicationId: string,
    context: RenderContext = {}
  ): Promise<RenderResult> {
    // If no ad, return empty result
    if (!ad) {
      return {
        html: '',
        moduleName: module.name,
        adId: null
      }
    }

    // Get publication styling
    const settings = await getBusinessSettings(publicationId)
    const styles: BlockStyleOptions = {
      primaryColor: settings.primary_color,
      headingFont: settings.heading_font,
      bodyFont: settings.body_font
    }

    // Generate tracked URL for links
    const baseUrl = ad.button_url || '#'
    const trackedUrl = baseUrl !== '#' && context.issueDate
      ? wrapTrackingUrl(
          baseUrl,
          module.name,
          context.issueDate,
          context.mailerliteIssueId,
          context.issueId
        )
      : baseUrl

    // Render each block in the configured order
    const blockOrder = module.block_order as AdBlockType[]
    let blocksHtml = ''

    for (const blockType of blockOrder) {
      blocksHtml += this.renderBlock(blockType, ad, trackedUrl, styles)
    }

    // Wrap in section container
    const html = this.wrapInSection(module.name, blocksHtml, styles)

    return {
      html,
      moduleName: module.name,
      adId: ad.id
    }
  }

  /**
   * Render multiple ad modules for an issue
   * Returns array of results in display_order
   */
  static async renderAllModules(
    modules: AdModule[],
    ads: Map<string, ModuleAd | ModuleAdWithAdvertiser | null>,
    publicationId: string,
    context: RenderContext = {}
  ): Promise<RenderResult[]> {
    const results: RenderResult[] = []

    // Sort modules by display_order
    const sortedModules = [...modules].sort((a, b) => a.display_order - b.display_order)

    for (const module of sortedModules) {
      const ad = ads.get(module.id) || null
      const result = await this.renderAdModule(module, ad, publicationId, context)
      results.push(result)
    }

    return results
  }

  /**
   * Generate combined HTML for all ad modules
   * Useful for inserting into newsletter template
   */
  static async generateCombinedHtml(
    modules: AdModule[],
    ads: Map<string, ModuleAd | ModuleAdWithAdvertiser | null>,
    publicationId: string,
    context: RenderContext = {}
  ): Promise<string> {
    const results = await this.renderAllModules(modules, ads, publicationId, context)
    return results
      .filter(r => r.html) // Only include modules with ads
      .map(r => r.html)
      .join('\n')
  }

  /**
   * Render a single ad module for preview (without tracking)
   * Used by the ad preview API
   */
  static async renderForPreview(
    module: AdModule,
    ad: ModuleAd | ModuleAdWithAdvertiser,
    publicationId: string
  ): Promise<string> {
    const settings = await getBusinessSettings(publicationId)
    const styles: BlockStyleOptions = {
      primaryColor: settings.primary_color,
      headingFont: settings.heading_font,
      bodyFont: settings.body_font
    }

    // Use the raw button URL without tracking for preview
    const linkUrl = ad.button_url || '#'

    // Render blocks
    const blockOrder = module.block_order as AdBlockType[]
    let blocksHtml = ''

    for (const blockType of blockOrder) {
      blocksHtml += this.renderBlock(blockType, ad, linkUrl, styles)
    }

    return this.wrapInSection(module.name, blocksHtml, styles)
  }

  /**
   * Render an ad for the website archive (static HTML, no tracking needed)
   */
  static renderForArchive(
    moduleName: string,
    ad: {
      title?: string
      body?: string
      image_url?: string
      button_text?: string
      button_url?: string
    },
    blockOrder: AdBlockType[],
    styles: { primaryColor: string; headingFont: string; bodyFont: string }
  ): string {
    const linkUrl = ad.button_url || '#'
    let blocksHtml = ''

    for (const blockType of blockOrder) {
      switch (blockType) {
        case 'title':
          blocksHtml += this.renderTitleBlock(ad.title, styles)
          break
        case 'image':
          blocksHtml += this.renderImageBlock(ad.image_url, linkUrl, ad.title)
          break
        case 'body':
          blocksHtml += this.renderBodyBlock(ad.body, linkUrl, styles)
          break
        case 'button':
          blocksHtml += this.renderButtonBlock(ad.button_text, linkUrl, styles)
          break
      }
    }

    return this.wrapInSection(moduleName, blocksHtml, styles)
  }
}
