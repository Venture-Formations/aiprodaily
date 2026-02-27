/**
 * Centralized configuration
 *
 * Reads from environment variables with hardcoded fallbacks so existing
 * deployments continue to work while new contributors can set their own values.
 */

const FALLBACK_PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

export const PUBLICATION_ID: string = (() => {
  const envValue = process.env.DEFAULT_PUBLICATION_ID
  if (envValue) return envValue
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[Config] DEFAULT_PUBLICATION_ID not set — using hardcoded fallback. ' +
      'Set it in .env.local for your own Supabase instance.'
    )
  }
  return FALLBACK_PUBLICATION_ID
})()

// SITE_BASE_URL is for background jobs, cron, and build-time contexts only.
// Website pages should use the request host via resolvePublicationFromRequest().
export const SITE_BASE_URL: string =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://aiaccountingdaily.com'

/**
 * Base URL for Supabase Storage public objects.
 * When a custom domain is configured (e.g. img.aiprodaily.com), set
 * STORAGE_PUBLIC_URL to use it instead of the default Supabase project URL.
 */
export const STORAGE_PUBLIC_URL: string = (
  process.env.STORAGE_PUBLIC_URL ||
  `${process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vsbdfrqfokoltgjyiivq.supabase.co'}/storage/v1/object/public`
).replace(/\/+$/, '')
