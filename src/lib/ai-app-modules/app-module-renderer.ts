/**
 * AI App Module Renderer
 * Renders AI app modules with configurable block order and per-block settings
 */

import { wrapTrackingUrl, type LinkType } from '../url-tracking'
import { getBusinessSettings } from '../publication-settings'
import { sanitizeAltText } from '../utils/sanitize-alt-text'
import type {
  AIAppModule,
  AIApplication,
  AIAppBlockType,
  ProductCardLayoutMode,
  ProductCardLogoStyle,
  ProductCardLogoPosition,
  ProductCardTextSize,
  ProductCardBlockConfig
} from '@/types/database'

/**
 * Size mapping for title text
 */
const TITLE_SIZES: Record<ProductCardTextSize, string> = {
  small: '14px',
  medium: '16px',
  large: '18px'
}

/**
 * Size mapping for description text
 */
const DESCRIPTION_SIZES: Record<ProductCardTextSize, string> = {
  small: '12px',
  medium: '14px',
  large: '16px'
}

/**
 * Default block config when none exists
 */
const DEFAULT_BLOCK_CONFIG: ProductCardBlockConfig = {
  logo: { enabled: true, style: 'square', position: 'left' },
  title: { enabled: true, size: 'medium' },
  description: { enabled: true, size: 'medium' },
  tagline: { enabled: false, size: 'medium' },
  image: { enabled: false },
  button: { enabled: false }
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
 * Result of rendering an app module
 */
interface RenderResult {
  html: string
  moduleName: string
  appCount: number
}

/**
 * Style options for rendering
 */
interface BlockStyleOptions {
  primaryColor: string
  secondaryColor?: string
  tertiaryColor?: string
  headingFont: string
  bodyFont: string
  // Layout settings (Product Cards)
  layoutMode: ProductCardLayoutMode
  blockConfig: ProductCardBlockConfig
  // Display settings
  showEmoji: boolean
  showNumbers: boolean
  // Legacy settings (fallback)
  logoStyle: ProductCardLogoStyle
  titleSize: ProductCardTextSize
  descriptionSize: ProductCardTextSize
}

/**
 * Get emoji for an AI app based on name/category
 */
function getAppEmoji(app: AIApplication): string {
  const name = (app.app_name || '').toLowerCase()
  const category = (app.category || '').toLowerCase()

  if (category.includes('accounting') || category.includes('bookkeeping')) return '📊'
  if (category.includes('tax') || category.includes('compliance')) return '📋'
  if (category.includes('payroll')) return '💰'
  if (category.includes('finance') || category.includes('analysis')) return '📈'
  if (category.includes('expense')) return '🧾'
  if (category.includes('client')) return '🤝'
  if (category.includes('productivity')) return '⚡'
  if (category.includes('hr') || category.includes('human')) return '👥'
  if (category.includes('banking') || category.includes('payment')) return '🏦'
  if (name.includes('ai') || name.includes('gpt') || name.includes('claude')) return '🤖'

  return '✨'
}

/**
 * AI App Module Renderer
 * Renders AI app modules with configurable block order
 */
export class AppModuleRenderer {
  /**
   * Get effective setting from block_config or fall back to module-level setting
   */
  private static getLogoStyle(styles: BlockStyleOptions): ProductCardLogoStyle {
    return styles.blockConfig.logo?.style || styles.logoStyle || 'square'
  }

  private static getLogoPosition(styles: BlockStyleOptions): ProductCardLogoPosition {
    return styles.blockConfig.logo?.position || 'left'
  }

  private static getTitleSize(styles: BlockStyleOptions): ProductCardTextSize {
    return styles.blockConfig.title?.size || styles.titleSize || 'medium'
  }

  private static getDescriptionSize(styles: BlockStyleOptions): ProductCardTextSize {
    return styles.blockConfig.description?.size || styles.descriptionSize || 'medium'
  }

  private static getTaglineSize(styles: BlockStyleOptions): ProductCardTextSize {
    return styles.blockConfig.tagline?.size || 'medium'
  }

  private static isBlockEnabled(blockType: AIAppBlockType, styles: BlockStyleOptions): boolean {
    const config = styles.blockConfig[blockType]
    // Default to enabled if not specified
    return config?.enabled !== false
  }

  /**
   * Render a single block for an app
   */
  private static renderBlock(
    blockType: AIAppBlockType,
    app: AIApplication,
    trackingUrl: string,
    styles: BlockStyleOptions,
    index: number
  ): string {
    // Check if block is enabled
    if (!this.isBlockEnabled(blockType, styles)) {
      return ''
    }

    switch (blockType) {
      case 'title': {
        const fontSize = TITLE_SIZES[this.getTitleSize(styles)]
        const numberPart = styles.showNumbers ? `<strong style="font-size: ${fontSize};">${index + 1}.</strong> ` : ''
        const emojiPart = styles.showEmoji ? `${getAppEmoji(app)} ` : ''
        return `${numberPart}${emojiPart}<a href="${trackingUrl}" style="color: ${styles.secondaryColor || styles.primaryColor}; text-decoration: underline; font-weight: bold; font-size: ${fontSize};">${app.app_name}</a>`
      }

      case 'logo': {
        if (!app.logo_url) return ''
        const logoStyle = this.getLogoStyle(styles)
        const borderRadius = logoStyle === 'round' ? '50%' : '8px'
        const logoAlt = sanitizeAltText(app.logo_alt, app.app_name)
        return `<a href="${trackingUrl}">
          <img src="${app.logo_url}" alt="${logoAlt}"
            style="width: 48px; height: 48px; border-radius: ${borderRadius}; object-fit: cover; vertical-align: middle;" />
        </a>`
      }

      case 'image': {
        if (!app.screenshot_url) return ''
        const screenshotAlt = sanitizeAltText(app.screenshot_alt, app.app_name)
        return `
          <div style="margin: 12px 0;">
            <a href="${trackingUrl}">
              <img src="${app.screenshot_url}" alt="${screenshotAlt}"
                style="max-width: 100%; border-radius: 8px; border: 1px solid #e0e0e0;" />
            </a>
          </div>`
      }

      case 'tagline': {
        if (!app.tagline) return ''
        const fontSize = DESCRIPTION_SIZES[this.getTaglineSize(styles)]
        return `<span style="font-style: italic; color: #666; font-size: ${fontSize};">${app.tagline}</span>`
      }

      case 'description': {
        const fontSize = DESCRIPTION_SIZES[this.getDescriptionSize(styles)]
        return `<span style="font-size: ${fontSize};"> ${app.description || 'AI-powered application'}</span>`
      }

      case 'button': {
        // Button text priority: custom from database > static fallback from settings
        const buttonConfig = styles.blockConfig.button
        const staticText = buttonConfig?.staticText || 'Learn More'
        const buttonText = app.button_text || staticText

        // Optionally append email to URL for newsletter subscriptions
        let finalUrl = trackingUrl
        if (buttonConfig?.appendEmail) {
          // Add email merge tag - works with MailerLite {$email} or similar ESP tags
          const separator = trackingUrl.includes('?') ? '&' : '?'
          finalUrl = `${trackingUrl}${separator}email={$email}`
        }

        return `
          <div style="margin-top: 8px;">
            <a href="${finalUrl}"
              style="display: inline-block; padding: 8px 16px; background-color: ${styles.primaryColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-family: ${styles.bodyFont};">
              ${buttonText}
            </a>
          </div>`
      }

      default:
        return ''
    }
  }

  /**
   * Render a single app item with all its blocks
   */
  private static renderAppItem(
    app: AIApplication,
    blockOrder: AIAppBlockType[],
    trackingUrl: string,
    styles: BlockStyleOptions,
    index: number
  ): string {
    // Filter to only enabled blocks
    const enabledBlocks = blockOrder.filter(b => this.isBlockEnabled(b, styles))

    if (enabledBlocks.length === 0) {
      return ''
    }

    const logoPosition = this.getLogoPosition(styles)
    const hasLogo = enabledBlocks.includes('logo') && app.logo_url
    const logoHtml = hasLogo ? this.renderBlock('logo', app, trackingUrl, styles, index) : ''

    // Separate logo from other content for left/right positioning
    const otherBlocks = enabledBlocks.filter(b => b !== 'logo')

    let contentHtml = ''

    if (styles.layoutMode === 'stacked') {
      // Stacked layout: title on one line, description below
      for (const blockType of otherBlocks) {
        const blockHtml = this.renderBlock(blockType, app, trackingUrl, styles, index)
        if (!blockHtml) continue

        if (blockType === 'title') {
          contentHtml += `<div>${blockHtml}</div>`
        } else if (blockType === 'description' || blockType === 'tagline') {
          contentHtml += `<div style="margin-top: 4px;">${blockHtml}</div>`
        } else {
          contentHtml += blockHtml
        }
      }
    } else {
      // Inline layout: all on same line
      for (const blockType of otherBlocks) {
        contentHtml += this.renderBlock(blockType, app, trackingUrl, styles, index)
      }
    }

    // Build final HTML based on logo position
    let itemHtml = ''

    if (hasLogo && logoPosition === 'left') {
      // Logo on left using table for email compatibility
      itemHtml = `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="width: 60px; vertical-align: top; padding-right: 12px;">
              ${logoHtml}
            </td>
            <td style="vertical-align: top;">
              ${contentHtml}
            </td>
          </tr>
        </table>`
    } else if (hasLogo && logoPosition === 'right') {
      // Logo on right
      itemHtml = `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="vertical-align: top;">
              ${contentHtml}
            </td>
            <td style="width: 60px; vertical-align: top; padding-left: 12px; text-align: right;">
              ${logoHtml}
            </td>
          </tr>
        </table>`
    } else if (hasLogo && logoPosition === 'inline') {
      // Logo inline with text
      itemHtml = `${logoHtml} ${contentHtml}`
    } else {
      // No logo or logo disabled
      itemHtml = contentHtml
    }

    return `
      <div style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-family: ${styles.bodyFont}; font-size: 16px; line-height: 24px; color: #333;">
        ${itemHtml}
      </div>`
  }

  /**
   * Wrap content in section container
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
        <tr>
          <td style="padding: 0 10px 10px 10px;">
            ${content}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<br>`
  }

  /**
   * Render an AI app module with its apps
   */
  static async renderModule(
    module: AIAppModule,
    apps: AIApplication[],
    publicationId: string,
    context: RenderContext = {}
  ): Promise<RenderResult> {
    // If no apps, return empty result
    if (!apps || apps.length === 0) {
      return {
        html: '',
        moduleName: module.name,
        appCount: 0
      }
    }

    // Get publication styling
    const settings = await getBusinessSettings(publicationId)

    // Merge default block config with module's block config
    const blockConfig: ProductCardBlockConfig = {
      ...DEFAULT_BLOCK_CONFIG,
      ...(module.block_config || {})
    }

    const styles: BlockStyleOptions = {
      primaryColor: settings.primary_color,
      secondaryColor: settings.secondary_color,
      tertiaryColor: settings.tertiary_color,
      headingFont: settings.heading_font,
      bodyFont: settings.body_font,
      // Layout settings from module (Product Cards)
      layoutMode: module.layout_mode || 'inline',
      blockConfig,
      // Display settings (default true for backwards compatibility)
      showEmoji: module.show_emoji !== false,
      showNumbers: module.show_numbers !== false,
      // Legacy fallbacks
      logoStyle: module.logo_style || 'square',
      titleSize: module.title_size || 'medium',
      descriptionSize: module.description_size || 'medium'
    }

    // Render each app
    const blockOrder = module.block_order as AIAppBlockType[]
    let appsHtml = ''

    apps.forEach((app, index) => {
      const baseUrl = app.app_url || '#'

      // Generate tracked URL for links (type='ai_app' triggers clicked_ai_app field update)
      const trackedUrl = baseUrl !== '#' && context.issueDate
        ? wrapTrackingUrl(
            baseUrl,
            module.name,
            context.issueDate,
            context.mailerliteIssueId,
            context.issueId,
            'ai_app'
          )
        : baseUrl

      appsHtml += this.renderAppItem(app, blockOrder, trackedUrl, styles, index)
    })

    // Wrap in section container
    const html = this.wrapInSection(module.name, appsHtml, styles)

    return {
      html,
      moduleName: module.name,
      appCount: apps.length
    }
  }

  /**
   * Render all AI app modules for an issue
   */
  static async renderAllModules(
    modules: AIAppModule[],
    appsMap: Map<string, AIApplication[]>,
    publicationId: string,
    context: RenderContext = {}
  ): Promise<RenderResult[]> {
    const results: RenderResult[] = []

    // Sort modules by display_order
    const sortedModules = [...modules].sort((a, b) => a.display_order - b.display_order)

    for (const module of sortedModules) {
      const apps = appsMap.get(module.id) || []
      const result = await this.renderModule(module, apps, publicationId, context)
      results.push(result)
    }

    return results
  }

  /**
   * Generate combined HTML for all AI app modules
   */
  static async generateCombinedHtml(
    modules: AIAppModule[],
    appsMap: Map<string, AIApplication[]>,
    publicationId: string,
    context: RenderContext = {}
  ): Promise<string> {
    const results = await this.renderAllModules(modules, appsMap, publicationId, context)
    return results
      .filter(r => r.html) // Only include modules with apps
      .map(r => r.html)
      .join('\n')
  }

  /**
   * Render a single module for preview (without tracking)
   */
  static async renderForPreview(
    module: AIAppModule,
    apps: AIApplication[],
    publicationId: string
  ): Promise<string> {
    const settings = await getBusinessSettings(publicationId)

    // Merge default block config with module's block config
    const blockConfig: ProductCardBlockConfig = {
      ...DEFAULT_BLOCK_CONFIG,
      ...(module.block_config || {})
    }

    const styles: BlockStyleOptions = {
      primaryColor: settings.primary_color,
      secondaryColor: settings.secondary_color,
      tertiaryColor: settings.tertiary_color,
      headingFont: settings.heading_font,
      bodyFont: settings.body_font,
      // Layout settings from module (Product Cards)
      layoutMode: module.layout_mode || 'inline',
      blockConfig,
      // Display settings (default true for backwards compatibility)
      showEmoji: module.show_emoji !== false,
      showNumbers: module.show_numbers !== false,
      // Legacy fallbacks
      logoStyle: module.logo_style || 'square',
      titleSize: module.title_size || 'medium',
      descriptionSize: module.description_size || 'medium'
    }

    if (!apps || apps.length === 0) {
      return ''
    }

    const blockOrder = module.block_order as AIAppBlockType[]
    let appsHtml = ''

    apps.forEach((app, index) => {
      const linkUrl = app.app_url || '#'
      appsHtml += this.renderAppItem(app, blockOrder, linkUrl, styles, index)
    })

    return this.wrapInSection(module.name, appsHtml, styles)
  }

  /**
   * Render for archive (static HTML, no tracking needed)
   */
  static renderForArchive(
    moduleName: string,
    apps: Array<{
      app_name: string
      description?: string
      tagline?: string
      logo_url?: string
      screenshot_url?: string
      app_url?: string
      category?: string | null
    }>,
    blockOrder: AIAppBlockType[],
    styles: { primaryColor: string; secondaryColor?: string; headingFont: string; bodyFont: string }
  ): string {
    if (!apps || apps.length === 0) {
      return ''
    }

    let appsHtml = ''

    apps.forEach((app, index) => {
      const linkUrl = app.app_url || '#'
      let blocksHtml = ''

      for (const blockType of blockOrder) {
        switch (blockType) {
          case 'title': {
            // Simplified emoji logic for archive
            const category = (app.category || '').toLowerCase()
            let emoji = '✨'
            if (category.includes('accounting')) emoji = '📊'
            else if (category.includes('tax')) emoji = '📋'
            else if (category.includes('payroll')) emoji = '💰'
            else if (category.includes('finance')) emoji = '📈'

            blocksHtml += `<strong>${index + 1}.</strong> ${emoji} <a href="${linkUrl}" style="color: ${styles.secondaryColor || styles.primaryColor}; text-decoration: underline; font-weight: bold;">${app.app_name}</a>`
            break
          }
          case 'logo':
            if (app.logo_url) {
              const archiveLogoAlt = sanitizeAltText((app as any).logo_alt, app.app_name)
              blocksHtml += `
                <div style="margin: 8px 0;">
                  <img src="${app.logo_url}" alt="${archiveLogoAlt}"
                    style="width: 48px; height: 48px; border-radius: 8px;" />
                </div>`
            }
            break
          case 'image':
            if (app.screenshot_url) {
              const archiveScreenshotAlt = sanitizeAltText((app as any).screenshot_alt, app.app_name)
              blocksHtml += `
                <div style="margin: 12px 0;">
                  <img src="${app.screenshot_url}" alt="${archiveScreenshotAlt}"
                    style="max-width: 100%; border-radius: 8px;" />
                </div>`
            }
            break
          case 'tagline':
            if (app.tagline) {
              blocksHtml += `
                <div style="font-style: italic; color: #666; font-size: 14px;">
                  ${app.tagline}
                </div>`
            }
            break
          case 'description':
            blocksHtml += ` ${app.description || 'AI-powered application'}`
            break
          case 'button':
            blocksHtml += `
              <div style="margin-top: 8px;">
                <a href="${linkUrl}"
                  style="display: inline-block; padding: 8px 16px; background-color: ${styles.primaryColor}; color: #fff; text-decoration: none; border-radius: 6px;">
                  Try ${app.app_name}
                </a>
              </div>`
            break
        }
      }

      appsHtml += `
        <div style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-family: ${styles.bodyFont}; font-size: 16px; line-height: 24px; color: #333;">
          ${blocksHtml}
        </div>`
    })

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
        <tr>
          <td style="padding: 0 10px 10px 10px;">
            ${appsHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<br>`
  }
}
