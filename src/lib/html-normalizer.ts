// HTML normalization utilities for email-safe formatting
// Used when saving advertorial content to the database

/**
 * Normalizes HTML content by stripping Google Docs formatting and creating clean, simple HTML.
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

  // Remove ALL attributes from tags (except href on links)
  processed = processed.replace(/<p[^>]*>/gi, '<p>')
  processed = processed.replace(/<br[^>]*>/gi, '<br>')
  processed = processed.replace(/<strong[^>]*>/gi, '<strong>')
  processed = processed.replace(/<b[^>]*>/gi, '<b>')

  // Handle links - keep href but remove other attributes
  processed = processed.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>/gi, '<a href="$1">')

  // Normalize whitespace (but preserve structure)
  processed = processed
    .replace(/>\s+</g, '><') // Remove spaces between tags
    .trim()

  return processed
}
