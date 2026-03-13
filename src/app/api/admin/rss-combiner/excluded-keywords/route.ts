import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'
import { invalidateCache } from '@/lib/rss-combiner'

const COLUMNS = 'id, keyword, created_at' as const

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/excluded-keywords' },
  async () => {
    const { data, error } = await supabaseAdmin
      .from('combined_feed_excluded_keywords')
      .select(COLUMNS)
      .order('keyword')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ keywords: data })
  }
)

const postSchema = z.object({
  keyword: z.string().min(1).max(200).transform((v) => v.trim()),
})

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/excluded-keywords', inputSchema: postSchema },
  async ({ input }) => {
    const { data, error } = await supabaseAdmin
      .from('combined_feed_excluded_keywords')
      .insert({ keyword: input.keyword })
      .select(COLUMNS)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Keyword already excluded' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    invalidateCache()
    return NextResponse.json({ keyword: data })
  }
)

const deleteSchema = z.object({
  id: z.string().uuid(),
})

export const DELETE = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/excluded-keywords', inputSchema: deleteSchema },
  async ({ input }) => {
    const { error } = await supabaseAdmin
      .from('combined_feed_excluded_keywords')
      .delete()
      .eq('id', input.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    invalidateCache()
    return NextResponse.json({ success: true })
  }
)
