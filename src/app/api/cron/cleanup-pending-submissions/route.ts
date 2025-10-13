import { NextRequest, NextResponse } from 'next/server'
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
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  // Verify cron secret for manual testing
  // Vercel cron requests come without auth header
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '')
    if (token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    console.log('[Cleanup Cron] Starting cleanup of expired pending submissions')

    // Delete expired, unprocessed submissions
    const { data: deletedRecords, error: deleteError } = await supabaseAdmin
      .from('pending_event_submissions')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .eq('processed', false)
      .select()

    if (deleteError) {
      console.error('[Cleanup Cron] Error deleting expired submissions:', deleteError)
      throw deleteError
    }

    const deletedCount = deletedRecords?.length || 0
    console.log(`[Cleanup Cron] Deleted ${deletedCount} expired pending submission(s)`)

    if (deletedCount > 0) {
      // Log the deleted submissions for debugging
      deletedRecords.forEach(record => {
        console.log(`[Cleanup Cron] Deleted expired submission:`)
        console.log(`  - Session ID: ${record.stripe_session_id}`)
        console.log(`  - Submitter: ${record.submitter_name} (${record.submitter_email})`)
        console.log(`  - Events: ${record.events_data.length}`)
        console.log(`  - Created: ${record.created_at}`)
        console.log(`  - Expired: ${record.expires_at}`)
      })
    }

    return NextResponse.json({
      success: true,
      deleted_count: deletedCount,
      message: `Cleaned up ${deletedCount} expired pending submission(s)`
    })

  } catch (error) {
    console.error('[Cleanup Cron] Cleanup failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Cleanup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
