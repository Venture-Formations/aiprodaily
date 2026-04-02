import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { getTopTrades } from '@/lib/rss-combiner'

/**
 * Returns tickers from the top selected trades that don't have a mapping in ticker_company_names.
 * Only checks trades that would actually be used in the feed (respects freshness + exclusions).
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/ticker-db/unknown' },
  async () => {
    // Load settings for max_trades and freshness
    const { data: settings } = await supabaseAdmin
      .from('combined_feed_settings')
      .select('max_trades, trade_freshness_days')
      .limit(1)
      .single()

    const maxTrades = settings?.max_trades ?? 21
    const tradeFreshnessDays = settings?.trade_freshness_days ?? 7

    // Get the top trades that would actually be selected for the feed
    let topTrades = await getTopTrades(maxTrades, tradeFreshnessDays)

    // If freshness filter returns nothing (e.g. stale data before re-upload), fall back without freshness
    if (topTrades.length === 0) {
      topTrades = await getTopTrades(maxTrades)
    }

    if (topTrades.length === 0) {
      return NextResponse.json({ unknown: [] })
    }

    // Build ticker → raw company map from the selected trades
    const tickerMap = new Map<string, string>()
    for (const trade of topTrades) {
      const upper = trade.ticker.toUpperCase()
      if (!tickerMap.has(upper)) {
        tickerMap.set(upper, trade.company || trade.ticker)
      }
    }

    // Check only the tickers we care about (avoids Supabase default 1000-row limit on full table scan)
    const tickersToCheck = Array.from(tickerMap.keys())
    const { data: knownRows } = await supabaseAdmin
      .from('ticker_company_names')
      .select('ticker')
      .in('ticker', tickersToCheck)

    const knownSet = new Set(
      (knownRows || []).map((r: { ticker: string }) => r.ticker.toUpperCase())
    )

    // Find unknown tickers (in top trades but not in ticker_company_names)
    const unknown: { ticker: string; raw_company: string }[] = []
    tickerMap.forEach((company, ticker) => {
      if (!knownSet.has(ticker)) {
        unknown.push({ ticker, raw_company: company })
      }
    })

    // Sort alphabetically
    unknown.sort((a, b) => a.ticker.localeCompare(b.ticker))

    return NextResponse.json({ unknown })
  }
)
