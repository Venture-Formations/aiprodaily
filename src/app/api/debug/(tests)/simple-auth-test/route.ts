import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Simple auth options without Supabase complexity
const simpleAuthOptions = {
  providers: [
    {
      id: 'google',
      name: 'Google',
      type: 'oauth',
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }
  ],
  callbacks: {
    async signIn() {
      console.log('Simple signIn - always return true')
      return true
    },
    async jwt({ token, user }: any) {
      console.log('Simple JWT callback', { user: user?.email })
      return token
    },
    async session({ session, token }: any) {
      console.log('Simple session callback', { email: session?.user?.email })
      return session
    }
  },
  session: { strategy: 'jwt' as const },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error'
  }
}

export async function GET(request: NextRequest) {
  try {
    // Test both complex and simple auth
    const complexSession = await getServerSession(authOptions)

    return NextResponse.json({
      test: 'Simple Auth Test',
      complexAuth: {
        hasSession: !!complexSession,
        user: complexSession?.user || null
      },
      suggestion: 'If complex auth fails but you need login, we can temporarily simplify the auth flow',
      nextStep: 'Check Vercel logs for "SignIn callback triggered" messages',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Auth test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}