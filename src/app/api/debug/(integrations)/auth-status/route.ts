import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(integrations)/auth-status' },
  async ({ session, logger }) => {
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
  }
)
