import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get latest campaign
    const { data: campaigns } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, created_at')
      .order('created_at', { ascending: false })
      .limit(1)

    const campaignId = campaigns?.[0]?.id

    // Get recent system logs related to RSS processing
    const { data: logs, error } = await supabaseAdmin
      .from('system_logs')
      .select('*')
      .eq('source', 'rss_processor')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filter logs for the latest campaign if available
    const campaignLogs = campaignId
      ? logs?.filter(log => log.context?.campaignId === campaignId || log.context?.postId)
      : logs

    return NextResponse.json({
      success: true,
      latest_campaign: campaigns?.[0],
      total_logs: logs?.length || 0,
      campaign_logs: campaignLogs?.length || 0,
      recent_logs: logs?.slice(0, 20).map(log => ({
        level: log.level,
        message: log.message,
        context: log.context,
        created_at: log.created_at
      }))
    })

  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
