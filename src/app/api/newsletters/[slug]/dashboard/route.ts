import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type RouteParams = Promise<{ slug: string }>

/**
 * GET /api/newsletters/[slug]/dashboard
 * Fetch dashboard statistics for a specific newsletter
 */
export async function GET(
  request: NextRequest,
  segmentData: { params: RouteParams }
) {
  try {
    const params = await segmentData.params
    const { slug } = params

    // Get newsletter
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('newsletters')
      .select('*')
      .eq('slug', slug)
      .single()

    if (newsletterError || !newsletter) {
      return NextResponse.json(
        { success: false, error: 'Newsletter not found' },
        { status: 404 }
      )
    }

    // Get campaign counts by status
    const { data: campaigns } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, status, date, subject_line, created_at')
      .eq('newsletter_id', newsletter.id)
      .order('created_at', { ascending: false })

    const campaignCounts = {
      draft: campaigns?.filter(c => c.status === 'draft').length || 0,
      in_review: campaigns?.filter(c => c.status === 'in_review').length || 0,
      ready_to_send: campaigns?.filter(c => c.status === 'ready_to_send').length || 0,
      sent: campaigns?.filter(c => c.status === 'sent').length || 0,
      total: campaigns?.length || 0
    }

    // Get AI applications count
    const { data: aiApps, count: aiAppsCount } = await supabaseAdmin
      .from('ai_applications')
      .select('id, app_name, category, is_active, times_used, created_at', { count: 'exact' })
      .eq('newsletter_id', newsletter.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5)

    // Get prompt ideas count
    const { data: prompts, count: promptsCount } = await supabaseAdmin
      .from('prompt_ideas')
      .select('id, title, category, is_active, times_used, created_at', { count: 'exact' })
      .eq('newsletter_id', newsletter.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5)

    // Get recent campaigns with article counts
    const recentCampaigns = await Promise.all(
      (campaigns?.slice(0, 5) || []).map(async (campaign) => {
        const { count: articleCount } = await supabaseAdmin
          .from('articles')
          .select('id', { count: 'exact' })
          .eq('campaign_id', campaign.id)

        return {
          ...campaign,
          article_count: articleCount || 0
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        newsletter,
        campaign_counts: campaignCounts,
        ai_apps: {
          total: aiAppsCount || 0,
          recent: aiApps || []
        },
        prompts: {
          total: promptsCount || 0,
          recent: prompts || []
        },
        recent_campaigns: recentCampaigns
      }
    })

  } catch (error: any) {
    console.error('Failed to fetch dashboard data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard data', details: error.message },
      { status: 500 }
    )
  }
}
