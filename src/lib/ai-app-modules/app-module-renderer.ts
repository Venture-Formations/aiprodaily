/**
 * AI App Module Renderer
 * Renders AI app modules with configurable block order
 */

import { wrapTrackingUrl, type LinkType } from '../url-tracking'
import { getBusinessSettings } from '../publication-settings'
import type {
  AIAppModule,
  AIApplication,
  AIAppBlockType
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
   * Render a single block for an app
   */
  private static renderBlock(
    blockType: AIAppBlockType,
    app: AIApplication,
    trackingUrl: string,
    styles: BlockStyleOptions,
    index: number
  ): string {
    switch (blockType) {
      case 'title': {
        const emoji = getAppEmoji(app)
        return `
          <div style="font-weight: bold; font-size: 16px; line-height: 24px;">
            <strong>${index + 1}.</strong> ${emoji}
            <a href="${trackingUrl}" style="color: ${styles.secondaryColor || styles.primaryColor}; text-decoration: underline; font-weight: bold;">
              ${app.app_name}
            </a>
          </div>`
      }

      case 'logo': {
        if (!app.logo_url) return ''
        return `
          <div style="margin: 8px 0;">
            <a href="${trackingUrl}">
              <img src="${app.logo_url}" alt="${app.app_name}"
                style="width: 48px; height: 48px; border-radius: 8px; object-fit: contain;" />
            </a>
          </div>`
      }

      case 'image': {
        if (!app.screenshot_url) return ''
        return `
          <div style="margin: 12px 0;">
            <a href="${trackingUrl}">
              <img src="${app.screenshot_url}" alt="${app.app_name}"
                style="max-width: 100%; border-radius: 8px; border: 1px solid #e0e0e0;" />
            </a>
          </div>`
      }

      case 'tagline': {
        if (!app.tagline) return ''
        return `
          <div style="font-style: italic; color: #666; font-size: 14px; margin: 4px 0;">
            ${app.tagline}
          </div>`
      }

      case 'description': {
        return `
          <div style="font-family: ${styles.bodyFont}; font-size: 16px; line-height: 24px; color: #333;">
            ${app.description || 'AI-powered application'}
          </div>`
      }

      case 'button': {
        return `
          <div style="margin-top: 8px;">
            <a href="${trackingUrl}"
              style="display: inline-block; padding: 8px 16px; background-color: ${styles.primaryColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-family: ${styles.bodyFont};">
              Try ${app.app_name}
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
    let blocksHtml = ''

    for (const blockType of blockOrder) {
      blocksHtml += this.renderBlock(blockType, app, trackingUrl, styles, index)
    }

    return `
      <div style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-family: ${styles.bodyFont};">
        ${blocksHtml}
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
    const styles: BlockStyleOptions = {
      primaryColor: settings.primary_color,
      secondaryColor: settings.secondary_color,
      tertiaryColor: settings.tertiary_color,
      headingFont: settings.heading_font,
      bodyFont: settings.body_font
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
    const styles: BlockStyleOptions = {
      primaryColor: settings.primary_color,
      secondaryColor: settings.secondary_color,
      tertiaryColor: settings.tertiary_color,
      headingFont: settings.heading_font,
      bodyFont: settings.body_font
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

            blocksHtml += `
              <div style="font-weight: bold; font-size: 16px;">
                <strong>${index + 1}.</strong> ${emoji}
                <a href="${linkUrl}" style="color: ${styles.secondaryColor || styles.primaryColor}; text-decoration: underline;">
                  ${app.app_name}
                </a>
              </div>`
            break
          }
          case 'logo':
            if (app.logo_url) {
              blocksHtml += `
                <div style="margin: 8px 0;">
                  <img src="${app.logo_url}" alt="${app.app_name}"
                    style="width: 48px; height: 48px; border-radius: 8px;" />
                </div>`
            }
            break
          case 'image':
            if (app.screenshot_url) {
              blocksHtml += `
                <div style="margin: 12px 0;">
                  <img src="${app.screenshot_url}" alt="${app.app_name}"
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
            blocksHtml += `
              <div style="font-size: 16px; line-height: 24px;">
                ${app.description || 'AI-powered application'}
              </div>`
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
        <div style="padding: 12px 0; border-bottom: 1px solid #e0e0e0; font-family: ${styles.bodyFont};">
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
