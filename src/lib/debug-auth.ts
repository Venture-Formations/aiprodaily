/**
 * Centralized authentication for debug routes
 * Prevents unauthorized access to debug endpoints in production
 */

import { NextResponse } from 'next/server'

export interface DebugAuthResult {
  authorized: boolean
  response?: NextResponse
}

/**
 * Validates debug route access using secret token
 * @param request - The incoming request object
 * @returns Authorization result with optional 401 response
 */
export function validateDebugAuth(request: Request): DebugAuthResult {
  // In development, allow all requests
  if (process.env.NODE_ENV === 'development') {
    return { authorized: true }
  }

  // In production, require DEBUG_SECRET
  const authHeader = request.headers.get('authorization')
  const debugSecret = process.env.DEBUG_SECRET

  // Check if secret is configured
  if (!debugSecret) {
    console.error('DEBUG_SECRET not configured - debug routes are blocked')
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: 'Debug routes are not available',
          message: 'DEBUG_SECRET not configured'
        },
        { status: 503 }
      )
    }
  }

  // Validate authorization header
  const expectedAuth = `Bearer ${debugSecret}`
  if (!authHeader || authHeader !== expectedAuth) {
    // Sanitize URL before logging to avoid exposing sensitive headers
    const sanitizedUrl = new URL(request.url)
    // Don't log query params that might contain sensitive data

    console.warn('Unauthorized debug route access attempt', {
      ip: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
      path: sanitizedUrl.pathname,
      timestamp: new Date().toISOString()
    })

    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Valid authorization header required'
        },
        { status: 401 }
      )
    }
  }

  return { authorized: true }
}

/**
 * Validates query parameter secret (for GET requests)
 * @param request - The incoming request object
 * @returns Authorization result with optional 401 response
 */
export function validateDebugSecret(request: Request): DebugAuthResult {
  // In development, allow all requests
  if (process.env.NODE_ENV === 'development') {
    return { authorized: true }
  }

  const { searchParams } = new URL(request.url)
  const providedSecret = searchParams.get('secret')
  const debugSecret = process.env.DEBUG_SECRET

  if (!debugSecret) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Debug routes not configured' },
        { status: 503 }
      )
    }
  }

  if (providedSecret !== debugSecret) {
    // Sanitize URL before logging to avoid exposing the secret value
    const sanitizedUrl = new URL(request.url)
    sanitizedUrl.searchParams.delete('secret') // Remove secret from logged URL

    console.warn('Unauthorized debug route access attempt via query param', {
      ip: request.headers.get('x-forwarded-for'),
      path: sanitizedUrl.pathname,
      timestamp: new Date().toISOString()
    })

    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Valid secret parameter required: ?secret=YOUR_SECRET'
        },
        { status: 401 }
      )
    }
  }

  return { authorized: true }
}
