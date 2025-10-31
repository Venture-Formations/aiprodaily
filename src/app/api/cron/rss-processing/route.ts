import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ScheduleChecker } from '@/lib/schedule-checker'
import { PromptSelector } from '@/lib/prompt-selector'

async function processRSSWorkflow(request: NextRequest, force: boolean = false) {
  let campaignId: string | undefined

  // Check if it's time to run RSS processing based on database settings
  // Allow bypassing the schedule check with force=true parameter
  if (!force) {
    const shouldRun = await ScheduleChecker.shouldRunRSSProcessing()

    if (!shouldRun) {
      return {
        skipped: true,
        response: NextResponse.json({
          success: true,
          message: 'Not time to run RSS processing or already ran today',
          skipped: true,
          timestamp: new Date().toISOString()
        })
      }
    }
  } else {
    console.log('[Cron] Force mode enabled - bypassing schedule check')
  }

  // Get tomorrow's date for campaign creation (RSS processing is for next day)
  // IMPORTANT: Calculate tomorrow based on Central Time, not UTC
  const now = new Date()
  const centralFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  const centralDate = centralFormatter.format(now)
  const centralToday = new Date(centralDate + 'T00:00:00')
  const centralTomorrow = new Date(centralToday)
  centralTomorrow.setDate(centralToday.getDate() + 1)
  const campaignDate = centralTomorrow.toISOString().split('T')[0]

  // Get newsletter ID
  const { data: newsletter, error: newsletterError } = await supabaseAdmin
    .from('newsletters')
    .select('id, name, slug')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (newsletterError || !newsletter) {
    throw new Error(`Failed to fetch newsletter: ${newsletterError?.message || 'No active newsletter found'}`)
  }

  // Create campaign
  const { data: newCampaign, error: campaignError } = await supabaseAdmin
    .from('newsletter_campaigns')
    .insert([{
      date: campaignDate,
      status: 'processing',
      newsletter_id: newsletter.id
    }])
    .select()
    .single()

  if (campaignError || !newCampaign) {
    throw new Error(`Failed to create campaign: ${campaignError?.message}`)
  }

  campaignId = newCampaign.id

  if (!campaignId) {
    throw new Error('campaignId is required but was not set')
  }

  // Select prompt and AI apps for the campaign
  await PromptSelector.selectPromptForCampaign(campaignId)
  try {
    const { AppSelector } = await import('@/lib/app-selector')
    await AppSelector.selectAppsForCampaign(campaignId, newsletter.id)
  } catch (appSelectionError) {
    console.error('AI app selection failed:', appSelectionError instanceof Error ? appSelectionError.message : 'Unknown error')
  }

  // Construct base URL - always use production URL for internal requests
  // Preview deployments require authentication, so we use the production domain
  let baseUrl: string
  if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes('-venture-formations')) {
    // NEXTAUTH_URL set and not a preview URL
    baseUrl = process.env.NEXTAUTH_URL
  } else {
    // Default to production domain (hardcoded to avoid preview auth issues)
    baseUrl = process.env.PRODUCTION_URL || 'https://aiprodaily.vercel.app'
  }

  // Phase 1: Archive, Fetch+Extract, Score (steps 1-3)
  console.log(`[Cron] Phase 1 starting for campaign: ${campaignId}`)
  console.log(`[Cron] Using baseUrl: ${baseUrl}`)
  
  const phase1Url = `${baseUrl}/api/rss/process-phase1`
  console.log(`[Cron] Calling: ${phase1Url}`)
  
  const phase1Response = await fetch(phase1Url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CRON_SECRET}`
    },
    body: JSON.stringify({ campaign_id: campaignId })
  })

  // Check if response is JSON or HTML (error page)
  const contentType = phase1Response.headers.get('content-type') || ''
  let phase1Result: any
  
  if (contentType.includes('application/json')) {
    phase1Result = await phase1Response.json()
  } else {
    const text = await phase1Response.text()
    console.error(`[Cron] Phase 1 returned HTML instead of JSON (status: ${phase1Response.status}):`, text.substring(0, 500))
    throw new Error(`Phase 1 returned non-JSON response (${phase1Response.status}): ${text.substring(0, 200)}`)
  }

  if (!phase1Response.ok) {
    throw new Error(`Phase 1 failed: ${phase1Result.message || JSON.stringify(phase1Result)}`)
  }

  console.log(`[Cron] Phase 1 completed for campaign: ${campaignId}`)

  // Phase 2: Deduplicate, Generate, Select+Subject, Welcome, Finalize (steps 4-8)
  console.log(`[Cron] Phase 2 starting for campaign: ${campaignId}`)
  
  const phase2Url = `${baseUrl}/api/rss/process-phase2`
  const phase2Response = await fetch(phase2Url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CRON_SECRET}`
    },
    body: JSON.stringify({ campaign_id: campaignId })
  })

  // Check if response is JSON or HTML (error page)
  const contentType2 = phase2Response.headers.get('content-type') || ''
  let phase2Result: any
  
  if (contentType2.includes('application/json')) {
    phase2Result = await phase2Response.json()
  } else {
    const text = await phase2Response.text()
    console.error(`[Cron] Phase 2 returned HTML instead of JSON (status: ${phase2Response.status}):`, text.substring(0, 500))
    throw new Error(`Phase 2 returned non-JSON response (${phase2Response.status}): ${text.substring(0, 200)}`)
  }

  if (!phase2Response.ok) {
    throw new Error(`Phase 2 failed: ${phase2Result.message || JSON.stringify(phase2Result)}`)
  }

  console.log(`[Cron] Phase 2 completed for campaign: ${campaignId}`)

  return {
    skipped: false,
    response: NextResponse.json({
      success: true,
      message: 'Full RSS processing workflow completed successfully',
      campaignId: campaignId,
      campaignDate: campaignDate,
      phase1_results: phase1Result.results,
      phase2_results: phase2Result.results,
      timestamp: new Date().toISOString()
    }),
    campaignId
  }
}

