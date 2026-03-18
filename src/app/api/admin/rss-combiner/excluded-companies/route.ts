import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'
import { invalidateCache, invalidateTradesCache } from '@/lib/rss-combiner'

const COLUMNS = 'id, ticker, company_name, created_at' as const

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/excluded-companies' },
  async () => {
    const { data, error } = await supabaseAdmin
      .from('combined_feed_excluded_companies')
      .select(COLUMNS)
      .order('ticker')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ companies: data })
  }
)

const postSchema = z.object({
  ticker: z.string().min(1).max(20).transform((v) => v.toUpperCase().trim()),
  company_name: z.string().max(500).optional(),
})

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/excluded-companies', inputSchema: postSchema },
  async ({ input }) => {
    const { data, error } = await supabaseAdmin
      .from('combined_feed_excluded_companies')
      .insert({ ticker: input.ticker, company_name: input.company_name || null })
      .select(COLUMNS)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ticker already excluded' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    invalidateCache()
    invalidateTradesCache()
    return NextResponse.json({ company: data })
  }
)

const deleteSchema = z.object({
  id: z.string().uuid(),
})

export const DELETE = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/excluded-companies', inputSchema: deleteSchema },
  async ({ input }) => {
    const { error } = await supabaseAdmin
      .from('combined_feed_excluded_companies')
      .delete()
      .eq('id', input.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    invalidateCache()
    invalidateTradesCache()
    return NextResponse.json({ success: true })
  }
)
