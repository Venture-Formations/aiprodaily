/**
 * Environment detection and send-isolation helpers.
 *
 * All Vercel environments share the same Supabase database and MailerLite API key.
 * Send isolation on Preview/Staging deployments is achieved via env-var overrides:
 *   - MAILERLITE_*_GROUP_ID_OVERRIDE  → redirect sends to test groups
 *   - SKIP_SCHEDULE_CHECK=true        → bypass time-of-day gates
 *   - CRON_SECRET                     → already different per environment
 *   - STAGING=true                    → marks a production Vercel project as staging
 *   - CRON_ENABLED=false              → disables Vercel-scheduled crons (manual triggers still work)
 *
 * Production is unaffected — these override vars are never set there.
 *
 * Uses VERCEL_ENV (set automatically by Vercel) to detect environment.
 * Falls back to 'development' for local dev.
 */

export type VercelEnv = 'production' | 'preview' | 'development'

export function getEnvironment(): VercelEnv {
  const env = process.env.VERCEL_ENV
  if (env === 'production' || env === 'preview' || env === 'development') return env
  return 'development'
}

export function isProduction(): boolean {
  return getEnvironment() === 'production'
}

/**
 * Returns true if this deployment is a staging environment.
 * A staging Vercel project has VERCEL_ENV=production but STAGING=true,
 * giving it its own Supabase project and MailerLite test groups.
 */
export function isStaging(): boolean {
  return process.env.STAGING === 'true'
}

/**
 * Returns true when MailerLite send guards (group ID overrides) should apply.
 * Guards apply on non-production environments AND on staging.
 */
export function shouldApplySendGuards(): boolean {
  if (getEnvironment() !== 'production') return true
  return isStaging()
}

/**
 * Returns true when Vercel-scheduled crons are allowed to run.
 * Set CRON_ENABLED=false on staging to prevent automatic cron execution.
 * Manual triggers (Bearer token / secret param) bypass this check.
 */
export function isCronEnabled(): boolean {
  return process.env.CRON_ENABLED !== 'false'
}

/**
 * Returns true when schedule-time checks should be skipped.
 * Set SKIP_SCHEDULE_CHECK=true on Vercel Preview (or locally) to allow
 * cron endpoints to fire regardless of the configured send window.
 * Hard-blocked in production (unless staging) so the var can never accidentally bypass gates.
 */
export function shouldSkipScheduleCheck(): boolean {
  if (getEnvironment() === 'production' && !isStaging()) return false
  return process.env.SKIP_SCHEDULE_CHECK === 'true'
}
