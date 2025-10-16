import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const url = request.nextUrl

  // Detect staging environment
  const isStaging = process.env.VERCEL_ENV === 'preview' ||
                    process.env.VERCEL_GIT_COMMIT_REF === 'staging' ||
                    process.env.NEXT_PUBLIC_STAGING === 'true' ||
                    hostname.includes('staging') ||
                    hostname.includes('git-staging')

  // Skip authentication for staging environment
  if (isStaging) {
    console.log('[Middleware] Staging environment detected - authentication bypassed')
    // Redirect signin page to dashboard when in staging mode
    if (url.pathname === '/auth/signin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // Check if this is a newsletter website domain (takes priority over subdomain logic)
  const newsletterSlug = NEWSLETTER_DOMAINS[hostname]

  if (newsletterSlug) {
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

  // Check if this is an admin domain
  if (ADMIN_DOMAINS.some(domain => hostname === domain || hostname.startsWith(domain))) {
    // Admin domain - allow normal dashboard/auth routing
    if (url.pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
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
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
