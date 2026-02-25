import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-newsletters' },
  async ({ request, logger }) => {
    const { data: newsletters, error } = await supabaseAdmin
      .from('publications')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count: newsletters?.length || 0,
      newsletters: newsletters || []
    })
  }
)
