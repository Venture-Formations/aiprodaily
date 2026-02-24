import { withApiHandler } from '@/lib/api-handler'
import { NextResponse } from 'next/server'
import { SparkLoopService } from '@/lib/sparkloop-client'
import { PUBLICATION_ID } from '@/lib/config'

/**
 * GET /api/cron/sync-sparkloop
 *
 * Cron job to sync recommendations from SparkLoop API every 15 minutes
 * Updates existing records with latest data including budget info
 * Auto-excludes recommendations when remaining_budget < 5 × CPA
 */
export const GET = withApiHandler(
  { authTier: 'system', logContext: 'sync-sparkloop' },
  async ({ logger }) => {
    logger.info('Starting sync...')

    const service = new SparkLoopService()
    const result = await service.syncRecommendationsToDatabase(PUBLICATION_ID)

    // Take daily snapshot after sync (idempotent — last sync of the day wins)
    const snapshotCount = await service.takeDailySnapshot(PUBLICATION_ID)

    logger.info(`Completed: ${result.synced} synced, ${result.outOfBudget} auto-excluded, +${result.confirmDeltas} confirms, +${result.rejectionDeltas} rejections, ${snapshotCount} snapshot rows`)

    return NextResponse.json({
      success: true,
      ...result,
      snapshotCount,
      message: `Synced ${result.synced} recommendations (${result.created} new, ${result.updated} updated, ${result.outOfBudget} auto-excluded, +${result.confirmDeltas} confirms, +${result.rejectionDeltas} rejections, ${snapshotCount} snapshot rows)`,
    })
  }
)
