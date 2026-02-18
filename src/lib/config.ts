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

export const SITE_BASE_URL: string =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://aiaccountingdaily.com'
