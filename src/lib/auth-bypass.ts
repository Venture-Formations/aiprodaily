/**
 * Authentication Bypass for Staging Environment
 *
 * This utility allows testing on staging without OAuth configuration.
 */

export function isStagingEnvironment(): boolean {
  // Check Vercel environment variables
  if (process.env.VERCEL_ENV === 'preview') return true
  if (process.env.VERCEL_GIT_COMMIT_REF === 'staging') return true

  // Check hostname patterns
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname.includes('staging') || hostname.includes('git-staging')) {
      return true
    }
  }

  // Check for explicit staging flag
  if (process.env.NEXT_PUBLIC_STAGING === 'true') return true

  return false
}

export function shouldBypassAuth(): boolean {
  return isStagingEnvironment()
}

/**
 * Mock session for staging environment
 */
export function getMockSession() {
  return {
    user: {
      email: 'staging@test.com',
      name: 'Staging Test User',
      role: 'admin',
      isActive: true,
      image: null
    },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
  }
}
