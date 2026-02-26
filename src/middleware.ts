import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Check if this is a /tools route (for Clerk middleware)
const isToolsRoute = createRouteMatcher(['/tools(.*)'])

// Check if this is an /account route (for Clerk middleware)
const isAccountRoute = createRouteMatcher(['/account(.*)'])

// Admin domains (dashboard access)
const ADMIN_DOMAINS = ['aiprodaily.com', 'www.aiprodaily.com', 'aiprodaily.vercel.app']

// Custom middleware logic for non-tools routes
async function customMiddleware(request: NextRequest): Promise<NextResponse> {
  const hostname = request.headers.get('host') || ''
  const url = request.nextUrl

  // Dynamic domain lookup: check if this hostname belongs to a publication
  // Skip the lookup for admin domains, Vercel previews, and localhost without subdomains
  const isAdminDomain = ADMIN_DOMAINS.includes(hostname)
  const isVercelPreview = hostname.includes('.vercel.app') && !ADMIN_DOMAINS.includes(hostname)
  const isDev = hostname.includes('localhost') || hostname.includes('127.0.0.1')

  if (!isAdminDomain && !isVercelPreview) {
    try {
      const apiBase = isDev
        ? 'http://localhost:3000'
        : `${url.protocol}//${hostname}`

      const res = await fetch(`${apiBase}/api/publications/by-domain?domain=${hostname}`)
      const contentType = res.headers.get('content-type')

      if (contentType?.includes('application/json')) {
        const { publication } = await res.json()

        if (publication) {
          console.log('[Middleware] Newsletter domain detected:', publication.slug)

          // Skip for API routes, Next.js internals, static files, dashboard, and auth
          if (
            url.pathname.startsWith('/_next') ||
            url.pathname.startsWith('/api') ||
            url.pathname.startsWith('/auth') ||
            url.pathname.startsWith('/dashboard') ||
            url.pathname.includes('.')
          ) {
            return NextResponse.next()
          }

          // Rewrite to /website routes for newsletter domains
          const rewriteUrl = url.clone()
          rewriteUrl.pathname = url.pathname === '/'
            ? '/website'
            : `/website${url.pathname}`

          // Add newsletter context to headers
          const requestHeaders = new Headers(request.headers)
          requestHeaders.set('x-newsletter-slug', publication.slug)
          requestHeaders.set('x-newsletter-id', publication.id)

          return NextResponse.rewrite(rewriteUrl, {
            request: {
              headers: requestHeaders,
            },
          })
        }
      }
    } catch (error) {
      console.error('[Middleware] Domain lookup error:', error)
      // Fall through to existing logic
    }
  }

  console.log('[Middleware] Admin domain check:', {
    hostname,
    isAdminDomain,
    adminDomains: ADMIN_DOMAINS
  })

  if (isAdminDomain) {
    console.log('[Middleware] Admin domain matched:', hostname)
    // Admin domain - redirect root directly to signin (skip the root page component)
    if (url.pathname === '/') {
      console.log('[Middleware] Redirecting root to /auth/signin')
      return NextResponse.redirect(new URL('/auth/signin', request.url))
    }
    // Allow normal dashboard/auth routing for other paths
    console.log('[Middleware] Passing through to Next.js routing')
    return NextResponse.next()
  }

  console.log('[Middleware] Not an admin domain, checking subdomain logic...')

  // Skip subdomain logic for Vercel preview deployments
  if (isVercelPreview) {
    console.log('[Middleware] Vercel preview deployment detected - skipping subdomain logic')
    return NextResponse.next()
  }

  // Extract subdomain
  const parts = hostname.split('.')

  let subdomain: string | null = null

  // Development: accounting.localhost or admin.localhost
  if (isDev && parts.length > 1 && parts[0] !== 'localhost') {
    subdomain = parts[0]
  }
  // Production: accounting.yourdomain.com or admin.yourdomain.com
  else if (!isDev && parts.length >= 3) {
    subdomain = parts[0]
  }

  // Handle admin subdomain
  if (subdomain === 'admin') {
    // Redirect root to dashboard (newsletter selector)
    if (url.pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // Handle newsletter subdomains (not admin, not www, not events)
  if (subdomain && subdomain !== 'www' && subdomain !== 'events') {
    // For newsletter subdomains, fetch newsletter from database and add to headers
    try {
      const apiUrl = isDev
        ? `http://localhost:3000/api/newsletters/by-subdomain?subdomain=${subdomain}`
        : `${url.protocol}//${hostname}/api/newsletters/by-subdomain?subdomain=${subdomain}`

      const response = await fetch(apiUrl)

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        console.error('[Middleware] API returned non-JSON response:', {
          status: response.status,
          contentType,
          url: apiUrl
        })
        return NextResponse.next()
      }

      const data = await response.json()

      if (data.success && data.newsletter) {
        // Add newsletter context to request headers
        const requestHeaders = new Headers(request.headers)
        requestHeaders.set('x-newsletter-id', data.newsletter.id)
        requestHeaders.set('x-newsletter-slug', data.newsletter.slug)

        return NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        })
      } else {
        // Newsletter not found for this subdomain
        console.log('[Middleware] Newsletter not found for subdomain:', subdomain)
        return new NextResponse('Newsletter not found', { status: 404 })
      }
    } catch (error) {
      console.error('[Middleware] Error fetching newsletter:', error)
      return NextResponse.next()
    }
  }

  // Legacy subdomain handling for backward compatibility
  const isEventsSubdomain = hostname.startsWith('events.')
  const isAdminSubdomain = hostname.startsWith('admin.')

  // Events subdomain - public events pages only
  if (isEventsSubdomain) {
    if (url.pathname === '/') {
      return NextResponse.redirect(new URL('/events/view', request.url))
    }
    if (url.pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/events/view', request.url))
    }
    if (url.pathname.startsWith('/auth')) {
      return NextResponse.redirect(new URL('/events/view', request.url))
    }
  }

  // Admin subdomain - dashboard and auth only (legacy)
  if (isAdminSubdomain) {
    if (url.pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    if (url.pathname.startsWith('/events') && !url.pathname.startsWith('/api')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Default: pass through to Next.js routing
  console.log('[Middleware] Default: passing through to Next.js routing')
  return NextResponse.next()
}

// Main middleware - uses clerkMiddleware for /tools routes, custom logic for others
export default clerkMiddleware(async (auth, request) => {
  const url = request.nextUrl

  console.log('[Middleware] Request:', {
    hostname: request.headers.get('host') || '',
    pathname: url.pathname,
    method: request.method
  })

  // Handle /tools and /account routes with Clerk
  if (isToolsRoute(request) || isAccountRoute(request)) {
    // Don't use auth.protect() here - the submit page has SignedIn/SignedOut
    // components that handle authentication state gracefully
    // Let Clerk process the request to provide auth context
    return NextResponse.next()
  }

  // For all other routes, use custom middleware logic
  return customMiddleware(request)
})

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - Most api routes (except /api/account/* which needs Clerk auth)
     * - auth (authentication pages)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - Static files (files with extensions like .ico, .png, .jpg, .svg, etc.)
     */
    '/',
    '/api/account/:path*',
    '/((?!api|auth|_next/static|_next/image|.*\\..*).*)',
  ],
}
