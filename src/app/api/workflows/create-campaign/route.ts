import { NextRequest, NextResponse } from 'next/server'
import { start } from 'workflow/api'
import { createCampaignWorkflow } from '@/lib/workflows/create-campaign-workflow'

/**
 * Create Campaign Workflow Endpoint
 * Generates articles for an existing campaign
 * Each step gets its own 800-second timeout via Vercel Workflow DevKit
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { campaign_id, newsletter_id } = body

    if (!campaign_id || !newsletter_id) {
      return NextResponse.json({
        error: 'campaign_id and newsletter_id are required'
      }, { status: 400 })
    }

    console.log(`[Create Campaign Workflow] Starting for campaign: ${campaign_id}`)

    // Start the workflow using the API from workflow/api
    await start(createCampaignWorkflow, [{
      campaign_id,
      newsletter_id
    }])

    console.log(`[Create Campaign Workflow] Started successfully`)

    return NextResponse.json({
      success: true,
      message: 'Workflow started successfully',
      campaign_id,
      newsletter_id,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Create Campaign Workflow] Failed:', error)
    return NextResponse.json({
      error: 'Workflow failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 800
