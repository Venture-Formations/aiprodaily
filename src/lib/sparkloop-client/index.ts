/**
 * SparkLoop Client Library
 *
 * Provides the SparkLoop API client for recommendation syncing,
 * subscriber management, and referral tracking.
 */

export { SparkLoopService, createSparkLoopService, createSparkLoopServiceForPublication } from './sparkloop-client'
export {
  fireMakeWebhook,
  claimMakeWebhookFire,
  markMakeWebhookFired,
  markMakeWebhookExpired,
  recordPollAttempt,
} from './make-webhook'
export type { MakeWebhookPayload, FireMakeWebhookOptions, ClaimMakeWebhookFireArgs } from './make-webhook'
export { triggerMakeWebhook } from './trigger-make-webhook'
export type { TriggerMakeWebhookArgs, TriggerMakeWebhookResult } from './trigger-make-webhook'
