import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ScheduleChecker } from '@/lib/schedule-checker'
import { PromptSelector } from '@/lib/prompt-selector'

export async function POST(request: NextRequest) {
  let campaignId: string | undefined

  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }


    // Check if it's time to run RSS processing based on database settings
    const shouldRun = await ScheduleChecker.shouldRunRSSProcessing()

    if (!shouldRun) {
      return NextResponse.json({
        success: true,
        message: 'Not time to run RSS processing or already ran today',
        skipped: true,
        timestamp: new Date().toISOString()
      })
    }


    // Get tomorrow's date for campaign creation (RSS processing is for next day)
    // IMPORTANT: Calculate tomorrow based on Central Time, not UTC
    // Fix for issue where RSS runs 8:15 PM CT Sept 22 but created campaign for Sept 24 instead of Sept 23
    const now = new Date()

    // Create a date in Central Time using Intl.DateTimeFormat
    const centralFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })

    const centralDate = centralFormatter.format(now) // Returns YYYY-MM-DD in Central Time

    // Add one day to get tomorrow in Central Time
    const centralToday = new Date(centralDate + 'T00:00:00')
    const centralTomorrow = new Date(centralToday)
    centralTomorrow.setDate(centralToday.getDate() + 1)

    const campaignDate = centralTomorrow.toISOString().split('T')[0]


    // STEP 1: Get newsletter ID first (required for campaign creation)
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('newsletters')
      .select('id, name, slug')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (newsletterError || !newsletter) {
      throw new Error(`Failed to fetch newsletter: ${newsletterError?.message || 'No active newsletter found'}`)
    }



    // Check if a campaign already exists for this date
    const { data: existingCampaign, error: checkError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, status')
      .eq('date', campaignDate)
      .eq('newsletter_id', newsletter.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (checkError) {
      throw new Error(`Failed to check for existing campaign: ${checkError.message}`)
    }

    if (existingCampaign) {
      console.log(`[Cron] Campaign already exists for date ${campaignDate}, using existing campaign: ${existingCampaign.id}`)
      campaignId = existingCampaign.id
    } else {
      // Create a new campaign only if one doesn't exist
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
      console.log(`[Cron] Created new campaign for date ${campaignDate}: ${campaignId}`)
    }

    // Select prompt and AI apps for the campaign
    await PromptSelector.selectPromptForCampaign(campaignId!)
    try {
      const { AppSelector } = await import('@/lib/app-selector')
      await AppSelector.selectAppsForCampaign(campaignId!, newsletter.id)
    } catch (appSelectionError) {
      console.error('AI app selection failed:', appSelectionError instanceof Error ? appSelectionError.message : 'Unknown error')
    }

    if (!campaignId) {
      throw new Error('campaignId is required but was not set')
    }

    // Construct base URL from the request URL
    const baseUrl = new URL(request.url).origin

    // Phase 1: Archive, Fetch+Extract, Score (steps 1-3)
    console.log(`[Cron] Phase 1 starting for campaign: ${campaignId}`)
    
    const phase1Response = await fetch(`${baseUrl}/api/rss/process-phase1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      },
      body: JSON.stringify({ campaign_id: campaignId })
    })

    const phase1Result = await phase1Response.json()

    if (!phase1Response.ok) {
      throw new Error(`Phase 1 failed: ${phase1Result.message || JSON.stringify(phase1Result)}`)
    }

    console.log(`[Cron] Phase 1 completed for campaign: ${campaignId}`)

    // Phase 2: Deduplicate, Generate, Select+Subject, Welcome, Finalize (steps 4-8)
    console.log(`[Cron] Phase 2 starting for campaign: ${campaignId}`)
    
    const phase2Response = await fetch(`${baseUrl}/api/rss/process-phase2`, {
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
      throw new Error(`Phase 2 returned non-JSON response (${phase2Response.status}): ${text.substring(0, 200)}`)
    }

    if (!phase2Response.ok) {
      throw new Error(`Phase 2 failed: ${phase2Result.message || JSON.stringify(phase2Result)}`)
    }

    console.log(`[Cron] Phase 2 completed for campaign: ${campaignId}`)

    return NextResponse.json({
      success: true,
      message: 'Full RSS processing workflow completed successfully',
      campaignId: campaignId,
      campaignDate: campaignDate,
      phase1_results: phase1Result.results,
      phase2_results: phase2Result.results,
      timestamp: new Date().toISOString()
    })

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


    // Check if it's time to run RSS processing based on database settings
    const shouldRun = await ScheduleChecker.shouldRunRSSProcessing()

    if (!shouldRun) {
      return NextResponse.json({
        success: true,
        message: 'Not time to run RSS processing or already ran today',
        skipped: true,
        timestamp: new Date().toISOString()
      })
    }


    // Get tomorrow's date for campaign creation (RSS processing is for next day)
    // IMPORTANT: Calculate tomorrow based on Central Time, not UTC
    // Fix for issue where RSS runs 8:15 PM CT Sept 22 but created campaign for Sept 24 instead of Sept 23
    const now = new Date()

    // Create a date in Central Time using Intl.DateTimeFormat
    const centralFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })

    const centralDate = centralFormatter.format(now) // Returns YYYY-MM-DD in Central Time

    // Add one day to get tomorrow in Central Time
    const centralToday = new Date(centralDate + 'T00:00:00')
    const centralTomorrow = new Date(centralToday)
    centralTomorrow.setDate(centralToday.getDate() + 1)

    const campaignDate = centralTomorrow.toISOString().split('T')[0]


    // STEP 1: Get newsletter ID first (required for campaign creation)
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('newsletters')
      .select('id, name, slug')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (newsletterError || !newsletter) {
      throw new Error(`Failed to fetch newsletter: ${newsletterError?.message || 'No active newsletter found'}`)
    }


    // Check if a campaign already exists for this date
    const { data: existingCampaign, error: checkError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, status')
      .eq('date', campaignDate)
      .eq('newsletter_id', newsletter.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (checkError) {
      throw new Error(`Failed to check for existing campaign: ${checkError.message}`)
    }

    if (existingCampaign) {
      console.log(`[Cron] Campaign already exists for date ${campaignDate}, using existing campaign: ${existingCampaign.id}`)
      campaignId = existingCampaign.id
    } else {
      // Create a new campaign only if one doesn't exist
      const { data: newCampaign, error: campaignError } = await supabaseAdmin
        .from('newsletter_campaigns')
        .insert([{
          date: campaignDate,
          subject_line: '', // Will be generated later
          status: 'processing',
          newsletter_id: newsletter.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select('id')
        .single()

      if (campaignError || !newCampaign) {
        throw new Error(`Failed to create campaign: ${campaignError?.message}`)
      }

      campaignId = newCampaign.id
      console.log(`[Cron] Created new campaign for date ${campaignDate}: ${campaignId}`)
    }

    // Select prompt and AI apps for the campaign
    await PromptSelector.selectPromptForCampaign(campaignId!)
    try {
      const { AppSelector } = await import('@/lib/app-selector')
      await AppSelector.selectAppsForCampaign(campaignId!, newsletter.id)
    } catch (appSelectionError) {
      console.error('AI app selection failed:', appSelectionError instanceof Error ? appSelectionError.message : 'Unknown error')
    }

    if (!campaignId) {
      throw new Error('campaignId is required but was not set')
    }

    // Construct base URL from the request URL
    const baseUrl = new URL(request.url).origin

    // Phase 1: Archive, Fetch+Extract, Score (steps 1-3)
    console.log(`[Cron] Phase 1 starting for campaign: ${campaignId}`)
    
    const phase1Response = await fetch(`${baseUrl}/api/rss/process-phase1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      },
      body: JSON.stringify({ campaign_id: campaignId })
    })

    const phase1Result = await phase1Response.json()

    if (!phase1Response.ok) {
      throw new Error(`Phase 1 failed: ${phase1Result.message || JSON.stringify(phase1Result)}`)
    }

    console.log(`[Cron] Phase 1 completed for campaign: ${campaignId}`)

    // Phase 2: Deduplicate, Generate, Select+Subject, Welcome, Finalize (steps 4-8)
    console.log(`[Cron] Phase 2 starting for campaign: ${campaignId}`)
    
    const phase2Response = await fetch(`${baseUrl}/api/rss/process-phase2`, {
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
      throw new Error(`Phase 2 returned non-JSON response (${phase2Response.status}): ${text.substring(0, 200)}`)
    }

    if (!phase2Response.ok) {
      throw new Error(`Phase 2 failed: ${phase2Result.message || JSON.stringify(phase2Result)}`)
    }

    console.log(`[Cron] Phase 2 completed for campaign: ${campaignId}`)

    return NextResponse.json({
      success: true,
      message: 'Full RSS processing workflow completed successfully',
      campaignId: campaignId,
      campaignDate: campaignDate,
      phase1_results: phase1Result.results,
      phase2_results: phase2Result.results,
      timestamp: new Date().toISOString()
    })

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