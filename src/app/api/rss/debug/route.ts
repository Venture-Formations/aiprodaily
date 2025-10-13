import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import Parser from 'rss-parser'

const parser = new Parser({
  customFields: {
    item: ['media:content', 'enclosure']
  }
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get RSS feeds
    const { data: feeds, error: feedsError } = await supabaseAdmin
      .from('rss_feeds')
      .select('*')
      .eq('active', true)

    if (feedsError) {
      throw new Error(`Failed to fetch feeds: ${feedsError.message}`)
    }

    const results = []

    for (const feed of feeds || []) {
      try {
        const rssFeed = await parser.parseURL(feed.url)
        const now = new Date()
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        const allItems = rssFeed.items.length
        const recentItems = rssFeed.items.filter(item => {
          if (!item.pubDate) return false
          const pubDate = new Date(item.pubDate)
          return pubDate >= yesterday && pubDate <= now
        }).length

        const weekItems = rssFeed.items.filter(item => {
          if (!item.pubDate) return false
          const pubDate = new Date(item.pubDate)
          return pubDate >= lastWeek && pubDate <= now
        }).length

        const sampleItems = rssFeed.items.slice(0, 3).map(item => ({
          title: item.title,
          pubDate: item.pubDate,
          link: item.link
        }))

        results.push({
          feed: {
            name: feed.name,
            url: feed.url
          },
          stats: {
            totalItems: allItems,
            last24Hours: recentItems,
            lastWeek: weekItems
          },
          sampleItems
        })
      } catch (error) {
        results.push({
          feed: {
            name: feed.name,
            url: feed.url
          },
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    })

  } catch (error) {
    console.error('RSS debug failed:', error)
    return NextResponse.json({
      error: 'RSS debug failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}