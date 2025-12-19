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
    <p style="margin:0 0 14px 0; font-size:16px; color:#ffffff; text-align:center;">
      ${data.question}
    </p>
  `
}
