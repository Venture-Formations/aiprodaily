/**
 * Ad Body Block Renderer
 *
 * Renders ad body content with special handling:
 * - Normalizes HTML for email compatibility
 * - Makes the last sentence a hyperlink to the CTA URL
 */

import { normalizeEmailHtml } from '../../html-normalizer'
import type { BlockData, BlockStyleOptions, BlockRenderContext } from '../types'

/**
 * Add hyperlink to the last sentence of body text
 * @param body - HTML body content
 * @param linkUrl - URL to link to
 * @returns Modified HTML with last sentence linked
 */
function addLastSentenceLink(body: string, linkUrl: string): string {
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
 * Render a body block (ad body with last-sentence link)
 * @param data - Block data (uses body, trackingUrl/button_url)
 * @param styles - Style options from publication settings
 * @param context - Render context (optional)
 * @returns HTML string for the body block
 */
export function renderBodyBlock(
  data: BlockData,
  styles: BlockStyleOptions,
  _context?: BlockRenderContext
): string {
  const body = data.body
  if (!body) return ''

  const linkUrl = data.trackingUrl || data.button_url || '#'

  // Normalize HTML for email compatibility
  let processedBody = normalizeEmailHtml(body)

  // Make the last sentence a hyperlink if we have a valid URL
  if (linkUrl && linkUrl !== '#' && processedBody) {
    processedBody = addLastSentenceLink(processedBody, linkUrl)
  }

  return `
        <tr>
          <td style='padding: 0 10px 10px; font-family: ${styles.bodyFont}; font-size: 16px; line-height: 24px; color: #333;'>
            ${processedBody}
          </td>
        </tr>`
}
