import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { getTopTrades, resolveTickerNames } from '@/lib/rss-combiner'
import Parser from 'rss-parser'

const parser = new Parser({
  customFields: { item: ['source'] },
})

function extractSourceName(item: any): string {
  if (item.source && typeof item.source === 'string') return item.source
  if (item.source?._) return item.source._
  const title = item.title || ''
  const dashIdx = title.lastIndexOf(' - ')
  if (dashIdx > 0) return title.substring(dashIdx + 3).trim()
  return ''
}

/**
 * Fetches a sample of feed URLs (up to 5) and extracts unique publisher names.
 * Used to populate the excluded sources autocomplete.
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/known-sources' },
  async () => {
    const { data: settings } = await supabaseAdmin
      .from('combined_feed_settings')
      .select('url_template, max_trades')
      .limit(1)
      .single()

    const maxTrades = settings?.max_trades ?? 21
    const urlTemplate =
      settings?.url_template ??
      'https://news.google.com/rss/search?q={company_name}+stock&hl=en-US&gl=US&ceid=US:en'

    // Get top trades, take a sample of up to 5
    const trades = await getTopTrades(Math.min(maxTrades, 5))
    const tradesWithNames = await resolveTickerNames(trades)

    const urls = tradesWithNames.map((t) =>
      urlTemplate.replace('{company_name}', encodeURIComponent(t.company_name))
    )

    const sourceNames = new Set<string>()

    const results = await Promise.allSettled(
      urls.map(async (url) => {
        const feed = await parser.parseURL(url)
        for (const item of feed.items) {
          const name = extractSourceName(item)
          if (name) sourceNames.add(name)
        }
      })
    )

    for (const r of results) {
      if (r.status === 'rejected') {
        console.error('[RSS-Combiner] Known sources fetch failed:', r.reason?.message)
      }
    }

    return NextResponse.json({
      sources: Array.from(sourceNames).sort(),
    })
  }
)
