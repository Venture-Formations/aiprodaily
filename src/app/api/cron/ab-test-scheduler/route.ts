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
      const { data: toEnd, error: toEndErr } = await supabaseAdmin
        .from('subscribe_ab_tests')
        .select('id, publication_id, name, end_date')
        .eq('status', 'active')
        .not('end_date', 'is', null)
        .lte('end_date', now)

      if (toEndErr) {
        logger.error({ err: toEndErr, now }, 'Failed to load tests to end')
        return NextResponse.json(
          { success: false, error: toEndErr.message, phase: 'load_to_end' },
          { status: 500 }
        )
      }

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
      const { data: toStart, error: toStartErr } = await supabaseAdmin
        .from('subscribe_ab_tests')
        .select('id, publication_id, name, start_date')
        .eq('status', 'draft')
        .not('start_date', 'is', null)
        .lte('start_date', now)

      if (toStartErr) {
        logger.error({ err: toStartErr, now }, 'Failed to load tests to start')
        return NextResponse.json(
          { success: false, error: toStartErr.message, phase: 'load_to_start', ended: endedCount },
          { status: 500 }
        )
      }

      // Track publications we've already started in this run so we don't try
      // two drafts for the same publication and produce a benign-but-noisy
      // unique-violation race.
      const startedPubs = new Set<string>()

      for (const t of toStart || []) {
        if (startedPubs.has(t.publication_id)) {
          logger.info({ testId: t.id, pubId: t.publication_id }, 'Skipped auto-start: another draft already started this run')
          continue
        }

        const { data: active, error: activeErr } = await supabaseAdmin
          .from('subscribe_ab_tests')
          .select('id')
          .eq('publication_id', t.publication_id)
          .eq('status', 'active')
          .maybeSingle()

        if (activeErr) {
          logger.error({ err: activeErr, testId: t.id, pubId: t.publication_id }, 'Failed active-test lookup; skipping')
          continue
        }

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
          // 23505 = unique_violation (the partial unique index on active tests).
          // Treat as a benign race loss, not a failure.
          if ((error as { code?: string }).code === '23505') {
            logger.info(
              { testId: t.id, pubId: t.publication_id },
              'Skipped auto-start: another test won the race'
            )
          } else {
            logger.error({ err: error, testId: t.id }, 'Failed to start test')
          }
        } else {
          startedCount++
          startedPubs.add(t.publication_id)
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
