import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'
import { invalidateCache } from '@/lib/rss-combiner'

const SETTINGS_COLUMNS = 'id, max_age_days, cache_ttl_minutes, feed_title, url_template, max_trades, updated_at' as const

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/settings' },
  async () => {
    const { data, error } = await supabaseAdmin
      .from('combined_feed_settings')
      .select(SETTINGS_COLUMNS)
      .limit(1)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ settings: data })
  }
)

const patchSchema = z.object({
  max_age_days: z.number().int().min(1).max(90).optional(),
  cache_ttl_minutes: z.number().int().min(1).max(1440).optional(),
  feed_title: z.string().min(1).max(200).optional(),
  url_template: z.string().min(1).max(2000).optional(),
  max_trades: z.number().int().min(1).max(200).optional(),
})

export const PATCH = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/settings', inputSchema: patchSchema },
  async ({ input }) => {
    // Get the settings row ID first (single-row table)
    const { data: existing } = await supabaseAdmin
      .from('combined_feed_settings')
      .select('id')
      .limit(1)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Settings row not found' }, { status: 404 })
    }

    const { data, error } = await supabaseAdmin
      .from('combined_feed_settings')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select(SETTINGS_COLUMNS)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    invalidateCache()

    return NextResponse.json({ settings: data })
  }
)
