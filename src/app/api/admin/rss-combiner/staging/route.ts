import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { invalidateTradesCache } from '@/lib/rss-combiner'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/staging' },
  async () => {
    const [{ count }, { data: settings }] = await Promise.all([
      supabaseAdmin
        .from('congress_trades_staged')
        .select('id', { count: 'exact', head: true }),
      supabaseAdmin
        .from('combined_feed_settings')
        .select('staged_upload_at, upload_schedule_day, upload_schedule_time')
        .limit(1)
        .single(),
    ])

    return NextResponse.json({
      count: count ?? 0,
      staged_upload_at: settings?.staged_upload_at ?? null,
      upload_schedule_day: settings?.upload_schedule_day ?? 2,
      upload_schedule_time: settings?.upload_schedule_time ?? '09:00',
    })
  }
)

export const DELETE = withApiHandler(
  { authTier: 'admin', logContext: 'rss-combiner/staging' },
  async ({ logger }) => {
    const { error } = await supabaseAdmin
      .from('congress_trades_staged')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000')

    if (error) {
      logger.error({ err: error }, 'Failed to discard staged data')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabaseAdmin
      .from('combined_feed_settings')
      .update({ staged_upload_at: null, updated_at: new Date().toISOString() })
      .not('id', 'is', null)

    invalidateTradesCache()

    return NextResponse.json({ discarded: true })
  }
)
