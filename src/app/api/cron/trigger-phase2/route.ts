import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Cron job to automatically trigger Phase 2 for campaigns that completed Phase 1
 *
 * Runs every 3 minutes, checks for campaigns with status = 'pending_phase2'
 * and triggers Phase 2 for them.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    // Allow both Vercel cron (no secret) and manual testing (with secret)
    const isVercelCron = !secret && !searchParams.has('secret')
    const isManualTest = secret === process.env.CRON_SECRET

    if (!isVercelCron && !isManualTest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Cron] Checking for campaigns ready for Phase 2...')

    // Find campaigns with status = 'pending_phase2'
    const { data: campaigns, error } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, updated_at')
      .eq('status', 'pending_phase2')
      .order('updated_at', { ascending: true })

    if (error) {
      console.error('[Cron] Error fetching pending campaigns:', error)
      throw error
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('[Cron] No campaigns ready for Phase 2')
      return NextResponse.json({
        success: true,
        message: 'No campaigns ready for Phase 2',
        campaigns_checked: 0
      })
    }

    console.log(`[Cron] Found ${campaigns.length} campaign(s) ready for Phase 2`)

    // Trigger Phase 2 for each campaign
    const results = []

    for (const campaign of campaigns) {
      console.log(`[Cron] Triggering Phase 2 for campaign: ${campaign.id}`)

      // Mark as processing to prevent duplicate triggers
      await supabaseAdmin
        .from('newsletter_campaigns')
        .update({ status: 'processing' })
        .eq('id', campaign.id)

      // Trigger Phase 2
      const baseUrl = process.env.NEXTAUTH_URL ||
                     process.env.PRODUCTION_URL ||
                     'https://aiprodaily.vercel.app'

      const phase2Url = `${baseUrl}/api/rss/process-phase2`

      try {
        const response = await fetch(phase2Url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CRON_SECRET}`
          },
          body: JSON.stringify({ campaign_id: campaign.id })
        })

        const result = await response.json()

        if (response.ok) {
          console.log(`[Cron] Phase 2 triggered successfully for campaign: ${campaign.id}`)
          results.push({
            campaign_id: campaign.id,
            status: 'triggered',
            message: 'Phase 2 started successfully'
          })
        } else {
          console.error(`[Cron] Phase 2 trigger failed for campaign ${campaign.id}:`, result)

          // Mark as failed
          await supabaseAdmin
            .from('newsletter_campaigns')
            .update({ status: 'failed' })
            .eq('id', campaign.id)

          results.push({
            campaign_id: campaign.id,
            status: 'failed',
            error: result.message || 'Phase 2 trigger failed'
          })
        }
      } catch (fetchError) {
        console.error(`[Cron] Failed to trigger Phase 2 for campaign ${campaign.id}:`, fetchError)

        // Mark as failed
        await supabaseAdmin
          .from('newsletter_campaigns')
          .update({ status: 'failed' })
          .eq('id', campaign.id)

        results.push({
          campaign_id: campaign.id,
          status: 'failed',
          error: fetchError instanceof Error ? fetchError.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${campaigns.length} campaign(s)`,
      campaigns_checked: campaigns.length,
      results
    })

  } catch (error) {
    console.error('[Cron] Error in Phase 2 trigger:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to trigger Phase 2',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Also support POST for manual testing
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return GET(request)
}
