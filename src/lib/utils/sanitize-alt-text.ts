/**
 * Sanitize text for use in HTML alt attributes.
 * Strips quotes, normalizes whitespace, and enforces 200 char limit.
 */
export function sanitizeAltText(text: string | null | undefined, fallback = 'Image'): string {
  if (!text) return fallback
  return text
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
    || fallback
}
