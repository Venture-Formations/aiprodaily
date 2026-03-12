/**
 * Ad Body Block Renderer
 *
 * Renders ad body content with HTML normalization for email compatibility.
 * Link injection (arrow/last-sentence) has been replaced by the dedicated CTA block.
 */

import { normalizeEmailHtml } from '../../html-normalizer'
import type { BlockData, BlockStyleOptions, BlockRenderContext } from '../types'

/**
 * Render a body block (ad body content)
 * @param data - Block data (uses body)
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

  // Normalize HTML for email compatibility
  const processedBody = normalizeEmailHtml(body)

  return `
        <tr>
          <td style='padding: 0 10px 10px; font-family: ${styles.bodyFont}; font-size: 16px; line-height: 24px; color: #333;'>
            ${processedBody}
          </td>
        </tr>`
}
