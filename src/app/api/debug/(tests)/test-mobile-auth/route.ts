import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const userAgent = request.headers.get('user-agent') || 'Unknown'
    const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent)

    // Check cookies
    const cookieHeader = request.headers.get('cookie')
    const hasSessionCookie = cookieHeader && cookieHeader.includes('next-auth')

    return NextResponse.json({
      device: {
        userAgent,
        isMobile,
        platform: isMobile ? 'Mobile' : 'Desktop'
      },
      session: {
        hasCookies: !!cookieHeader,
        hasSessionCookie,
        cookieCount: cookieHeader ? cookieHeader.split(';').length : 0,
        cookies: cookieHeader ? cookieHeader.split(';').map(c => c.trim().split('=')[0]) : []
      },
      instructions: {
        step1: 'Visit /auth/signin on mobile',
        step2: 'Complete Google OAuth flow',
        step3: 'Come back to this endpoint to see if cookies were set',
        step4: 'Then try /api/debug/auth-status again'
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}