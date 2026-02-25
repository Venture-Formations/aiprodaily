import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import Parser from 'rss-parser'

const parser = new Parser({
  customFields: {
    item: ['media:content', 'enclosure']
  }
})

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(tests)/test-rss-feeds' },
  async ({ logger }) => {
  try {
    console.log('Testing all RSS feeds...')

    // Get all active RSS feeds
    const { data: feeds, error: feedsError } = await supabaseAdmin
      .from('rss_feeds')
      .select('*')
      .eq('active', true)
      .order('name')

    if (feedsError) {
      return NextResponse.json({
        error: 'Failed to fetch feeds',
        details: feedsError
      }, { status: 500 })
    }

    if (!feeds || feeds.length === 0) {
      return NextResponse.json({
        message: 'No active RSS feeds found',
        feeds: []
      })
    }

    const results = []

    for (const feed of feeds) {
      console.log(`Testing feed: ${feed.name} (${feed.url})`)

      const feedResult: any = {
        id: feed.id,
        name: feed.name,
        url: feed.url,
        use_for_primary_section: feed.use_for_primary_section,
        use_for_secondary_section: feed.use_for_secondary_section,
        status: 'unknown',
        error: null,
        items_count: 0
      }

      try {
        const rssFeed = await parser.parseURL(feed.url)
        feedResult.status = 'success'
        feedResult.items_count = rssFeed.items?.length || 0
        feedResult.feed_title = rssFeed.title
        console.log(`✅ Success: ${feed.name} - ${feedResult.items_count} items`)
      } catch (error) {
        feedResult.status = 'failed'
        feedResult.error = error instanceof Error ? error.message : String(error)
        console.error(`❌ Failed: ${feed.name} - ${feedResult.error}`)

        // Check for specific HTTP errors
        if (feedResult.error.includes('405')) {
          feedResult.error_type = 'HTTP 405 - Method Not Allowed'
          feedResult.suggestion = 'This feed URL does not accept the HTTP method used. The feed may be misconfigured or the URL may be incorrect.'
        } else if (feedResult.error.includes('404')) {
          feedResult.error_type = 'HTTP 404 - Not Found'
          feedResult.suggestion = 'The feed URL does not exist. Check if the URL is correct.'
        } else if (feedResult.error.includes('timeout')) {
          feedResult.error_type = 'Timeout'
          feedResult.suggestion = 'The feed took too long to respond. The server may be slow or down.'
        } else {
          feedResult.error_type = 'Unknown'
          feedResult.suggestion = 'Check the feed URL and try accessing it in a browser.'
        }
      }

      results.push(feedResult)
    }

    const successCount = results.filter(r => r.status === 'success').length
    const failedCount = results.filter(r => r.status === 'failed').length

    return NextResponse.json({
      summary: {
        total_feeds: feeds.length,
        successful: successCount,
        failed: failedCount
      },
      feeds: results,
      failed_feeds: results.filter(r => r.status === 'failed')
    })

  } catch (error: any) {
    console.error('Error testing RSS feeds:', error)
    return NextResponse.json({
      error: 'Failed to test RSS feeds',
      details: error.message
    }, { status: 500 })
  }
  }
)
