// HTML normalization utilities for email-safe formatting
// Used when saving advertorial content to the database

/**
 * Normalizes HTML content for email clients by converting lists and manual bullets
 * to table-based layouts that render consistently across all email clients.
 *
 * This should be called when SAVING advertorial content to the database,
 * not during email generation.
 */
export function normalizeEmailHtml(html: string, bodyFont: string = 'Arial, sans-serif'): string {
  let processed = html

  // Handle ordered lists (<ol>) - convert to table
  processed = processed.replace(/<ol[^>]*>/gi, () => {
    return '<table width="100%" cellpadding="0" cellspacing="0" style="margin: 0; padding: 0;">'
  })
  processed = processed.replace(/<\/ol>/gi, '</table>')

  // Convert unordered lists (<ul>) - convert to table
  processed = processed
    .replace(/<ul[^>]*>/gi, '<table width="100%" cellpadding="0" cellspacing="0" style="margin: 0; padding: 0;">')
    .replace(/<\/ul>/gi, '</table>')

  // Convert <li> tags to table rows for better email client compatibility
  processed = processed.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (match, content) => {
    // Strip any leading/trailing <br> tags and whitespace
    let cleanContent = content.trim()
      .replace(/^(<br\s*\/?>)+/gi, '')
      .replace(/(<br\s*\/?>)+$/gi, '')
      .trim()

    // Replace remaining <br> tags with spaces to keep text inline
    cleanContent = cleanContent.replace(/<br\s*\/?>/gi, ' ')

    // Use table-based layout for reliable bullet point rendering across email clients
    return `<tr><td valign="top" style="padding: 0 0 8px 0; font-family: ${bodyFont}; font-size: 16px; line-height: 24px; color: #333;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td width="20" valign="top" style="padding: 0; font-size: 16px; line-height: 24px;">•</td><td valign="top" style="padding: 0; font-size: 16px; line-height: 24px;">${cleanContent}</td></tr></table></td></tr>`
  })

  // Handle manual bullet points (from Google Docs paste or manual entry)
  // Process paragraph by paragraph to preserve structure
  processed = processed.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (match, paragraphContent) => {
    // Split paragraph content by <br> tags
    const lines = paragraphContent.split(/(<br\s*\/?>)/gi)
    const convertedLines: string[] = []
    let hasBullets = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Skip <br> tags themselves
      if (line.match(/^<br\s*\/?>$/i)) {
        continue
      }

      // Check if this line contains a bullet point at the start (after stripping tags)
      const textContent = line.replace(/<[^>]+>/g, ' ').trim()
      const bulletMatch = textContent.match(/^\s*([•\-\*])\s+(.+)/)

      if (bulletMatch && bulletMatch[2].length > 5) {
        // This is a bullet point line - convert to table layout
        const bulletText = bulletMatch[2].trim()
        hasBullets = true

        convertedLines.push(
          `<table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 4px 0;">` +
          `<tr>` +
          `<td width="20" valign="top" style="padding: 0; font-size: 11pt; line-height: 1.38; font-family: ${bodyFont}; color: #333;">•</td>` +
          `<td valign="top" style="padding: 0; font-size: 11pt; line-height: 1.38; font-family: ${bodyFont}; color: #333;">${bulletText}</td>` +
          `</tr>` +
          `</table>`
        )
      } else if (textContent.length > 0) {
        // Regular line within paragraph, keep as is
        convertedLines.push(line)
      }
    }

    // If we found bullets, wrap in a div and return, otherwise return original paragraph
    if (hasBullets) {
      return `<div style="margin: 0; padding: 0;">${convertedLines.join('')}</div>`
    }
    return match
  })

  return processed
    // Remove excessive newlines but keep some for readability
    .replace(/\n{3,}/g, '\n\n')
    // Normalize spacing around tags
    .replace(/>\s+</g, '><')
    // Trim whitespace at start/end
    .trim()
}
