import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { start } from 'workflow/api'
import { reprocessArticlesWorkflow } from '@/lib/workflows/reprocess-articles-workflow'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Reprocess Articles for an Existing Campaign
 *
 * This endpoint triggers the reprocess workflow which:
 * 1. Deletes existing articles
 * 2. Unassigns posts
 * 3. Reselects top posts
 * 4. Regenerates all articles
 * 5. Regenerates welcome section
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: campaignId } = await params

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 })
    }

    // Get campaign and newsletter info
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, newsletter_id, status')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Prevent reprocessing if already processing
    if (campaign.status === 'processing') {
      return NextResponse.json({
        error: 'Campaign is already processing',
        status: campaign.status
      }, { status: 409 })
    }

    console.log(`[Reprocess API] Starting reprocess for campaign ${campaignId}`)

    // Start the workflow
    await start(reprocessArticlesWorkflow, [{
      campaign_id: campaignId,
      newsletter_id: campaign.newsletter_id
    }])

    return NextResponse.json({
      success: true,
      message: 'Reprocess workflow started',
      campaign_id: campaignId
    })

  } catch (error) {
    console.error('[Reprocess API] Failed:', error)
    return NextResponse.json({
      error: 'Failed to start reprocess workflow',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 60
