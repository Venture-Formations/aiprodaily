// Advertorial and ad module rendering

import { supabaseAdmin } from '../supabase'
import { wrapTrackingUrl } from '../url-tracking'
import { sanitizeAltText } from '../utils/sanitize-alt-text'
import { normalizeEmailHtml } from '../html-normalizer'
import { AdModuleRenderer } from '../ad-modules'
import { fetchBusinessSettings } from './helpers'
import type { AdBlockType } from '@/types/database'
import type { BusinessSettings } from './types'

// ==================== DINING DEALS ====================
// Feature not needed in this newsletter

export async function generateDiningDealsSection(issue: any): Promise<string> {
  console.log('Dining Deals section disabled for AI Accounting Daily')
  return ''
}

// ==================== ADVERTORIAL ====================

// Shared interface for ad data used in advertorial rendering
export interface AdvertorialAdData {
  title: string
  body: string
  button_url: string
  image_url?: string
  image_alt?: string | null
  cta_text?: string | null
}

// Shared interface for advertorial styling options
export interface AdvertorialStyleOptions {
  primaryColor: string
  headingFont: string
  bodyFont: string
  sectionName?: string
  linkUrl?: string // URL to use for links (can be tracked or untracked)
}

/**
 * Generate the HTML for an advertorial card.
 * This is the shared function used by both generateAdvertorialSection and the ad preview API.
 * Any changes to the advertorial styling should be made here.
 */
