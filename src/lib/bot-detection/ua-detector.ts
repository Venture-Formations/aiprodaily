/**
 * User-Agent Bot Detection
 * Detects suspicious user agents that indicate bot/automated traffic
 */

import { BOT_UA_PATTERNS } from './constants'

export interface UACheckResult {
  isBot: boolean
  reason: string | null
}

/**
 * Checks if a user agent string indicates bot/automated traffic
 *
 * @param userAgent - The user agent string to check (can be null/undefined)
 * @returns Object with isBot flag and reason if detected
 */
export function checkUserAgent(userAgent: string | null | undefined): UACheckResult {
  // Empty or missing UA is suspicious
  if (!userAgent || userAgent.trim() === '') {
    return {
      isBot: true,
      reason: 'Empty user agent'
    }
  }

  // Normalize to lowercase for pattern matching
  const uaLower = userAgent.toLowerCase()

  // Check against known bot patterns
  for (const { pattern, reason } of BOT_UA_PATTERNS) {
    // Skip empty pattern (handled above)
    if (!pattern) continue

    if (uaLower.includes(pattern.toLowerCase())) {
      return {
        isBot: true,
        reason
      }
    }
  }

  // No bot patterns detected
  return {
    isBot: false,
    reason: null
  }
}
