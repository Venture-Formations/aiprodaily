import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get the most recent issue
    const { data: recentCampaigns } = await supabaseAdmin
      .from('publication_issues')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3)

    if (!recentCampaigns || recentCampaigns.length === 0) {
      return NextResponse.json({ error: 'No issues found' })
    }

    const latestissue = recentCampaigns[0]

    // Check for articles
    const { data: articles, count: articleCount } = await supabaseAdmin
      .from('articles')
      .select('*', { count: 'exact' })
      .eq('issue_id', latestissue.id)

    // Check for RSS posts
    const { data: rssPosts, count: rssPostCount } = await supabaseAdmin
      .from('rss_posts')
      .select('*', { count: 'exact' })
      .eq('issue_id', latestissue.id)

    // Check for prompt selection
    const { data: promptSelection } = await supabaseAdmin
      .from('issue_prompt_selections')
      .select('*, prompt:prompt_ideas(*)')
      .eq('issue_id', latestissue.id)
      .single()

    // Check for AI app selections
    const { data: appSelections, count: appCount } = await supabaseAdmin
      .from('issue_ai_app_selections')
      .select('*, app:ai_applications(*)', { count: 'exact' })
      .eq('issue_id', latestissue.id)

    // Check system logs for this issue
    const { data: logs } = await supabaseAdmin
      .from('system_logs')
      .select('*')
      .or(`context->>issueId.eq.${latestissue.id},message.ilike.%${latestissue.id}%`)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      latestissue: {
        id: latestissue.id,
        date: latestissue.date,
        status: latestissue.status,
        subject_line: latestissue.subject_line,
        created_at: latestissue.created_at,
        updated_at: latestissue.updated_at
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
