import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { getTopTrades, resolveTickerNames } from '@/lib/rss-combiner'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/trades' },
  async ({ request }: { request: NextRequest }) => {
    // Load settings for max_trades
    const { data: settings } = await supabaseAdmin
      .from('combined_feed_settings')
      .select('max_trades')
      .limit(1)
      .single()

    const maxTrades = settings?.max_trades ?? 21

    const trades = await getTopTrades(maxTrades)
    const tradesWithNames = await resolveTickerNames(trades)

    // Also get total trade count and unique ticker count for stats
    const { count: totalTrades } = await supabaseAdmin
      .from('congress_trades')
      .select('id', { count: 'exact', head: true })

    // Count unique tickers
    const { data: allTickers } = await supabaseAdmin
      .from('congress_trades')
      .select('ticker')

    const uniqueTickers = new Set(
      (allTickers || []).map((r) => r.ticker.toUpperCase())
    ).size

    return NextResponse.json({
      trades: tradesWithNames,
      stats: {
        totalTrades: totalTrades ?? 0,
        uniqueTickers,
        selectedForFeed: tradesWithNames.length,
      },
    })
  }
)
