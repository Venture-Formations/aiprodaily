/**
 * Poll Options Block Renderer
 * Renders the poll voting options as clickable buttons/links
 */

import type { BlockData, BlockStyleOptions, BlockRenderContext } from '../types'

export function renderOptions(
  data: BlockData,
  styles: BlockStyleOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context?: BlockRenderContext
): string {
  if (!data.options || data.options.length === 0) {
    return ''
  }

  const { poll_id, issue_id, base_url, options } = data

  // Generate option buttons
  const optionsHtml = options.map((option, index) => {
    // Build response URL if we have poll_id and base_url
    let responseUrl = '#'
    if (poll_id && base_url) {
      const encodedOption = encodeURIComponent(option)
      responseUrl = `${base_url}/api/polls/${poll_id}/respond?option=${encodedOption}${issue_id ? `&issue_id=${issue_id}` : ''}&email={$email}`
    }

    // Alternate colors for visual variety
    const bgColor = index % 2 === 0 ? styles.primaryColor : (styles.secondaryColor || '#6B7280')

    return `
      <tr>
        <td style="padding: 4px 16px;">
          <a href="${responseUrl}"
             style="display: block;
                    width: 100%;
                    max-width: 400px;
                    margin: 0 auto;
                    padding: 14px 24px;
                    background: ${bgColor};
                    color: #ffffff;
                    text-decoration: none;
                    font-weight: 600;
                    font-size: 16px;
                    font-family: ${styles.bodyFont};
                    border-radius: 8px;
                    text-align: center;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
            ${option}
          </a>
        </td>
      </tr>
    `
  }).join('')

  return `
    <tr>
      <td style="padding: 8px 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          ${optionsHtml}
        </table>
      </td>
    </tr>
  `
}
