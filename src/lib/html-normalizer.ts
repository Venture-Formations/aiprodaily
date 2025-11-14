// HTML normalization utilities for email-safe formatting
// Used when saving advertorial content to the database

/**
 * Normalizes HTML content for email clients by converting lists and manual bullets
 * to simple text with bullet prefixes ("• ").
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

  // Remove leading/trailing whitespace from span content BEFORE processing bullets
  // This fixes the indent issue where bullets have extra spaces before them
  processed = processed.replace(/<span([^>]*)>([\s\S]*?)<\/span>/gi, (match, attrs, content) => {
    // Only trim if the span has white-space-collapse: preserve
    if (attrs.includes('white-space-collapse: preserve')) {
      return `<span${attrs}>${content.trim()}</span>`
    }
    return match
  })

  // Remove any existing table-based bullets first (from previous normalization)
  processed = processed.replace(/<table[^>]*width="100%"[^>]*cellpadding="0"[^>]*>[\s\S]*?<td[^>]*>•<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/table>/gi, '• $1<br>')

  // Convert <ul> and <ol> lists to simple text with bullets
  processed = processed.replace(/<[ou]l[^>]*>/gi, '')
  processed = processed.replace(/<\/[ou]l>/gi, '')

  // Convert <li> tags to simple bullet points
  processed = processed.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (match, content) => {
    // Strip any leading/trailing <br> tags and whitespace
    let cleanContent = content.trim()
      .replace(/^(<br\s*\/?>)+/gi, '')
      .replace(/(<br\s*\/?>)+$/gi, '')
      .trim()

    // Replace remaining <br> tags with spaces to keep text inline
    cleanContent = cleanContent.replace(/<br\s*\/?>/gi, ' ')

    return `• ${cleanContent}<br>`
  })

  // Handle manual bullet points (from Google Docs paste or manual entry)
  // Process paragraph by paragraph to preserve structure
  processed = processed.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (match, paragraphContent) => {
    // Split paragraph content by <br> tags
    const lines = paragraphContent.split(/(<br\s*\/?>)/gi)
    const convertedLines: string[] = []
    let hasBullets = false

    for (let i = 0; i < lines.length; i++) {
      // Trim each line to remove leading/trailing whitespace
      const line = lines[i].trim()

      // Skip <br> tags and empty lines
      if (!line || line.match(/^<br\s*\/?>$/i)) {
        continue
      }

      // Check if this line contains a bullet point at the start (after stripping tags)
      const textContent = line.replace(/<[^>]+>/g, ' ').trim()
      const bulletMatch = textContent.match(/^\s*([•\-\*])\s+(.+)/)

      if (bulletMatch && bulletMatch[2].length > 5) {
        // This is a bullet point line - keep it simple with just "• text"
        const bulletText = bulletMatch[2].trim()
        hasBullets = true
        convertedLines.push(`• ${bulletText}<br>`)
      } else if (textContent.length > 0) {
        // Regular line within paragraph, keep as is (already trimmed)
        convertedLines.push(line)
      }
    }

    // If we found bullets, return just the bullets
    if (hasBullets) {
      return convertedLines.join('')
    }
    return match
  })

  // Clean up already-normalized bullets that have leading whitespace and extra spaces
  // This fixes bullets that are like "<br>  •  text" to be "<br>• text"
  processed = processed.replace(/(<br\s*\/?>)\s+•\s+/gi, '$1• ')

  // Also fix bullets that have 2+ spaces after the bullet symbol (anywhere, not just after <br>)
  // This fixes "•  text" to be "• text"
  processed = processed.replace(/•\s{2,}/g, '• ')

  // Remove empty bold/strong tags that contain only <br> (causes extra line breaks)
  processed = processed.replace(/<(b|strong)>\s*<br\s*\/?>\s*<\/(b|strong)>/gi, '')

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
