import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(tests)/simple-auth-test' },
  async ({ session, logger }) => {
    // This route intentionally tests the full session object for debugging
    const complexSession = await getServerSession(authOptions)

    return NextResponse.json({
      test: 'Simple Auth Test',
      wrapperAuth: {
        hasSession: !!session,
        user: session?.user || null
      },
      complexAuth: {
        hasSession: !!complexSession,
        user: complexSession?.user || null
      },
      suggestion: 'If complex auth fails but you need login, we can temporarily simplify the auth flow',
      nextStep: 'Check Vercel logs for "SignIn callback triggered" messages',
      timestamp: new Date().toISOString()
    })
  }
)
