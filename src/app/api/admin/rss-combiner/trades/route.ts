import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { getTopTrades, resolveTickerNames, getTradeStats, getCachedTradesResponse, setCachedTradesResponse } from '@/lib/rss-combiner'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/trades' },
  async ({ request }: { request: NextRequest }) => {
    // Return cached result if available
    const cached = getCachedTradesResponse()
    if (cached) {
      return NextResponse.json(cached)
    }

    // Load settings for max_trades
    const { data: settings } = await supabaseAdmin
      .from('combined_feed_settings')
      .select('max_trades')
      .limit(1)
      .single()

    const maxTrades = settings?.max_trades ?? 21

    const trades = await getTopTrades(maxTrades)
    const tradesWithNames = await resolveTickerNames(trades)
    const { totalTrades, uniqueTickers } = await getTradeStats()

    const response = {
      trades: tradesWithNames,
      stats: {
        totalTrades,
        uniqueTickers,
        selectedForFeed: tradesWithNames.length,
      },
    }

    setCachedTradesResponse(response)

    return NextResponse.json(response)
  }
)