export function generateAdvertorialHtml(
  ad: AdvertorialAdData,
  options: AdvertorialStyleOptions
): string {
  const { primaryColor, headingFont, bodyFont, sectionName = 'Advertorial', linkUrl } = options
  const buttonUrl = linkUrl || ad.button_url || '#'

  // Generate clickable image HTML if valid URL exists
  const adAltText = sanitizeAltText(ad.image_alt || ad.title)
  const imageHtml = ad.image_url
    ? `<tr><td style='padding: 0 12px; text-align: center;'><a href='${buttonUrl}'><img src='${ad.image_url}' alt='${adAltText}' style='max-width: 100%; max-height: 500px; border-radius: 4px; display: block; margin: 0 auto;'></a></td></tr>`
    : ''

  // Normalize HTML for email compatibility
  const processedBody = normalizeEmailHtml(ad.body || '')

  // CTA: if cta_text is provided, render it as a linked row after the body
  const escapedCtaText = ad.cta_text ? ad.cta_text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''
  const ctaHtml = escapedCtaText && buttonUrl !== '#'
    ? `<tr><td style='padding: 4px 10px 10px; font-family: ${bodyFont}; font-size: 16px; line-height: 24px;'><a href='${buttonUrl}' style='color: #000; text-decoration: underline; font-weight: bold;'>${escapedCtaText}</a></td></tr>`
    : ''

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
  <tr>
    <td style="padding:0 10px;">
      <table width='100%' cellpadding='0' cellspacing='0' style='border: 1px solid #ddd; border-radius: 10px; background: #fff; font-family: ${bodyFont}; font-size: 16px; line-height: 26px; box-shadow:0 4px 12px rgba(0,0,0,.15); margin-top: 10px; overflow: hidden;'>
        <tr>
          <td style="padding: 8px; background-color: ${primaryColor}; border-top-left-radius: 10px; border-top-right-radius: 10px;">
            <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: ${headingFont}; color: #ffffff; margin: 0; padding: 0;">${sectionName}</h2>
          </td>
        </tr>
        <tr><td style='padding: 10px 10px 4px; font-size: 20px; font-weight: bold; text-align: left;'>${ad.title}</td></tr>
        ${imageHtml}
        <tr><td style='padding: 0 10px 10px; font-family: ${bodyFont}; font-size: 16px; line-height: 24px; color: #333;'>${processedBody}</td></tr>
        ${ctaHtml}
      </table>
    </td>
  </tr>
</table>
<br>`
}

export async function generateAdvertorialSection(issue: any, _recordUsage: boolean = false, sectionName: string = 'Advertorial', businessSettings?: BusinessSettings): Promise<string> {
  // Note: _recordUsage parameter is deprecated - ad usage is now tracked exclusively
  // by AdScheduler.recordAdUsage() in send-final/route.ts to prevent double-counting
  try {
    console.log('Generating Advertorial section for issue:', issue?.id)

    // Fetch colors from business settings (use passed-in settings if available)
    const { primaryColor, headingFont, bodyFont } = businessSettings || await fetchBusinessSettings(issue?.publication_id)

    // Check if ad already selected for this issue
    const { data: existingAd } = await supabaseAdmin
      .from('issue_advertisements')
      .select('*, advertisement:advertisements(*)')
      .eq('issue_id', issue.id)
      .order('created_at', { ascending: false }) // Use created_at since used_at is NULL until send-final
      .limit(1)
      .maybeSingle()

    const selectedAd = existingAd?.advertisement

    // If no ad selected, return empty (RSS processing should have selected one)
    if (!selectedAd) {
      console.log('No ad selected for this issue (RSS processing may not have completed)')
      return ''
    }

    console.log(`Using selected ad: ${selectedAd.title}`)

    // Generate tracked URL for links
    const buttonUrl = selectedAd.button_url || '#'
    const trackedUrl = buttonUrl !== '#'
      ? wrapTrackingUrl(buttonUrl, 'Advertorial', issue.date, issue.mailerlite_issue_id, issue.id)
      : '#'

    // Use the shared advertorial HTML generator
    return generateAdvertorialHtml(
      {
        title: selectedAd.title,
        body: selectedAd.body || '',
        button_url: selectedAd.button_url || '#',
        image_url: selectedAd.image_url,
        image_alt: selectedAd.image_alt,
        cta_text: selectedAd.cta_text
      },
      {
        primaryColor,
        headingFont,
        bodyFont,
        sectionName,
        linkUrl: trackedUrl
      }
    )
  } catch (error) {
    console.error('Error generating Advertorial section:', error)
    return ''
  }
}

// ==================== AD MODULES (DYNAMIC AD SECTIONS) ====================

/**
 * Generate ad mod sections for an issue
 * Uses the block-based renderer for configurable ad layouts
 * @param issue - The issue data
 * @param moduleId - Optional: Generate only for a specific mod (used for ordered rendering)
 */
export async function generateAdModulesSection(issue: any, moduleId?: string, businessSettings?: BusinessSettings, adSelections?: any[]): Promise<string> {
  try {
    console.log('Generating Ad Modules sections for issue:', issue?.id, moduleId ? `(mod: ${moduleId})` : '(all modules)')

    const { primaryColor, headingFont, bodyFont } = businessSettings || await fetchBusinessSettings(issue?.publication_id)

    // Use pre-fetched data or fall back to DB query (legacy callers)
    let selections: any[]
    if (adSelections && moduleId) {
      // Filter pre-fetched selections to this specific module
      selections = adSelections.filter((s: any) => {
        const mod = s.ad_module as any
        return mod?.id === moduleId
      })
    } else {
      let query = supabaseAdmin
        .from('issue_module_ads')
        .select(`
          selection_mode,
          selected_at,
          ad_module_id,
          ad_module:ad_modules(id, name, display_order, block_order),
          advertisement:advertisements(id, title, body, image_url, image_alt, button_text, button_url, cta_text, company_name,
            advertiser:advertisers(id, company_name, logo_url, website_url))
        `)
        .eq('issue_id', issue.id)
      if (moduleId) {
        query = query.eq('ad_module_id', moduleId)
      }
      const { data, error } = await query.order('ad_module(display_order)', { ascending: true })
      if (error) {
        console.error('Error fetching ad mod selections:', error)
        return ''
      }
      selections = data || []
    }

    if (!selections || selections.length === 0) {
      return ''
    }

    // Generate HTML for each ad mod
    const sectionsHtml: string[] = []
    let skipped = 0

    for (const selection of selections) {
      const mod = selection.ad_module as any
      const ad = selection.advertisement as any

      if (!mod || !ad) {
        skipped++
        continue
      }

      // Generate tracked URL for the ad
      const buttonUrl = ad.button_url || '#'
      const trackedUrl = buttonUrl !== '#'
        ? wrapTrackingUrl(buttonUrl, mod.name, issue.date, issue.mailerlite_issue_id, issue.id)
        : '#'

      // Get block order from mod config
      const blockOrder = (mod.block_order || ['title', 'image', 'body', 'button']) as AdBlockType[]

      // Use the AdModuleRenderer for block-based rendering
      const html = AdModuleRenderer.renderForArchive(
        mod.name,
        {
          title: ad.title,
          body: ad.body,
          image_url: ad.image_url,
          image_alt: ad.image_alt,
          button_text: ad.button_text,
          button_url: trackedUrl, // Use tracked URL
          cta_text: ad.cta_text
        },
        blockOrder,
        {
          primaryColor,
          headingFont,
          bodyFont
        }
      )

      sectionsHtml.push(html)
    }

    console.log(`[AdModules] Rendered ${sectionsHtml.length} ad modules${skipped ? `, skipped ${skipped}` : ''}`)

    return sectionsHtml.join('')

  } catch (error) {
    console.error('Error generating Ad Modules sections:', error)
    return ''
  }
}
