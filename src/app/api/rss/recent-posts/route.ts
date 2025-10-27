import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    console.log('[API] Session check:', session ? 'Authenticated' : 'Not authenticated')

    if (!session) {
      console.log('[API] No session found, returning 401')
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const newsletterId = searchParams.get('newsletter_id')
    const limit = parseInt(searchParams.get('limit') || '50')

    console.log('[API] Fetching posts for newsletter:', newsletterId, 'limit:', limit)

    if (!newsletterId) {
      return NextResponse.json(
        { error: 'Missing newsletter_id parameter' },
        { status: 400 }
      )
    }

    // First get recent campaigns for this newsletter
    const { data: campaigns, error: campaignsError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id')
      .eq('newsletter_id', newsletterId)
      .order('date', { ascending: false })
      .limit(10) // Get last 10 campaigns

    if (campaignsError) {
      console.error('[API] Error fetching campaigns:', campaignsError)
      return NextResponse.json(
        { error: 'Failed to fetch campaigns', details: campaignsError.message },
        { status: 500 }
      )
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('[API] No campaigns found for newsletter:', newsletterId)
      return NextResponse.json({
        success: true,
        posts: [],
        count: 0
      })
    }

    const campaignIds = campaigns.map(c => c.id)

    // Fetch recent RSS posts from these campaigns
    const { data: posts, error } = await supabaseAdmin
      .from('rss_posts')
      .select('id, title, description, full_article_text, source_url, publication_date')
      .in('campaign_id', campaignIds)
      .order('publication_date', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[API] Error fetching recent posts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch recent posts', details: error.message },
        { status: 500 }
      )
    }

    console.log('[API] Found', posts?.length || 0, 'posts')

    return NextResponse.json({
      success: true,
      posts: posts || [],
      count: posts?.length || 0
    })
  } catch (error) {
    console.error('[API] Error in recent-posts:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch recent posts',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
