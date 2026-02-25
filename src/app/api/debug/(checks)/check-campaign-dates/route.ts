import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-campaign-dates' },
  async ({ logger }) => {
    const { data: campaigns, error } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, created_at, status')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      throw error
    }

    return NextResponse.json({
      issues: campaigns?.map(c => ({
        id: c.id,
        date: c.date,
        created_at: c.created_at,
        status: c.status,
        dates_match: c.date === c.created_at?.split('T')[0]
      }))
    })
  }
)
