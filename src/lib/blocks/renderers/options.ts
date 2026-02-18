/**
 * Poll Options Block Renderer
 * Renders the poll voting options as clickable buttons/links
 */

import type { BlockData, BlockStyleOptions, BlockRenderContext } from '../types'

export function renderOptions(
  data: BlockData,
  styles: BlockStyleOptions,
  // eslint-disable-next-line no-unused-vars
  _context?: BlockRenderContext
): string {
  if (!data.options || data.options.length === 0) {
    return ''
  }

  const { poll_id, issue_id, base_url, options } = data

  // Use tertiary color for button background, primary color for text (matching legacy design)
  const buttonBgColor = styles.tertiaryColor || '#ffffff'
  const buttonTextColor = styles.primaryColor

  // Generate option buttons
  const optionsHtml = options.map((option, index) => {
    // Build response URL if we have poll_id and base_url
    let responseUrl = '#'
    if (poll_id && base_url) {
      const encodedOption = encodeURIComponent(option)
      responseUrl = `${base_url}/api/polls/${poll_id}/respond?option=${encodedOption}${issue_id ? `&issue_id=${issue_id}` : ''}&email={$email}`
    }

    const isLast = index === options.length - 1
    const paddingStyle = isLast ? 'padding:0;' : 'padding:0 0 8px 0;'

    return `
      <tr>
        <td style="${paddingStyle}">
          <a href="${responseUrl}"
             style="display:block; text-decoration:none; background:${buttonBgColor}; color:${buttonTextColor}; font-weight:bold;
                    font-size:16px; line-height:20px; padding:12px; border-radius:8px; text-align:center;">${option}</a>
        </td>
      </tr>
    `
  }).join('')

  return `
    <table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" style="margin:0 auto; width:100%; max-width:350px;">
      ${optionsHtml}
    </table>
  `
}