export async function POST(request: NextRequest) {
  let campaignId: string | undefined

  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check for force parameter in URL or body
    const searchParams = new URL(request.url).searchParams
    const forceParam = searchParams.get('force')
    const force = forceParam === 'true'

    const result = await processRSSWorkflow(request, force)
    if (result.skipped) {
      return result.response
    }
    
    campaignId = result.campaignId
    return result.response

  } catch (error) {
    console.error('RSS processing failed:', error instanceof Error ? error.message : 'Unknown error')

    // Try to mark campaign as failed if campaign_id is available
    if (campaignId) {
      try {
        await supabaseAdmin
          .from('newsletter_campaigns')
          .update({ status: 'failed' })
          .eq('id', campaignId)
      } catch (updateError) {
        console.error('Failed to update campaign status:', updateError)
      }
    }

    return NextResponse.json({
      success: false,
      error: 'RSS processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      campaign_id: campaignId,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Handle GET requests from Vercel cron (no auth header, uses URL secret)
export async function GET(request: NextRequest) {
  let campaignId: string | undefined

  try {
    // For Vercel cron: check secret in URL params, for manual: require secret param
    const searchParams = new URL(request.url).searchParams
    const secret = searchParams.get('secret')

    // Allow both manual testing (with secret param) and Vercel cron (no auth needed)
    const isVercelCron = !secret && !searchParams.has('secret')
    const isManualTest = secret === process.env.CRON_SECRET

    if (!isVercelCron && !isManualTest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check for force parameter to bypass schedule check
    const forceParam = searchParams.get('force')
    const force = forceParam === 'true'

    const result = await processRSSWorkflow(request, force)
    if (result.skipped) {
      return result.response
    }
    
    campaignId = result.campaignId
    return result.response

  } catch (error) {
    console.error('RSS processing failed:', error instanceof Error ? error.message : 'Unknown error')

    // Try to mark campaign as failed if campaign_id is available
    if (campaignId) {
      try {
        await supabaseAdmin
          .from('newsletter_campaigns')
          .update({ status: 'failed' })
          .eq('id', campaignId)
      } catch (updateError) {
        console.error('Failed to update campaign status:', updateError)
      }
    }

    return NextResponse.json({
      success: false,
      error: 'RSS processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      campaign_id: campaignId,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}