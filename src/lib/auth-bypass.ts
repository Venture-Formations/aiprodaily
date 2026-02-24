/**
 * Authentication Bypass — Local Development Only
 *
 * Controlled via ALLOW_AUTH_BYPASS=true in .env.local.
 * Never set this on Vercel (staging or production).
 */

export function shouldBypassAuth(): boolean {
  if (process.env.ALLOW_AUTH_BYPASS === 'true') {
    if (process.env.VERCEL) {
      console.error('[SECURITY] ALLOW_AUTH_BYPASS is set on Vercel! Remove it immediately.')
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
