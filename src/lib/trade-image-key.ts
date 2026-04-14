import { normalizeTransactionType } from './transaction-type'

/**
 * Build a composite key identifying a trade card image by the specific
 * (ticker, member, transaction side) it represents.
 *
 * Images used to be matched by ticker alone, which mis-assigned the wrong
 * member's photo when multiple members traded the same stock. Every lookup
 * from articles → trade images must go through this key.
 *
 * Returns null if any part of the key is missing so callers can fall back
 * explicitly rather than silently keying on an incomplete tuple.
 */
export function buildTradeImageKey(
  ticker: string | null | undefined,
  memberName: string | null | undefined,
  transaction: string | null | undefined
): string | null {
  if (!ticker || !memberName) return null
  const normalizedTicker = ticker.trim().toUpperCase()
  const normalizedMember = memberName.trim().toLowerCase().replace(/\s+/g, ' ')
  const normalizedTxn = normalizeTransactionType(transaction)
  if (!normalizedTicker || !normalizedMember || !normalizedTxn) return null
  return `${normalizedTicker}|${normalizedMember}|${normalizedTxn}`
}
