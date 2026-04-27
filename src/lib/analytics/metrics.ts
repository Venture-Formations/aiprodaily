/**
 * Pure metric formulas for the analytics layer.
 *
 * All functions are synchronous and dependency-free. Any DB access
 * belongs in src/lib/dal/analytics.ts, which feeds typed rows into
 * these formulas.
 *
 * Rules:
 * - Division-by-zero returns 0 (so empty-issue dashboards render cleanly).
 * - Negative inputs throw (signals a DAL bug; fail loud in dev/test).
 * - Rates clamp to [0, 1] on data anomalies (e.g., vendor double-counting).
 */

function clampRate(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    throw new RangeError(
      `Metric inputs must be finite: numerator=${numerator}, denominator=${denominator}`
    )
  }
  if (numerator < 0 || denominator < 0) {
    throw new RangeError(
      `Metric inputs must be non-negative: numerator=${numerator}, denominator=${denominator}`
    )
  }
  if (denominator === 0) return 0
  const rate = numerator / denominator
  return rate > 1 ? 1 : rate
}

export function computeIssueCTR(args: {
  uniqueClickers: number
  deliveredCount: number
}): number {
  return clampRate(args.uniqueClickers, args.deliveredCount)
}

export function computeModuleCTR(args: {
  uniqueClickers: number
  moduleRecipients: number
}): number {
  return clampRate(args.uniqueClickers, args.moduleRecipients)
}

export function computeIssueOpenRate(args: {
  uniqueOpeners: number
  deliveredCount: number
}): number {
  return clampRate(args.uniqueOpeners, args.deliveredCount)
}

export function computePollResponseRate(args: {
  uniqueRespondents: number
  deliveredCount: number
}): number {
  return clampRate(args.uniqueRespondents, args.deliveredCount)
}

export function computeFeedbackResponseRate(args: {
  uniqueRespondents: number
  deliveredCount: number
}): number {
  return clampRate(args.uniqueRespondents, args.deliveredCount)
}

export function computeBounceRate(args: {
  bouncedCount: number
  sentCount: number
}): number {
  return clampRate(args.bouncedCount, args.sentCount)
}

export function computeUnsubscribeRate(args: {
  unsubscribedCount: number
  deliveredCount: number
}): number {
  return clampRate(args.unsubscribedCount, args.deliveredCount)
}
