/**
 * Title Block Renderer
 *
 * Renders a title/heading for ad modules.
 * Used for ad section titles.
 */

import type { BlockData, BlockStyleOptions, BlockRenderContext } from '../types'

/**
 * Render a title block
 * @param data - Block data (uses title field)
 * @param styles - Style options from publication settings
 * @param context - Render context (optional)
 * @returns HTML string for the title block
 */
export function renderTitleBlock(
  data: BlockData,
  styles: BlockStyleOptions,
  _context?: BlockRenderContext
): string {
  const title = data.title
  if (!title) return ''

  return `
        <tr>
          <td style='padding: 10px 10px 4px; font-size: 20px; font-weight: bold; text-align: left; font-family: ${styles.headingFont};'>
            ${title}
          </td>
        </tr>`
}
