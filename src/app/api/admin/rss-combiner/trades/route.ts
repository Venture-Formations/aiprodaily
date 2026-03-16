import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { getTopTrades, resolveTickerNames, getTradeStats } from '@/lib/rss-combiner'
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
    const { totalTrades, uniqueTickers } = await getTradeStats()

    return NextResponse.json({
      trades: tradesWithNames,
      stats: {
        totalTrades,
        uniqueTickers,
        selectedForFeed: tradesWithNames.length,
      },
    })
  }
)
