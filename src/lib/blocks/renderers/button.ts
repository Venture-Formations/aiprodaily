/**
 * Button Block Renderer
 *
 * Renders a CTA button with customizable text.
 * Shared between ad modules and other sections.
 */

import type { BlockData, BlockStyleOptions, BlockRenderContext } from '../types'

/**
 * Render a button/CTA block
 * @param data - Block data (uses button_text, trackingUrl/button_url)
 * @param styles - Style options from publication settings
 * @param context - Render context (optional)
 * @returns HTML string for the button block
 */
export function renderButtonBlock(
  data: BlockData,
  styles: BlockStyleOptions,
  _context?: BlockRenderContext
): string {
  const buttonUrl = data.trackingUrl || data.button_url
  if (!buttonUrl || buttonUrl === '#') return ''

  const buttonText = data.button_text || 'Learn More'

  return `
        <tr>
          <td style='padding: 10px; text-align: center;'>
            <a href='${buttonUrl}' style='display: inline-block; padding: 12px 24px; background-color: ${styles.primaryColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-family: ${styles.headingFont}; font-weight: bold; font-size: 14px;'>
              ${buttonText}
            </a>
          </td>
        </tr>`
}
