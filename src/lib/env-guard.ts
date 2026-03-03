/**
 * Environment detection and send-isolation helpers.
 *
 * All Vercel environments share the same Supabase database and MailerLite API key.
 * Send isolation on Preview deployments is achieved via env-var overrides:
 *   - MAILERLITE_*_GROUP_ID_OVERRIDE  → redirect sends to test groups
 *   - SKIP_SCHEDULE_CHECK=true        → bypass time-of-day gates
 *   - CRON_SECRET                     → already different per environment
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
 * Returns true when schedule-time checks should be skipped.
 * Set SKIP_SCHEDULE_CHECK=true on Vercel Preview (or locally) to allow
 * cron endpoints to fire regardless of the configured send window.
 */
export function shouldSkipScheduleCheck(): boolean {
  return process.env.SKIP_SCHEDULE_CHECK === 'true'
}
