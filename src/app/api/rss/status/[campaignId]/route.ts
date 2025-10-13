import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

interface RouteParams {
  params: Promise<{
    campaignId: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { campaignId } = await params

    // Get campaign info
    const { data: campaign } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get articles count
    const { data: articles } = await supabaseAdmin
      .from('articles')
      .select('id')
      .eq('campaign_id', campaignId)

    // Get RSS posts count
    const { data: posts } = await supabaseAdmin
      .from('rss_posts')
      .select('id')
      .eq('campaign_id', campaignId)

    // Get recent system logs for this campaign
    const { data: logs } = await supabaseAdmin
      .from('system_logs')
      .select('*')
      .eq('source', 'rss_processor')
      .gte('timestamp', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
      .order('timestamp', { ascending: false })
      .limit(10)

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        status: campaign.status,
        date: campaign.date
      },
      counts: {
        articles: articles?.length || 0,
        posts: posts?.length || 0
      },
      recentLogs: logs || []
    })

  } catch (error) {
    console.error('Failed to get RSS status:', error)
    return NextResponse.json({
      error: 'Failed to get RSS status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}