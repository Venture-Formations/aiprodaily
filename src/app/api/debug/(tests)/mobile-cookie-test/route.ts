import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()

    // Check for NextAuth specific cookies
    const sessionToken = cookieStore.get('next-auth.session-token') || cookieStore.get('__Secure-next-auth.session-token')
    const csrfToken = cookieStore.get('next-auth.csrf-token') || cookieStore.get('__Host-next-auth.csrf-token')

    return NextResponse.json({
      diagnosis: 'Mobile Cookie Analysis',
      cookies: {
        total: allCookies.length,
        names: allCookies.map(c => c.name),
        values: Object.fromEntries(allCookies.map(c => [c.name, c.value.substring(0, 20) + '...'])),
        nextAuth: {
          sessionToken: sessionToken ? 'FOUND' : 'MISSING',
          csrfToken: csrfToken ? 'FOUND' : 'MISSING'
        }
      },
      headers: {
        userAgent: request.headers.get('user-agent'),
        cookie: request.headers.get('cookie'),
        host: request.headers.get('host'),
        'x-forwarded-proto': request.headers.get('x-forwarded-proto')
      },
      nextSteps: sessionToken ?
        'Session token found - try /api/debug/auth-status' :
        'No session token - login may have failed. Try clearing cookies and logging in again.',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Cookie analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}