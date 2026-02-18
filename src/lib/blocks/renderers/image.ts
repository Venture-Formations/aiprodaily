/**
 * Image Block Renderer
 *
 * Renders an image with optional link wrapping.
 * Shared between ad modules and articles.
 */

import type { BlockData, BlockStyleOptions, BlockRenderContext } from '../types'
import { sanitizeAltText } from '../../utils/sanitize-alt-text'

/**
 * Render an image block with optional link
 * @param data - Block data (uses image_url, trackingUrl/button_url, title)
 * @param styles - Style options from publication settings
 * @param context - Render context (optional)
 * @returns HTML string for the image block
 */
export function renderImageBlock(
  data: BlockData,
  _styles: BlockStyleOptions,
  _context?: BlockRenderContext
): string {
  const imageUrl = data.image_url
  if (!imageUrl) return ''

  const linkUrl = data.trackingUrl || data.button_url || '#'
  const altText = sanitizeAltText(data.image_alt || data.title || data.headline)

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
