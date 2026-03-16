import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'
import { invalidateCache } from '@/lib/rss-combiner'

const COLUMNS = 'id, ticker, company_name, created_at' as const

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/ticker-db' },
  async () => {
    const PAGE_SIZE = 1000
    const allTickers: any[] = []
    let offset = 0

    while (true) {
      const { data, error } = await supabaseAdmin
        .from('ticker_company_names')
        .select(COLUMNS)
        .order('ticker')
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (!data || data.length === 0) break
      allTickers.push(...data)
      if (data.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }

    return NextResponse.json({ tickers: allTickers })
  }
)

const postSchema = z.object({
  ticker: z.string().min(1).max(20).transform((v) => v.toUpperCase().trim()),
  company_name: z.string().min(1).max(500),
})

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/ticker-db', inputSchema: postSchema },
  async ({ input }) => {
    const { data, error } = await supabaseAdmin
      .from('ticker_company_names')
      .upsert(
        { ticker: input.ticker, company_name: input.company_name, updated_at: new Date().toISOString() },
        { onConflict: 'ticker' }
      )
      .select(COLUMNS)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    invalidateCache()
    return NextResponse.json({ ticker: data })
  }
)

const deleteSchema = z.object({
  id: z.string().uuid(),
})

export const DELETE = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/ticker-db', inputSchema: deleteSchema },
  async ({ input }) => {
    const { error } = await supabaseAdmin
      .from('ticker_company_names')
      .delete()
      .eq('id', input.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    invalidateCache()
    return NextResponse.json({ success: true })
  }
)
