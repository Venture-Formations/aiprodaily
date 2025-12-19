/**
 * Poll Question Block Renderer
 * Renders the poll question text
 */

import type { BlockData, BlockStyleOptions, BlockRenderContext } from '../types'

export function renderQuestion(
  data: BlockData,
  styles: BlockStyleOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context?: BlockRenderContext
): string {
  if (!data.question) {
    return ''
  }

  return `
    <tr>
      <td style="padding: 12px 16px; text-align: center;">
        <p style="margin: 0; font-size: 18px; line-height: 1.5; color: #ffffff; font-family: ${styles.bodyFont};">
          ${data.question}
        </p>
      </td>
    </tr>
  `
}
