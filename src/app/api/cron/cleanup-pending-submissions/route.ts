import { withApiHandler } from '@/lib/api-handler'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Cleanup Pending Submissions Cron Job
 *
 * Runs daily to remove expired pending event submissions.
 * These are submissions where:
 * - The user started a Stripe checkout but never completed payment
 * - The submission is older than 24 hours (expires_at)
 * - The submission has not been processed
 *
 * Scheduled to run daily at 2:00 AM CT via Vercel cron
 */
export const GET = withApiHandler(
  { authTier: 'system', logContext: 'cleanup-pending-submissions' },
  async ({ logger }) => {
    logger.info('Starting cleanup of expired pending submissions')

    // Delete expired, unprocessed submissions
    const { data: deletedRecords, error: deleteError } = await supabaseAdmin
      .from('pending_event_submissions')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .eq('processed', false)
      .select()

    if (deleteError) {
      logger.error({ err: deleteError }, 'Error deleting expired submissions')
      throw deleteError
    }

    const deletedCount = deletedRecords?.length || 0
    logger.info(`Deleted ${deletedCount} expired pending submission(s)`)

    if (deletedCount > 0) {
      // Log the deleted submissions for debugging
      deletedRecords.forEach(record => {
        logger.info({
          sessionId: record.stripe_session_id,
          submitter: `${record.submitter_name} (${record.submitter_email})`,
          events: record.events_data.length,
          created: record.created_at,
          expired: record.expires_at
        }, 'Deleted expired submission')
      })
    }

    return NextResponse.json({
      success: true,
      deleted_count: deletedCount,
      message: `Cleaned up ${deletedCount} expired pending submission(s)`
    })
  }
)
