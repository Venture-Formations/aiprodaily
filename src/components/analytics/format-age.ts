/**
 * Format a millisecond age as a short human-readable string.
 *
 * Tiers: "just now" (<60s) → "Nm ago" → "Nh ago" → "Nd ago".
 * Negative ages (clock skew) treated as zero.
 */
export function formatAge(ageMs: number): string {
  if (ageMs < 60 * 1000) return 'just now'
  const minutes = Math.floor(ageMs / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
