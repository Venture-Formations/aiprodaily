import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-feed-names' },
  async () => {
    // Get all RSS feeds
    const { data: feeds, error: feedsError } = await supabaseAdmin
      .from('rss_feeds')
      .select('id, name, active, url')
      .order('name')

    if (feedsError) {
      console.error('Feeds query error:', feedsError)
      throw feedsError
    }

    return NextResponse.json({
      success: true,
      feeds: feeds || [],
      message: `Found ${feeds?.length || 0} RSS feeds`
    })
  }
)
