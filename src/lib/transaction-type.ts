/**
 * Normalize a raw transaction_type value to exactly "Purchase" or "Sale".
 * Handles upstream variants like "Sale (Partial)", "Purchase (partial)", "P", "S", etc.
 * Returns empty string for null/undefined/empty input so downstream consumers can decide
 * how to render a missing value.
 */
export function normalizeTransactionType(raw: string | null | undefined): '' | 'Purchase' | 'Sale' {
  if (!raw) return ''
  return raw.toLowerCase().includes('purchase') ? 'Purchase' : 'Sale'
}
