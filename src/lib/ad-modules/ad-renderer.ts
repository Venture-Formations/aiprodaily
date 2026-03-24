import { wrapTrackingUrl, type LinkType } from '../url-tracking'
import { getBusinessSettings } from '../publication-settings'
import { renderBlock } from '../blocks'
import type { BlockType, BlockStyleOptions, BlockData } from '../blocks'
import type {
  AdModule,
  ModuleAd,
  AdBlockType,
  ModuleAdWithAdvertiser
} from '@/types/database'

/**
 * Context for rendering (issue info for URL tracking)
 */
interface RenderContext {
  issueDate?: string
  issueId?: string
  mailerliteIssueId?: string
}

/**
 * Result of rendering an ad mod
 */
interface RenderResult {
  html: string
  moduleName: string
  adId: string | null
}

/**
 * Ad Module Renderer
 * Renders ad modules with configurable block order
 * Uses the global block library for rendering individual blocks
 */
export class AdModuleRenderer {
  /**
   * Convert ad data to BlockData format for the global renderer
   */
  private static toBlockData(
    ad: ModuleAd | ModuleAdWithAdvertiser,
    trackingUrl: string
  ): BlockData {
    return {
      title: ad.title,
      body: ad.body,
      image_url: ad.image_url,
      image_alt: ad.image_alt || undefined,
      button_text: ad.button_text,
      button_url: ad.button_url,
      cta_text: ad.cta_text || undefined,
      trackingUrl
    }
  }

  /**
   * Render a single block using the global block registry
   */
  private static renderBlockFromRegistry(
    blockType: AdBlockType,
    ad: ModuleAd | ModuleAdWithAdvertiser,
    trackingUrl: string,
    styles: BlockStyleOptions
  ): string {
    const blockData = this.toBlockData(ad, trackingUrl)
    return renderBlock(blockType as BlockType, blockData, styles)
  }

  /**
   * Wrap the content in the standard section container
   */
  private static wrapInSection(
    sectionName: string,
    content: string,
    styles: BlockStyleOptions,
    showHeader: boolean = true
  ): string {
    const headerRow = showHeader ? `
        <tr>
          <td style="padding: 8px; background-color: ${styles.primaryColor}; border-top-left-radius: 10px; border-top-right-radius: 10px;">
            <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: ${styles.headingFont}; color: #ffffff; margin: 0; padding: 0;">${sectionName}</h2>
          </td>
        </tr>` : ''
    return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width='100%' cellpadding='0' cellspacing='0' style='border: 1px solid #ddd; border-radius: 10px; background: #fff; font-family: ${styles.bodyFont}; font-size: 16px; line-height: 26px; box-shadow:0 4px 12px rgba(0,0,0,.15); margin-top: 10px; overflow: hidden;'>
        ${headerRow}
        ${content}
      </table>
    </td>
  </tr>
</table>
<br>`
  }

  /**
   * Render an ad mod with its blocks in the configured order
   */
  static async renderAdModule(
    mod: AdModule,
    ad: ModuleAd | ModuleAdWithAdvertiser | null,
    publicationId: string,
    context: RenderContext = {}
  ): Promise<RenderResult> {
    // If no ad, return empty result
    if (!ad) {
      return {
        html: '',
        moduleName: mod.name,
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

    // Generate tracked URL for links (type='ad' triggers clicked_ad field update)
    const baseUrl = ad.button_url || '#'
    const trackedUrl = baseUrl !== '#' && context.issueDate
      ? wrapTrackingUrl(
          baseUrl,
          mod.name,
          context.issueDate,
          context.mailerliteIssueId,
          context.issueId,
          'ad'
        )
      : baseUrl

    // Render each block in the configured order using global block library
    const blockOrder = this.ensureCtaBlock(mod.block_order as AdBlockType[], ad)
    let blocksHtml = ''

    for (const blockType of blockOrder) {
      blocksHtml += this.renderBlockFromRegistry(blockType, ad, trackedUrl, styles)
    }

    // Wrap in section container
    const html = this.wrapInSection(mod.name, blocksHtml, styles, mod.show_name !== false)

    return {
      html,
      moduleName: mod.name,
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

    for (const mod of sortedModules) {
      const ad = ads.get(mod.id) || null
      const result = await this.renderAdModule(mod, ad, publicationId, context)
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
   * Render a single ad mod for preview (without tracking)
   * Used by the ad preview API
   */
  static async renderForPreview(
    mod: AdModule,
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

    // Render blocks using global block library
    const blockOrder = this.ensureCtaBlock(mod.block_order as AdBlockType[], ad)
    let blocksHtml = ''

    for (const blockType of blockOrder) {
      blocksHtml += this.renderBlockFromRegistry(blockType, ad, linkUrl, styles)
    }

    return this.wrapInSection(mod.name, blocksHtml, styles, mod.show_name !== false)
  }

  /**
   * Render an ad for the website archive (static HTML, no tracking needed)
   * Uses the global block library for consistent rendering
   */
  static renderForArchive(
    moduleName: string,
    ad: {
      title?: string
      body?: string
      image_url?: string
      image_alt?: string | null
      button_text?: string
      button_url?: string
      cta_text?: string | null
    },
    blockOrder: AdBlockType[],
    styles: { primaryColor: string; headingFont: string; bodyFont: string }
  ): string {
    const linkUrl = ad.button_url || '#'

    // Convert to BlockData format
    const blockData: BlockData = {
      title: ad.title,
      body: ad.body,
      image_url: ad.image_url,
      image_alt: ad.image_alt || undefined,
      button_text: ad.button_text,
      button_url: ad.button_url,
      cta_text: ad.cta_text || undefined,
      trackingUrl: linkUrl
    }

    // Auto-inject cta block if ad has cta_text and it's not already in block_order
    const effectiveBlockOrder = this.ensureCtaBlock(blockOrder, ad as any)

    // Render each block using the global registry
    let blocksHtml = ''
    for (const blockType of effectiveBlockOrder) {
      blocksHtml += renderBlock(blockType as BlockType, blockData, styles)
    }

    return this.wrapInSection(moduleName, blocksHtml, styles)
  }

  /**
   * Auto-inject 'cta' into block_order if the ad has cta_text and 'cta' isn't already present.
   * Inserts after 'body' if found, otherwise appends at the end.
   */
  private static ensureCtaBlock(
    blockOrder: AdBlockType[],
    ad: { cta_text?: string | null }
  ): AdBlockType[] {
    if (!ad.cta_text || blockOrder.includes('cta')) return blockOrder
    const order = [...blockOrder]
    const bodyIdx = order.indexOf('body')
    if (bodyIdx >= 0) {
      order.splice(bodyIdx + 1, 0, 'cta')
    } else {
      order.push('cta')
    }
    return order
  }
}
