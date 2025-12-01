// HTML normalization utilities for email-safe formatting
// Used when saving advertorial content to the database

/**
 * Normalizes HTML content by stripping Google Docs formatting and creating clean, simple HTML
 * with proper bullet/numbered list formatting that handles multi-line wrapping.
 * This should be called when SAVING advertorial content to the database.
 */
export function normalizeEmailHtml(html: string, bodyFont: string = 'Arial, sans-serif'): string {
  let processed = html

  // Convert font-weight: 700 spans to <strong> tags before removing spans
  processed = processed.replace(/<span([^>]*?)font-weight:\s*700([^>]*?)>(.*?)<\/span>/gi, '<strong>$3</strong>')

  // Strip the outer Google Docs wrapper span
  processed = processed.replace(/<span[^>]*docs-internal-guid[^>]*>([\s\S]*?)<\/span>\s*$/gi, '$1')

  // Convert divs to paragraphs
  processed = processed.replace(/<div[^>]*>/gi, '<p>')
  processed = processed.replace(/<\/div>/gi, '</p>')

  // Remove ALL other spans - keep just the text content
  processed = processed.replace(/<span[^>]*>(.*?)<\/span>/gi, '$1')

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
  processed = processed.replace(/<p[^>]*>/gi, '<p>')
  processed = processed.replace(/<br[^>]*>/gi, '<br>')
  processed = processed.replace(/<strong[^>]*>/gi, '<strong>')
  processed = processed.replace(/<b[^>]*>/gi, '<b>')

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
              // Preserve the original bullet character (• or →)
              return `<tr><td valign="top" style="padding-right:8px;">${bulletMatch[1]}</td><td>${bulletMatch[2]}</td></tr>`
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

  // Normalize whitespace (but preserve structure)
  processed = processed
    .replace(/>\s+</g, '><') // Remove spaces between tags
    .trim()

  return processed
}
