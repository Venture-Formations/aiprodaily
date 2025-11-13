import { NextRequest, NextResponse } from 'next/server'

/**
 * Simple trigger endpoint for criteria 4 backfill
 * Can be called via browser or curl
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')
    const newsletterId = searchParams.get('publication_id')
    const dryRun = searchParams.get('dry_run') === 'true'

    // Auth check
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

  } catch (error) {
    console.error('[Trigger] Failed:', error)
    return NextResponse.json({
      error: 'Failed to trigger backfill',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 600 // 10 minutes
