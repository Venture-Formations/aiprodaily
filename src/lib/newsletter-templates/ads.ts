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

  // Process ad body: normalize HTML for email compatibility, then make the last sentence a hyperlink
  let processedBody = normalizeEmailHtml(ad.body || '')
  if (buttonUrl !== '#' && processedBody) {
    // Check for arrow CTA in table format (created by normalizeEmailHtml)
    // This handles both single-row tables AND multi-row tables with arrows
    // We want to make the LAST arrow row's text into a clickable link

    // Pattern for the last row with an arrow in a table (handles bold arrows too)
    // Made more flexible: doesn't require table to be at very end, allows for trailing whitespace/content
    const tableArrowLastRowPattern = /(<table[^>]*>(?:[\s\S]*?<tr>[\s\S]*?<\/tr>)*?)(<tr>\s*<td[^>]*>\s*(?:<strong>)?\s*→\s*(?:<\/strong>)?\s*<\/td>\s*<td>)([^<]+)(<\/td>\s*<\/tr>\s*<\/table>)/i
    const tableArrowMatch = processedBody.match(tableArrowLastRowPattern)

    if (tableArrowMatch) {
      // Found table-based arrow CTA - keep the table structure but make the last row's text a link
      const beforeLastRow = tableArrowMatch[1]
      const lastRowStart = tableArrowMatch[2]
      const ctaText = tableArrowMatch[3].trim()
      const lastRowEnd = tableArrowMatch[4]

      processedBody = processedBody.replace(
        tableArrowLastRowPattern,
        `${beforeLastRow}${lastRowStart}<a href='${buttonUrl}' style='color: #000; text-decoration: underline; font-weight: bold;'>${ctaText}</a>${lastRowEnd}`
      )
    } else {
      // Check for arrow CTA pattern in paragraph format
      // Handle various structures:
      // 1. Plain: "→ Try Fiskl"
      // 2. Mid-line: "Some text → Try Fiskl"
      // 3. Separate tags: "<strong>→ </strong><strong>Send it to Shoeboxed.</strong>"

      let arrowHandled = false

      // First, try to match arrow in separate strong tag followed by CTA in another strong tag
      // Pattern: <strong>→ </strong><strong>CTA text</strong>
      const separateTagsPattern = /([\s\S]*?<strong[^>]*>)(→\s*)(<\/strong>\s*<strong[^>]*>)([^<]+)(<\/strong>)/i
      const separateTagsMatch = processedBody.match(separateTagsPattern)

      if (separateTagsMatch && separateTagsMatch[4].trim().length > 3) {
        const beforeArrow = separateTagsMatch[1]
        const arrow = separateTagsMatch[2]
        const betweenTags = separateTagsMatch[3]
        const ctaText = separateTagsMatch[4].trim()
        const closingTag = separateTagsMatch[5]

        processedBody = processedBody.replace(
          separateTagsPattern,
          `${beforeArrow}${arrow}${betweenTags}<a href='${buttonUrl}' style='color: #000; text-decoration: underline;'>${ctaText}</a>${closingTag}`
        )
        arrowHandled = true
      }

      // If not handled, try simpler mid-line pattern
      if (!arrowHandled) {
        const midLineArrowPattern = /([\s\S]*?)(→\s*)([^<\n→]+?)(\s*<\/p>|\s*<\/strong>|\s*$)/i
        const midLineMatch = processedBody.match(midLineArrowPattern)

        if (midLineMatch && midLineMatch[3].trim().length > 3) {
          const beforeArrow = midLineMatch[1]
          const arrow = midLineMatch[2]
          const ctaText = midLineMatch[3].trim()
          const afterCta = midLineMatch[4] || ''

          processedBody = processedBody.replace(
            midLineArrowPattern,
            `${beforeArrow}<strong>${arrow}</strong><a href='${buttonUrl}' style='color: #000; text-decoration: underline; font-weight: bold;'>${ctaText}</a>${afterCta}`
          )
          arrowHandled = true
        }
      }

      if (!arrowHandled) {
      // No arrow CTA - use existing last-sentence logic
      // Strip HTML to get plain text
      const plainText = processedBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

      // Find all sentence-ending punctuation marks (., !, ?)
      // But exclude periods that are part of domains (.com, .ai, .io, etc.) or abbreviations
      const sentenceEndPattern = /[.!?](?=\s+[A-Z]|$)/g
      const matches = Array.from(plainText.matchAll(sentenceEndPattern))

    if (matches.length > 0) {
      // Get the position of the last sentence-ending punctuation
      const lastMatch = matches[matches.length - 1] as RegExpMatchArray
      const lastPeriodIndex = lastMatch.index!

      // Find the second-to-last sentence-ending punctuation
      let startIndex = 0
      if (matches.length > 1) {
        const secondLastMatch = matches[matches.length - 2] as RegExpMatchArray
        startIndex = secondLastMatch.index! + 1
      }

      // Extract the last complete sentence (from after previous punctuation to end, including the final punctuation)
      const lastSentence = plainText.substring(startIndex, lastPeriodIndex + 1).trim()

      if (lastSentence.length > 5) {
        // Escape special regex characters
        const escapedSentence = lastSentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

        // Replace in the original HTML
        // Look for the sentence text, accounting for HTML tags that might be in between
        const parts = escapedSentence.split(/\s+/)
        const flexiblePattern = parts.join('\\s*(?:<[^>]*>\\s*)*')
        const sentenceRegex = new RegExp(flexiblePattern, 'i')

        processedBody = processedBody.replace(
          sentenceRegex,
          `<a href='${buttonUrl}' style='color: #000; text-decoration: underline; font-weight: bold;'>$&</a>`
        )
      }
    } else {
      // No sentence-ending punctuation found - wrap the entire text
      const trimmedText = plainText.trim()
      if (trimmedText.length > 5) {
        const escapedText = trimmedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const parts = escapedText.split(/\s+/)
        const flexiblePattern = parts.join('\\s*(?:<[^>]*>\\s*)*')
        const textRegex = new RegExp(flexiblePattern, 'i')

        processedBody = processedBody.replace(
          textRegex,
          `<a href='${buttonUrl}' style='color: #000; text-decoration: underline; font-weight: bold;'>$&</a>`
        )
      }
    }
      }
    }
  }

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
        image_alt: selectedAd.image_alt
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
export async function generateAdModulesSection(issue: any, moduleId?: string, businessSettings?: BusinessSettings): Promise<string> {
  try {
    console.log('Generating Ad Modules sections for issue:', issue?.id, moduleId ? `(mod: ${moduleId})` : '(all modules)')

    // Fetch colors from business settings (use passed-in settings if available)
    const { primaryColor, headingFont, bodyFont, websiteUrl } = businessSettings || await fetchBusinessSettings(issue?.publication_id)

    // Build query for ad mod selections
    // Uses unified advertisements table
    let query = supabaseAdmin
      .from('issue_module_ads')
      .select(`
        selection_mode,
        selected_at,
        ad_module:ad_modules(
          id,
          name,
          display_order,
          block_order
        ),
        advertisement:advertisements(
          id,
          title,
          body,
          image_url,
          image_alt,
          button_text,
          button_url,
          company_name,
          advertiser:advertisers(
            id,
            company_name,
            logo_url,
            website_url
          )
        )
      `)
      .eq('issue_id', issue.id)

    // Filter to specific mod if provided
    if (moduleId) {
      query = query.eq('ad_module_id', moduleId)
    }

    const { data: selections, error } = await query.order('ad_module(display_order)', { ascending: true })

    if (error) {
      console.error('Error fetching ad mod selections:', error)
      return ''
    }

    if (!selections || selections.length === 0) {
      console.log('No ad mod selections found for issue')
      return ''
    }

    console.log(`Found ${selections.length} ad mod selections`)

    // Generate HTML for each ad mod
    const sectionsHtml: string[] = []

    for (const selection of selections) {
      const mod = selection.ad_module as any
      const ad = selection.advertisement as any

      if (!mod) {
        console.log('Skipping selection without mod')
        continue
      }

      // If no ad selected (manual mode not filled), skip this section
      if (!ad) {
        console.log(`No ad selected for mod "${mod.name}" (mode: ${selection.selection_mode})`)
        continue
      }

      // Generate tracked URL for the ad
      const buttonUrl = ad.button_url || '#'
      const trackedUrl = buttonUrl !== '#'
        ? wrapTrackingUrl(buttonUrl, mod.name, issue.date, issue.mailerlite_issue_id, issue.id)
        : '#'

      // Get block order from mod config
      const blockOrder = (mod.block_order || ['title', 'image', 'body', 'button']) as AdBlockType[]
      console.log(`[AdModules] Module "${mod.name}" block_order:`, mod.block_order, '-> using:', blockOrder)

      // Use the AdModuleRenderer for block-based rendering
      const html = AdModuleRenderer.renderForArchive(
        mod.name,
        {
          title: ad.title,
          body: ad.body,
          image_url: ad.image_url,
          image_alt: ad.image_alt,
          button_text: ad.button_text,
          button_url: trackedUrl // Use tracked URL
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

    return sectionsHtml.join('')

  } catch (error) {
    console.error('Error generating Ad Modules sections:', error)
    return ''
  }
}
