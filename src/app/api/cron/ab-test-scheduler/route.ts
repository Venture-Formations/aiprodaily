import { withApiHandler } from '@/lib/api-handler'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Auto-start tests whose start_date has passed, and auto-end tests whose
 * end_date has passed. Respects the single-active-test-per-publication
 * constraint by skipping starts when another test is already active.
 *
 * Manual start/end from the dashboard continues to work independently.
 */
export const POST = withApiHandler(
  { authTier: 'system', logContext: 'ab-test-scheduler' },
  async ({ logger }) => {
    const now = new Date().toISOString()
    let startedCount = 0
    let endedCount = 0

    // 1. End tests past their end_date
    {
      const { data: toEnd } = await supabaseAdmin
        .from('subscribe_ab_tests')
        .select('id, publication_id, name, end_date')
        .eq('status', 'active')
        .not('end_date', 'is', null)
        .lte('end_date', now)

      for (const t of toEnd || []) {
        const { error } = await supabaseAdmin
          .from('subscribe_ab_tests')
          .update({ status: 'ended', ended_at: now, updated_at: now })
          .eq('id', t.id)
          .eq('status', 'active') // guard against races
        if (error) {
          logger.error({ err: error, testId: t.id }, 'Failed to end test')
        } else {
          endedCount++
          logger.info({ testId: t.id, pubId: t.publication_id, name: t.name }, 'Auto-ended test')
        }
      }
    }

    // 2. Start draft tests past their start_date (only if no active test for that pub)
    {
      const { data: toStart } = await supabaseAdmin
        .from('subscribe_ab_tests')
        .select('id, publication_id, name, start_date')
        .eq('status', 'draft')
        .not('start_date', 'is', null)
        .lte('start_date', now)

      for (const t of toStart || []) {
        const { data: active } = await supabaseAdmin
          .from('subscribe_ab_tests')
          .select('id')
          .eq('publication_id', t.publication_id)
          .eq('status', 'active')
          .maybeSingle()

        if (active) {
          logger.info(
            { testId: t.id, pubId: t.publication_id },
            'Skipped auto-start: another test is already active'
          )
          continue
        }

        const { error } = await supabaseAdmin
          .from('subscribe_ab_tests')
          .update({ status: 'active', started_at: now, updated_at: now })
          .eq('id', t.id)
          .eq('status', 'draft') // guard against races
        if (error) {
          logger.error({ err: error, testId: t.id }, 'Failed to start test')
        } else {
          startedCount++
          logger.info({ testId: t.id, pubId: t.publication_id, name: t.name }, 'Auto-started test')
        }
      }
    }

    return NextResponse.json({
      success: true,
      started: startedCount,
      ended: endedCount,
      timestamp: now,
    })
  }
)

export const GET = POST
export const maxDuration = 60
