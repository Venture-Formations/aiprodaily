import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { createSparkLoopServiceForPublication } from '@/lib/sparkloop-client'
import { PUBLICATION_ID } from '@/lib/config'

/**
 * POST /api/sparkloop/sync
 *
 * Sync recommendations from SparkLoop API to our database
 * Updates existing records with latest data from SparkLoop
 * Can be called manually or via cron job
 */
export const POST = withApiHandler(
  { authTier: 'system', logContext: 'sparkloop/sync' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const publicationId = searchParams.get('publicationId') || PUBLICATION_ID
    const service = await createSparkLoopServiceForPublication(publicationId)
    if (!service) {
      return NextResponse.json({ error: 'SparkLoop not configured for this publication' }, { status: 400 })
    }
    const result = await service.syncRecommendationsToDatabase(publicationId)

    return NextResponse.json({
      success: true,
      ...result,
      message: `Synced ${result.synced} recommendations (${result.created} new, ${result.updated} updated, ${result.lowBudget} low-budget-paused)`,
    })
  }
)

/**
 * GET /api/sparkloop/sync
 *
 * Get sync status and last sync time
 */
export const GET = withApiHandler(
  { authTier: 'system', logContext: 'sparkloop/sync' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const publicationId = searchParams.get('publicationId') || PUBLICATION_ID
    const service = await createSparkLoopServiceForPublication(publicationId)
    if (!service) {
      return NextResponse.json({ error: 'SparkLoop not configured for this publication' }, { status: 400 })
    }
    const stored = await service.getStoredRecommendations(publicationId)

    // Find oldest sync time
    const lastSyncTimes = stored
      .map(r => r.last_synced_at)
      .filter(Boolean)
      .sort()

    return NextResponse.json({
      storedCount: stored.length,
      activeCount: stored.filter(r => r.status === 'active').length,
      oldestSync: lastSyncTimes[0] || null,
      newestSync: lastSyncTimes[lastSyncTimes.length - 1] || null,
      recommendations: stored.map(r => ({
        ref_code: r.ref_code,
        publication_name: r.publication_name,
        cpa: r.cpa,
        sparkloop_rcr: r.sparkloop_rcr,
        our_cr: r.our_cr,
        our_rcr: r.our_rcr,
        impressions: r.impressions,
        selections: r.selections,
        submissions: r.submissions,
        confirms: r.confirms,
        rejections: r.rejections,
        pending: r.pending,
        last_synced_at: r.last_synced_at,
      })),
    })
  }
)
