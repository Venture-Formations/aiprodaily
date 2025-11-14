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

  // Strip excessive margins from Google Docs <p> tags (keeps paragraph structure but removes indentation)
  processed = processed.replace(/<p([^>]*?)style="([^"]*?)"([^>]*)>/gi, (match, before, styleContent, after) => {
    // Remove margin-top and margin-bottom from style
    const cleanedStyle = styleContent
      .replace(/margin-top:\s*[^;]+;?/gi, '')
      .replace(/margin-bottom:\s*[^;]+;?/gi, '')
      .replace(/;;+/g, ';') // Clean up double semicolons
      .replace(/;\s*$/, '') // Remove trailing semicolon
      .trim()

    if (cleanedStyle) {
      return `<p${before}style="${cleanedStyle}"${after}>`
    } else {
      return `<p${before}${after}>`
    }
  })

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
          `<td width="20" valign="top" style="padding: 0; font-size: 11pt; line-height: 1.38; font-family: ${bodyFont}; font-weight: normal; color: #333;">•</td>` +
          `<td valign="top" style="padding: 0; font-size: 11pt; line-height: 1.38; font-family: ${bodyFont}; font-weight: normal; color: #333;">${bulletText}</td>` +
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

  // Fix already-normalized bullets that are missing font-weight: normal
  // This handles bullets that were previously converted to tables but didn't get the font-weight fix
  processed = processed.replace(
    /<td\s+width="20"\s+valign="top"\s+style="padding:\s*0;\s*font-size:\s*11pt;\s*line-height:\s*1\.38;\s*font-family:\s*([^;]+);\s*color:\s*#333;">•<\/td>/gi,
    '<td width="20" valign="top" style="padding: 0; font-size: 11pt; line-height: 1.38; font-family: $1; font-weight: normal; color: #333;">•</td>'
  )
  processed = processed.replace(
    /<td\s+valign="top"\s+style="padding:\s*0;\s*font-size:\s*11pt;\s*line-height:\s*1\.38;\s*font-family:\s*([^;]+);\s*color:\s*#333;">([^<]+)<\/td>/gi,
    '<td valign="top" style="padding: 0; font-size: 11pt; line-height: 1.38; font-family: $1; font-weight: normal; color: #333;">$2</td>'
  )

  // Remove standalone <br> tags that break sentences
  // Pattern 1: Between spans
  processed = processed.replace(/(<\/span>)\s*<br\s*\/?>\s*(<span[^>]*>)/gi, '$1 $2')

  // Pattern 2: Inside a span that contains only a <br> tag (common in Google Docs paste)
  processed = processed.replace(/<span([^>]*)>\s*<br\s*\/?>\s*<\/span>/gi, '')

  return processed
    // Remove excessive newlines but keep some for readability
    .replace(/\n{3,}/g, '\n\n')
    // Normalize spacing around tags
    .replace(/>\s+</g, '><')
    // Trim whitespace at start/end
    .trim()
}
