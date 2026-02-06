/**
 * Bot Detection Module
 * Utilities for detecting and handling bot traffic in newsletter analytics
 */

// Re-export all utilities
export { checkUserAgent } from './ua-detector'
export type { UACheckResult } from './ua-detector'

export { checkAndAutoExcludeVelocity } from './velocity-detector'
export type { VelocityCheckParams } from './velocity-detector'

export { handleHoneypotClick } from './honeypot-handler'

export {
  BOT_UA_PATTERNS,
  VELOCITY_THRESHOLD,
  HONEYPOT_CONFIG
} from './constants'
