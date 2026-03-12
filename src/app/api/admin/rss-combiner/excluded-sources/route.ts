import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'
import { invalidateCache } from '@/lib/rss-combiner'

const COLUMNS = 'id, source_name, created_at' as const

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/excluded-sources' },
  async () => {
    const { data, error } = await supabaseAdmin
      .from('combined_feed_excluded_sources')
      .select(COLUMNS)
      .order('source_name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ excludedSources: data })
  }
)

const postSchema = z.object({
  source_name: z.string().min(1).max(200),
})

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/excluded-sources', inputSchema: postSchema },
  async ({ input }) => {
    const { data, error } = await supabaseAdmin
      .from('combined_feed_excluded_sources')
      .insert({ source_name: input.source_name })
      .select(COLUMNS)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Source already excluded' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    invalidateCache()
    return NextResponse.json({ excludedSource: data })
  }
)

const deleteSchema = z.object({
  id: z.string().uuid(),
})

export const DELETE = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/excluded-sources', inputSchema: deleteSchema },
  async ({ input }) => {
    const { error } = await supabaseAdmin
      .from('combined_feed_excluded_sources')
      .delete()
      .eq('id', input.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    invalidateCache()
    return NextResponse.json({ success: true })
  }
)
