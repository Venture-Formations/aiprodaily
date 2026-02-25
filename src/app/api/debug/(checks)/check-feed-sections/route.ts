import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-feed-sections' },
  async () => {
    const { data: feeds, error } = await supabaseAdmin
      .from('rss_feeds')
      .select('id, name, url, active, use_for_primary_section, use_for_secondary_section')
      .order('name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const primaryFeeds = feeds?.filter(f => f.use_for_primary_section) || []
    const secondaryFeeds = feeds?.filter(f => f.use_for_secondary_section) || []

    return NextResponse.json({
      success: true,
      total_feeds: feeds?.length || 0,
      primary_feeds: primaryFeeds.length,
      secondary_feeds: secondaryFeeds.length,
      feeds: feeds,
      primary_feed_list: primaryFeeds.map(f => ({ id: f.id, name: f.name })),
      secondary_feed_list: secondaryFeeds.map(f => ({ id: f.id, name: f.name }))
    })
  }
)
