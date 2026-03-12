/**
 * CTA (Call to Action) Block Renderer
 *
 * Renders a linked text CTA below the ad body.
 * If cta_text is empty/null, returns empty string.
 */

import type { BlockData, BlockStyleOptions, BlockRenderContext } from '../types'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Render a CTA block (linked text)
 * @param data - Block data (uses cta_text, trackingUrl/button_url)
 * @param styles - Style options from publication settings
 * @param context - Render context (optional)
 * @returns HTML string for the CTA block, or empty string if no CTA text
 */
export function renderCtaBlock(
  data: BlockData,
  styles: BlockStyleOptions,
  _context?: BlockRenderContext
): string {
  const ctaText = data.cta_text
  if (!ctaText) return ''

  const linkUrl = data.trackingUrl || data.button_url || '#'
  if (linkUrl === '#') return ''

  return `
        <tr>
          <td style='padding: 4px 10px 10px; font-family: ${styles.bodyFont}; font-size: 16px; line-height: 24px;'>
            <a href='${escapeHtml(linkUrl)}' style='color: #000; text-decoration: underline; font-weight: bold;'>${escapeHtml(ctaText)}</a>
          </td>
        </tr>`
}
