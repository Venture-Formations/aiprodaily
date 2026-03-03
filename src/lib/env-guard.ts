/**
 * Environment detection helpers.
 * Used for observability (campaign name prefixes, cron logging).
 *
 * Actual send isolation is handled by separate Supabase projects per environment —
 * each environment's DB has its own MailerLite group IDs configured in publication_settings.
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
