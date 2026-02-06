import { NextRequest, NextResponse } from 'next/server'
import { SparkLoopService } from '@/lib/sparkloop-client'

// Default publication ID for AI Pro Daily
const DEFAULT_PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

/**
 * POST /api/sparkloop/sync
 *
 * Sync recommendations from SparkLoop API to our database
 * Updates existing records with latest data from SparkLoop
 * Can be called manually or via cron job
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: verify cron secret for automated calls
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Allow calls without auth in development, require in production
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const service = new SparkLoopService()
    const result = await service.syncRecommendationsToDatabase(DEFAULT_PUBLICATION_ID)

    return NextResponse.json({
      success: true,
      ...result,
      message: `Synced ${result.synced} recommendations (${result.created} new, ${result.updated} updated, ${result.outOfBudget} auto-excluded for budget)`,
    })
  } catch (error) {
    console.error('[SparkLoop Sync] Failed:', error)

    return NextResponse.json(
      {
        error: 'Sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sparkloop/sync
 *
 * Get sync status and last sync time
 */
export async function GET(request: NextRequest) {
  try {
    const service = new SparkLoopService()
    const stored = await service.getStoredRecommendations(DEFAULT_PUBLICATION_ID)

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
        our_cr: r.our_cr, // Conversion Rate: submissions/impressions
        our_rcr: r.our_rcr, // Referral Confirmation Rate: confirms/(confirms+rejections)
        impressions: r.impressions,
        selections: r.selections,
        submissions: r.submissions,
        confirms: r.confirms,
        rejections: r.rejections,
        pending: r.pending,
        last_synced_at: r.last_synced_at,
      })),
    })
  } catch (error) {
    console.error('[SparkLoop Sync] Failed to get status:', error)

    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}
