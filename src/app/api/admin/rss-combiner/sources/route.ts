import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'

const SOURCES_COLUMNS = 'id, url, label, is_active, is_excluded, created_at, updated_at' as const

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/sources' },
  async () => {
    const { data, error } = await supabaseAdmin
      .from('combined_feed_sources')
      .select(SOURCES_COLUMNS)
      .order('label')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ sources: data })
  }
)

const patchSchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean().optional(),
  is_excluded: z.boolean().optional(),
})

export const PATCH = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/sources', inputSchema: patchSchema },
  async ({ input }) => {
    const { id, ...updates } = input

    const { data, error } = await supabaseAdmin
      .from('combined_feed_sources')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(SOURCES_COLUMNS)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ source: data })
  }
)
