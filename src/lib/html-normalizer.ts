// HTML normalization utilities for email-safe formatting
// Used for advertorial content to ensure consistent rendering in emails

/**
 * Normalizes HTML content by stripping Google Docs formatting and creating clean, simple HTML
 * with proper bullet/numbered list formatting that handles multi-line wrapping.
 */
export function normalizeEmailHtml(html: string, bodyFont: string = 'Arial, sans-serif'): string {
  let processed = html

  // Convert font-weight: 700 spans to <strong> tags before removing spans
  // BUT only if they don't contain block elements (p, div, br) - otherwise they're wrapper spans
  processed = processed.replace(/<span([^>]*?)font-weight:\s*700([^>]*?)>(.*?)<\/span>/gi, (match, before, after, content) => {
    // If content contains block elements, it's a wrapper - don't make it strong
    if (/<(?:p|div|br|table|tr|td)[^>]*>/i.test(content)) {
      return content // Just return the content without the span
    }
    return `<strong>${content}</strong>`
  })

  // Convert font-style: italic spans to <em> tags before removing spans
  // Same logic - don't convert wrapper spans
  processed = processed.replace(/<span([^>]*?)font-style:\s*italic([^>]*?)>(.*?)<\/span>/gi, (match, before, after, content) => {
    if (/<(?:p|div|br|table|tr|td)[^>]*>/i.test(content)) {
      return content
    }
    return `<em>${content}</em>`
  })

  // Strip the outer Google Docs wrapper span
  processed = processed.replace(/<span[^>]*docs-internal-guid[^>]*>([\s\S]*?)<\/span>\s*$/gi, '$1')

  // Convert divs to paragraphs
  processed = processed.replace(/<div[^>]*>/gi, '<p>')
  processed = processed.replace(/<\/div>/gi, '</p>')

  // Remove spans WITHOUT meaningful styles (preserve color, background-color)
  // First, preserve spans with color or background styles by marking them temporarily
  const preservedSpans: string[] = []
  processed = processed.replace(/<span[^>]*style\s*=\s*["'][^"']*(?:color|background)[^"']*["'][^>]*>(.*?)<\/span>/gi, (match) => {
    preservedSpans.push(match)
    return `__PRESERVED_SPAN_${preservedSpans.length - 1}__`
  })
  
  // Now remove all other spans (they don't have meaningful styles)
  processed = processed.replace(/<span[^>]*>(.*?)<\/span>/gi, '$1')
  
  // Restore preserved spans
  preservedSpans.forEach((span, index) => {
    processed = processed.replace(`__PRESERVED_SPAN_${index}__`, span)
  })

  // IMPORTANT: Handle React Quill list formats BEFORE removing attributes
  // React Quill uses <ol><li data-list="bullet"> for bullet lists
  // React Quill uses <ol><li data-list="ordered"> for numbered lists

  // Convert React Quill bullet lists (ol with data-list="bullet") to table format
  processed = processed.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, content) => {
    // Check if this is a React Quill bullet list
    if (/<li[^>]*data-list="bullet"/.test(content)) {
      const items = content.match(/<li[^>]*>(.*?)<\/li>/gi)
      if (!items) return match

      const tableRows = items.map((item: string) => {
        const text = item.replace(/<li[^>]*>/gi, '').replace(/<\/li>/gi, '').trim()
        return `<tr><td valign="top" style="padding-right:8px;">•</td><td>${text}</td></tr>`
      }).join('')

      return `<table cellpadding="0" cellspacing="0" style="margin:8px 0;">${tableRows}</table>`
    }

    // Check if this is a React Quill numbered list or standard numbered list
    if (/<li[^>]*data-list="ordered"/.test(content) || !/<li[^>]*data-list=/.test(content)) {
      let counter = 0
      const items = content.match(/<li[^>]*>(.*?)<\/li>/gi)
      if (!items) return match

      const tableRows = items.map((item: string) => {
        counter++
        const text = item.replace(/<li[^>]*>/gi, '').replace(/<\/li>/gi, '').trim()
        return `<tr><td valign="top" style="padding-right:8px;">${counter}.</td><td>${text}</td></tr>`
      }).join('')

      return `<table cellpadding="0" cellspacing="0" style="margin:8px 0;">${tableRows}</table>`
    }

    return match
  })

  // Remove ALL attributes from tags (except href on links - list tags already processed above)
  // Add inline margin:0 to paragraphs to prevent excessive spacing in emails
  processed = processed.replace(/<p[^>]*>/gi, '<p style="margin:0;">')
  processed = processed.replace(/<br[^>]*>/gi, '<br>')
  processed = processed.replace(/<strong[^>]*>/gi, '<strong>')
  processed = processed.replace(/<b(?!r)[^>]*>/gi, '<b>') // Negative lookahead to avoid matching <br>
  processed = processed.replace(/<em[^>]*>/gi, '<em>')
  processed = processed.replace(/<i[^>]*>/gi, '<i>')

  // Handle links - keep href but remove other attributes
  processed = processed.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>/gi, '<a href="$1">')

  // Convert <ul> lists to table-based format for proper bullet indentation
  processed = processed.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, content) => {
    const items = content.match(/<li[^>]*>(.*?)<\/li>/gi)
    if (!items) return match

    const tableRows = items.map((item: string) => {
      const text = item.replace(/<li[^>]*>/gi, '').replace(/<\/li>/gi, '').trim()
      return `<tr><td valign="top" style="padding-right:8px;">•</td><td>${text}</td></tr>`
    }).join('')

    return `<table cellpadding="0" cellspacing="0" style="margin:8px 0;">${tableRows}</table>`
  })

  // Convert manual bullets (• or → followed by text<br>) to table format
  processed = processed.replace(/<p>([\s\S]*?)<\/p>/gi, (match, content) => {
    // Check if this paragraph contains manual bullets (• or →)
    if (/[•→]/.test(content)) {
      const lines = content.split(/<br\s*\/?>/gi)
      const hasManualBullets = lines.some((line: string) => /^\s*[•→]\s+/.test(line.replace(/<[^>]+>/g, '')))

      if (hasManualBullets) {
        const tableRows = lines
          .filter((line: string) => line.trim())
          .map((line: string) => {
            const cleanLine = line.replace(/<[^>]+>/g, '').trim()
            // Match both • and → as bullet characters
            const bulletMatch = cleanLine.match(/^\s*([•→])\s+(.+)/)
            if (bulletMatch) {
              // Make the bullet/arrow bold for better visibility
              return `<tr><td valign="top" style="padding-right:8px;"><strong>${bulletMatch[1]}</strong></td><td>${bulletMatch[2]}</td></tr>`
            }
            return null
          })
          .filter(Boolean)
          .join('')

        if (tableRows) {
          return `<table cellpadding="0" cellspacing="0" style="margin:8px 0;">${tableRows}</table>`
        }
      }
    }
    return match
  })

  // Normalize whitespace - only collapse excessive whitespace (3+ spaces), preserve paragraph breaks
  processed = processed
    .replace(/>\s{3,}</g, '> <')  // Only collapse 3+ spaces to single space
    .trim()

  return processed
}
