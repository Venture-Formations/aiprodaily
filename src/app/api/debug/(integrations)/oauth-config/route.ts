import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const userAgent = request.headers.get('user-agent') || 'Unknown'

    return NextResponse.json({
      environment: {
        nodeEnv: process.env.NODE_ENV,
        nextauthUrl: process.env.NEXTAUTH_URL,
        nextauthSecret: process.env.NEXTAUTH_SECRET ? '[SET]' : '[NOT SET]',
        googleClientId: process.env.GOOGLE_CLIENT_ID ? '[SET]' : '[NOT SET]',
        googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ? '[SET]' : '[NOT SET]'
      },
      request: {
        host: url.host,
        origin: url.origin,
        userAgent: userAgent,
        isMobile: /Mobile|Android|iPhone|iPad/i.test(userAgent),
        headers: {
          host: request.headers.get('host'),
          'x-forwarded-host': request.headers.get('x-forwarded-host'),
          'x-forwarded-proto': request.headers.get('x-forwarded-proto')
        }
      },
      urls: {
        signIn: `${url.origin}/auth/signin`,
        callback: `${url.origin}/api/auth/callback/google`,
        nextAuth: `${url.origin}/api/auth`
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check OAuth config',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}