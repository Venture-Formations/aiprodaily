import { withApiHandler } from '@/lib/api-handler'
import { NextResponse } from 'next/server'
import { createSparkLoopServiceForPublication } from '@/lib/sparkloop-client'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/cron/sync-sparkloop
 *
 * Cron job to sync recommendations from SparkLoop API every 15 minutes.
 * Iterates all active publications with SparkLoop credentials configured.
 * Publications using env var fallback are also included.
 */
export const GET = withApiHandler(
  { authTier: 'system', logContext: 'sync-sparkloop' },
  async ({ logger }) => {
    logger.info('Starting multi-publication sync...')

    // Get all active publications
    const { data: pubs, error: pubError } = await supabaseAdmin
      .from('publications')
      .select('id, name')
      .eq('is_active', true)

    if (pubError || !pubs?.length) {
      logger.error(`Failed to fetch publications: ${pubError?.message || 'unknown'}`)
      return NextResponse.json({ success: false, error: 'No active publications' }, { status: 500 })
    }

    const results: Array<{ publicationId: string; name: string; success: boolean; synced?: number; error?: string }> = []

    for (const pub of pubs) {
      try {
        const service = await createSparkLoopServiceForPublication(pub.id)
        if (!service) {
          // No SparkLoop credentials for this publication — skip silently
          continue
        }

        const result = await service.syncRecommendationsToDatabase(pub.id)
        const snapshotCount = await service.takeDailySnapshot(pub.id)

        logger.info(`[${pub.name}] Completed: ${result.synced} synced, ${result.lowBudget} low-budget-paused, +${result.confirmDeltas} confirms, +${result.rejectionDeltas} rejections, ${snapshotCount} snapshot rows`)

        results.push({
          publicationId: pub.id,
          name: pub.name,
          success: true,
          synced: result.synced,
        })
      } catch (error) {
        logger.error(`[${pub.name}] Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        results.push({
          publicationId: pub.id,
          name: pub.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    logger.info(`Sync complete: ${successCount} publications synced, ${failCount} failed, ${pubs.length - results.length} skipped (no credentials)`)

    return NextResponse.json({
      success: failCount === 0,
      publications: results,
      summary: {
        total: pubs.length,
        synced: successCount,
        failed: failCount,
        skipped: pubs.length - results.length,
      },
    })
  }
)
