import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Check if this is a /tools route (for Clerk middleware)
const isToolsRoute = createRouteMatcher(['/tools(.*)'])

// Newsletter website domain mappings (for easy addition of new newsletters)
// Format: domain -> newsletter slug
const NEWSLETTER_DOMAINS: Record<string, string> = {
  'aiaccountingdaily.com': 'accounting',
  'www.aiaccountingdaily.com': 'accounting',
  // Future newsletters - just add new domains here:
  // 'ainursingdaily.com': 'nursing',
  // 'www.ainursingdaily.com': 'nursing',
}

// Admin domains (dashboard access)
const ADMIN_DOMAINS = ['aiprodaily.com', 'www.aiprodaily.com', 'aiprodaily.vercel.app']

// Custom middleware logic for non-tools routes
async function customMiddleware(request: NextRequest): Promise<NextResponse> {
  const hostname = request.headers.get('host') || ''
  const url = request.nextUrl

  // Detect staging environment - VERY strict, only for actual staging deployments
  // NEVER treat production domains as staging
  const isProductionDomain = hostname === 'aiprodaily.com' ||
                             hostname === 'www.aiprodaily.com' ||
                             hostname === 'aiaccountingdaily.com' ||
                             hostname === 'www.aiaccountingdaily.com'

  const isStaging = !isProductionDomain && (
    process.env.VERCEL_GIT_COMMIT_REF === 'staging' ||
    hostname.includes('git-staging') ||
    hostname.includes('-staging-')
  )

  // Skip authentication for staging environment
  if (isStaging) {
    console.log('[Middleware] Staging environment detected - authentication bypassed', {
      vercelEnv: process.env.VERCEL_ENV,
      gitRef: process.env.VERCEL_GIT_COMMIT_REF,
      hostname
    })
    // Redirect signin page to dashboard when in staging mode
    if (url.pathname === '/auth/signin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // Check if this is a newsletter website domain (takes priority over subdomain logic)
  const newsletterSlug = NEWSLETTER_DOMAINS[hostname]

  if (newsletterSlug) {
    console.log('[Middleware] Newsletter domain detected:', newsletterSlug)
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

    if (url.pathname === '/') {
      rewriteUrl.pathname = '/website'
    } else {
      rewriteUrl.pathname = `/website${url.pathname}`
    }

    // Add newsletter context to headers
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-newsletter-slug', newsletterSlug)

    return NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders,
      },
    })
  }

  // Check if this is an admin domain (exact match)
  const isAdminDomain = ADMIN_DOMAINS.includes(hostname)

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
  const isVercelPreview = hostname.includes('.vercel.app') && !ADMIN_DOMAINS.includes(hostname)
  if (isVercelPreview) {
    console.log('[Middleware] Vercel preview deployment detected - skipping subdomain logic')
    return NextResponse.next()
  }

  // Extract subdomain
  const parts = hostname.split('.')
  const isDevelopment = hostname.includes('localhost') || hostname.includes('127.0.0.1')

  let subdomain: string | null = null

  // Development: accounting.localhost or admin.localhost
  if (isDevelopment && parts.length > 1 && parts[0] !== 'localhost') {
    subdomain = parts[0]
  }
  // Production: accounting.yourdomain.com or admin.yourdomain.com
  else if (!isDevelopment && parts.length >= 3) {
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
      const apiUrl = isDevelopment
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

// Routes that are hidden until launch (controlled by ENABLE_CUSTOMER_PORTAL env var)
const isCustomerPortalRoute = createRouteMatcher(['/account(.*)', '/tools(.*)'])

// Main middleware - uses clerkMiddleware for /tools routes, custom logic for others
export default clerkMiddleware(async (auth, request) => {
  const url = request.nextUrl

  console.log('[Middleware] Request:', {
    hostname: request.headers.get('host') || '',
    pathname: url.pathname,
    method: request.method
  })

  // Block customer portal and tools directory if not enabled
  // Set ENABLE_CUSTOMER_PORTAL=true in Vercel env vars when ready to launch
  if (isCustomerPortalRoute(request) && process.env.ENABLE_CUSTOMER_PORTAL !== 'true') {
    const previewSecret = url.searchParams.get('preview')
    const previewCookie = request.cookies.get('portal_preview')?.value
    
    // Allow access with secret query param OR valid preview cookie
    if (previewSecret === process.env.PREVIEW_SECRET) {
      // Set cookie so user can navigate without ?preview param
      const response = NextResponse.next()
      response.cookies.set('portal_preview', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 // 24 hours
      })
      return response
    }
    
    if (previewCookie !== 'true') {
      console.log('[Middleware] Customer portal not enabled, redirecting to home')
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // Handle /tools routes with Clerk
  if (isToolsRoute(request)) {
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
     * - api (API routes)
     * - auth (authentication pages)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - Static files (files with extensions like .ico, .png, .jpg, .svg, etc.)
     */
    '/',
    '/((?!api|auth|_next/static|_next/image|.*\\..*).*)',
  ],
}
