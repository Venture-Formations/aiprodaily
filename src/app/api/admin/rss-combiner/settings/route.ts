import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'
import { invalidateCache, invalidateTradesCache } from '@/lib/rss-combiner'

const SETTINGS_COLUMNS = 'id, max_age_days, cache_ttl_minutes, feed_title, url_template, sale_url_template, purchase_url_template, max_trades, max_articles_per_trade, last_ingestion_at, updated_at, upload_schedule_day, upload_schedule_time, staged_upload_at, last_activation_at, trade_freshness_days, max_trades_per_member, feed_article_age_days, min_articles_per_company' as const

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
  sale_url_template: z.string().max(2000).optional(),
  purchase_url_template: z.string().max(2000).optional(),
  max_trades: z.number().int().min(1).max(200).optional(),
  max_articles_per_trade: z.number().int().min(1).max(100).optional(),
  upload_schedule_day: z.number().int().min(0).max(6).optional(),
  upload_schedule_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  trade_freshness_days: z.number().int().min(1).max(90).optional(),
  max_trades_per_member: z.number().int().min(1).max(50).optional(),
  feed_article_age_days: z.number().int().min(1).max(90).optional(),
  min_articles_per_company: z.number().int().min(1).max(20).optional(),
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
    invalidateTradesCache()

    return NextResponse.json({ settings: data })
  }
)
