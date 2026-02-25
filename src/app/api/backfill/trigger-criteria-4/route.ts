import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'

/**
 * Simple trigger endpoint for criteria 4 backfill
 * Can be called via browser or curl
 */
export const GET = withApiHandler(
  { authTier: 'system', logContext: 'backfill/trigger-criteria-4' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const newsletterId = searchParams.get('publication_id')
    const dryRun = searchParams.get('dry_run') === 'true'

    if (!newsletterId) {
      return NextResponse.json({
        error: 'publication_id query parameter is required'
      }, { status: 400 })
    }

    console.log(`[Trigger] Starting criteria 4 backfill...`)
    console.log(`[Trigger] Newsletter ID: ${newsletterId}`)
    console.log(`[Trigger] Dry run: ${dryRun}`)

    // Call the backfill endpoint
    const backfillUrl = `${process.env.NEXTAUTH_URL}/api/backfill/criteria-4`

    const response = await fetch(backfillUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || ''
      },
      body: JSON.stringify({
        newsletterId,
        dryRun
      })
    })

    const result = await response.json()

    return NextResponse.json({
      success: true,
      message: 'Backfill triggered',
      result
    })
  }
)

export const maxDuration = 600 // 10 minutes
