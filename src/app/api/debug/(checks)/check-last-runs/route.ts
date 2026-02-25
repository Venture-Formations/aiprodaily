import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-last-runs' },
  async ({ request, logger }) => {
    // Get all last run settings
    const { data: lastRuns } = await supabaseAdmin
      .from('app_settings')
      .select('key, value, updated_at')
      .in('key', [
        'last_rss_processing_run',
        'last_issue_creation_run',
        'last_final_send_run',
        'last_subject_generation_run'
      ])
      .order('key')

    // Also get recent issues to compare
    const { data: recentCampaigns } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, created_at, status')
      .order('created_at', { ascending: false })
      .limit(5)

    return NextResponse.json({
      success: true,
      lastRuns,
      recentCampaigns,
      currentDate: new Date().toISOString().split('T')[0],
      currentTime: new Date().toISOString()
    })
  }
)
