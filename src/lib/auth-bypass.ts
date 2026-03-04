/**
 * Authentication Bypass — Non-Production Environments
 *
 * Controlled via ALLOW_AUTH_BYPASS=true.
 * Allowed on: local dev, staging (STAGING=true), preview deployments.
 * Blocked on: production (VERCEL_ENV=production without STAGING=true).
 */

export function shouldBypassAuth(): boolean {
  if (process.env.ALLOW_AUTH_BYPASS === 'true') {
    // Block on real production (not staging)
    if (process.env.VERCEL_ENV === 'production' && process.env.STAGING !== 'true') {
      console.error('[SECURITY] ALLOW_AUTH_BYPASS is set on production! Remove it immediately.')
      return false
    }
    return true
  }
  return false
}

/**
 * Mock session for local development when bypass is active.
 */
export function getMockSession() {
  if (!shouldBypassAuth()) {
    throw new Error('getMockSession() called without ALLOW_AUTH_BYPASS — this is a bug')
  }

  return {
    user: {
      email: 'dev@localhost',
      name: 'Dev Mode',
      role: 'admin',
      isActive: true,
      image: null
    },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  }
}
