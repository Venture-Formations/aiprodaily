import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Returns tickers from congress_trades that don't have a mapping in ticker_company_names.
 * Used by the dashboard to flag tickers that need names confirmed.
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/ticker-db/unknown' },
  async () => {
    // Get unique tickers from trades
    const { data: tradeRows, error: tradeError } = await supabaseAdmin
      .from('congress_trades')
      .select('ticker, company')

    if (tradeError) {
      return NextResponse.json({ error: tradeError.message }, { status: 500 })
    }

    if (!tradeRows || tradeRows.length === 0) {
      return NextResponse.json({ unknown: [] })
    }

    // Deduplicate by uppercase ticker, keep the company name from the first occurrence
    const tickerMap = new Map<string, string>()
    for (const row of tradeRows) {
      const upper = row.ticker.toUpperCase()
      if (!tickerMap.has(upper)) {
        tickerMap.set(upper, row.company || row.ticker)
      }
    }

    // Get all known tickers
    const { data: knownRows } = await supabaseAdmin
      .from('ticker_company_names')
      .select('ticker')

    const knownSet = new Set(
      (knownRows || []).map((r: { ticker: string }) => r.ticker.toUpperCase())
    )

    // Find unknown tickers
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
