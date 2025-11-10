import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get the most recent campaign
    const { data: recentCampaigns } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3)

    if (!recentCampaigns || recentCampaigns.length === 0) {
      return NextResponse.json({ error: 'No campaigns found' })
    }

    const latestCampaign = recentCampaigns[0]

    // Check for articles
    const { data: articles, count: articleCount } = await supabaseAdmin
      .from('articles')
      .select('*', { count: 'exact' })
      .eq('campaign_id', latestCampaign.id)

    // Check for RSS posts
    const { data: rssPosts, count: rssPostCount } = await supabaseAdmin
      .from('rss_posts')
      .select('*', { count: 'exact' })
      .eq('campaign_id', latestCampaign.id)

    // Check for prompt selection
    const { data: promptSelection } = await supabaseAdmin
      .from('campaign_prompts')
      .select('*, prompt:prompt_ideas(*)')
      .eq('campaign_id', latestCampaign.id)
      .single()

    // Check for AI app selections
    const { data: appSelections, count: appCount } = await supabaseAdmin
      .from('campaign_ai_app_selections')
      .select('*, app:ai_applications(*)', { count: 'exact' })
      .eq('campaign_id', latestCampaign.id)

    // Check system logs for this campaign
    const { data: logs } = await supabaseAdmin
      .from('system_logs')
      .select('*')
      .or(`context->>campaignId.eq.${latestCampaign.id},message.ilike.%${latestCampaign.id}%`)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      latestCampaign: {
        id: latestCampaign.id,
        date: latestCampaign.date,
        status: latestCampaign.status,
        subject_line: latestCampaign.subject_line,
        created_at: latestCampaign.created_at,
        updated_at: latestCampaign.updated_at
      },
      articleCount: articleCount || 0,
      rssPostCount: rssPostCount || 0,
      appCount: appCount || 0,
      hasPrompt: !!promptSelection,
      promptTitle: promptSelection?.prompt?.title,
      recentCampaigns: recentCampaigns.map(c => ({
        id: c.id,
        date: c.date,
        status: c.status,
        created_at: c.created_at
      })),
      sampleArticles: articles?.slice(0, 3).map(a => ({
        id: a.id,
        headline: a.headline,
        is_active: a.is_active,
        rank: a.rank
      })),
      sampleRssPosts: rssPosts?.slice(0, 3).map(p => ({
        id: p.id,
        title: p.title,
        source_feed: p.source_feed
      })),
      logs: logs?.map(l => ({
        level: l.level,
        message: l.message,
        created_at: l.created_at,
        context: l.context
      }))
    })

  } catch (error) {
    console.error('Error checking latest RSS run:', error)
    return NextResponse.json({
      error: 'Failed to check latest RSS run',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
