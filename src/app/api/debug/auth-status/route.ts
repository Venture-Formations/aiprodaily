import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({
        authenticated: false,
        session: null,
        message: 'No session found'
      })
    }

    // Check if user exists in Supabase auth
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
    const authUser = authUsers.users.find(u => u.email === session.user.email)

    // Check if user exists in users table
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .single()

    return NextResponse.json({
      authenticated: true,
      session: {
        user: session.user,
        expires: session.expires
      },
      authUser: {
        exists: !!authUser,
        id: authUser?.id,
        email: authUser?.email,
        created_at: authUser?.created_at
      },
      dbUser: {
        exists: !!dbUser,
        data: dbUser,
        error: dbError?.message
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Auth status check error:', error)
    return NextResponse.json({
      error: 'Failed to check auth status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}