import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-campaign-ids' },
  async ({ request, logger }) => {
    const issueIds = [
      'bd08af8d-e2c1-40e3-bf94-bd4af912639e',
      'c8750496-9cf2-4f68-85fe-86dae32f226a'
    ]

    const { data: campaigns, error } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, status, created_at, subject_line')
      .in('id', issueIds)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also check all campaigns for today
    const today = new Date().toISOString().split('T')[0]
    const { data: todaysCampaigns } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, status, created_at, subject_line')
      .gte('created_at', today + 'T00:00:00')
      .order('created_at', { ascending: false })

    return NextResponse.json({
      specificCampaigns: campaigns || [],
      foundCount: campaigns?.length || 0,
      allCampaignsCreatedToday: todaysCampaigns || [],
      todaysCampaignsCount: todaysCampaigns?.length || 0
    })
  }
)
