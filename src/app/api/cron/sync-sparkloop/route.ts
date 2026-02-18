import { NextRequest, NextResponse } from 'next/server'
import { SparkLoopService } from '@/lib/sparkloop-client'
import { PUBLICATION_ID } from '@/lib/config'

/**
 * GET /api/cron/sync-sparkloop
 *
 * Cron job to sync recommendations from SparkLoop API every 15 minutes
 * Updates existing records with latest data including budget info
 * Auto-excludes recommendations when remaining_budget < 5 × CPA
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[SparkLoop Cron] Starting sync...')

    const service = new SparkLoopService()
    const result = await service.syncRecommendationsToDatabase(PUBLICATION_ID)

    // Take daily snapshot after sync (idempotent — last sync of the day wins)
    const snapshotCount = await service.takeDailySnapshot(PUBLICATION_ID)

    console.log(`[SparkLoop Cron] Completed: ${result.synced} synced, ${result.outOfBudget} auto-excluded, +${result.confirmDeltas} confirms, +${result.rejectionDeltas} rejections, ${snapshotCount} snapshot rows`)

    return NextResponse.json({
      success: true,
      ...result,
      snapshotCount,
      message: `Synced ${result.synced} recommendations (${result.created} new, ${result.updated} updated, ${result.outOfBudget} auto-excluded, +${result.confirmDeltas} confirms, +${result.rejectionDeltas} rejections, ${snapshotCount} snapshot rows)`,
    })
  } catch (error) {
    console.error('[SparkLoop Cron] Failed:', error)

    return NextResponse.json(
      {
        error: 'Sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
