import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''

  // Detect staging environment
  const isStaging = process.env.VERCEL_ENV === 'preview' ||
                    process.env.VERCEL_GIT_COMMIT_REF === 'staging' ||
                    hostname.includes('staging') ||
                    hostname.includes('git-staging')

  // Skip authentication for staging environment
  if (isStaging) {
    console.log('[Middleware] Staging environment detected - authentication bypassed')
    return NextResponse.next()
  }

  // Check subdomain types
  const isEventsSubdomain = hostname.startsWith('events.')
  const isAdminSubdomain = hostname.startsWith('admin.')

  // Events subdomain - public events pages only
  if (isEventsSubdomain) {
    // Redirect root to events view page
    if (request.nextUrl.pathname === '/') {
      return NextResponse.redirect(new URL('/events/view', request.url))
    }

    // Block dashboard routes
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/events/view', request.url))
    }

    // Block auth routes (no login on events subdomain)
    if (request.nextUrl.pathname.startsWith('/auth')) {
      return NextResponse.redirect(new URL('/events/view', request.url))
    }
  }

  // Admin subdomain - dashboard and auth only
  if (isAdminSubdomain) {
    // Redirect root to dashboard
    if (request.nextUrl.pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Block public events pages (except API routes)
    if (request.nextUrl.pathname.startsWith('/events') && !request.nextUrl.pathname.startsWith('/api')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Allow all other requests (including main domain)
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
