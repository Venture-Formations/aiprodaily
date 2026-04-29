/**
 * SparkLoop Client Library
 *
 * Provides the SparkLoop API client for recommendation syncing,
 * subscriber management, and referral tracking.
 */

export { SparkLoopService, createSparkLoopService, createSparkLoopServiceForPublication } from './sparkloop-client'
export { fireMakeWebhook } from './make-webhook'
export type { MakeWebhookPayload, FireMakeWebhookOptions } from './make-webhook'
