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
      button_text: ad.button_text,
      button_url: ad.button_url,
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

    // Generate tracked URL for links (type='ad' triggers clicked_ad field update)
    const baseUrl = ad.button_url || '#'
    const trackedUrl = baseUrl !== '#' && context.issueDate
      ? wrapTrackingUrl(
          baseUrl,
          module.name,
          context.issueDate,
          context.mailerliteIssueId,
          context.issueId,
          'ad'
        )
      : baseUrl

    // Render each block in the configured order using global block library
    const blockOrder = module.block_order as AdBlockType[]
    let blocksHtml = ''

    for (const blockType of blockOrder) {
      blocksHtml += this.renderBlockFromRegistry(blockType, ad, trackedUrl, styles)
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

    // Render blocks using global block library
    const blockOrder = module.block_order as AdBlockType[]
    let blocksHtml = ''

    for (const blockType of blockOrder) {
      blocksHtml += this.renderBlockFromRegistry(blockType, ad, linkUrl, styles)
    }

    return this.wrapInSection(module.name, blocksHtml, styles)
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
      button_text?: string
      button_url?: string
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
      button_text: ad.button_text,
      button_url: ad.button_url,
      trackingUrl: linkUrl
    }

    // Render each block using the global registry
    let blocksHtml = ''
    for (const blockType of blockOrder) {
      blocksHtml += renderBlock(blockType as BlockType, blockData, styles)
    }

    return this.wrapInSection(moduleName, blocksHtml, styles)
  }
}
