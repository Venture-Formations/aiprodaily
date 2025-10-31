import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ScheduleChecker } from '@/lib/schedule-checker'
import { PromptSelector } from '@/lib/prompt-selector'
import { executeStep1 } from '@/app/api/rss/combined-steps/step1-archive'
import { executeStep2 } from '@/app/api/rss/combined-steps/step2-fetch-extract'
import { executeStep3 } from '@/app/api/rss/combined-steps/step3-score'
import { executeStep4 } from '@/app/api/rss/combined-steps/step4-deduplicate'
import { executeStep5 } from '@/app/api/rss/combined-steps/step5-generate-headlines'
import { executeStep6 } from '@/app/api/rss/combined-steps/step6-select-subject'
import { executeStep7 } from '@/app/api/rss/combined-steps/step7-welcome'
import { executeStep8 } from '@/app/api/rss/combined-steps/step8-finalize'

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



    // Always create a new campaign (duplicate dates are now allowed)
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

    // Select prompt and AI apps for the campaign
    await PromptSelector.selectPromptForCampaign(campaignId!)
    try {
      const { AppSelector } = await import('@/lib/app-selector')
      await AppSelector.selectAppsForCampaign(campaignId!, newsletter.id)
    } catch (appSelectionError) {
      console.error('AI app selection failed:', appSelectionError instanceof Error ? appSelectionError.message : 'Unknown error')
    }

    // Phase 1: Archive, Fetch+Extract, Score (steps 1-3)
    console.log(`[Cron] Phase 1 starting for campaign: ${campaignId}`)
    
    const phase1Steps = [
      { name: 'Archive', fn: () => executeStep1(campaignId) },
      { name: 'Fetch+Extract', fn: () => executeStep2(campaignId) },
      { name: 'Score', fn: () => executeStep3(campaignId) }
    ]

    const phase1Results = []
    for (const step of phase1Steps) {
      try {
        const result = await step.fn()
        phase1Results.push({ step: step.name, status: 'success', data: result })
      } catch (error) {
        console.error(`[Cron] Phase 1 failed at ${step.name}:`, error)
        phase1Results.push({ step: step.name, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' })
        throw new Error(`Phase 1 failed at ${step.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    console.log(`[Cron] Phase 1 completed for campaign: ${campaignId}`)

    // Phase 2: Deduplicate, Generate, Select+Subject, Welcome, Finalize (steps 4-8)
    console.log(`[Cron] Phase 2 starting for campaign: ${campaignId}`)
    
    const phase2Steps = [
      { name: 'Deduplicate', fn: () => executeStep4(campaignId) },
      { name: 'Generate', fn: () => executeStep5(campaignId) },
      { name: 'Select+Subject', fn: () => executeStep6(campaignId) },
      { name: 'Welcome', fn: () => executeStep7(campaignId) },
      { name: 'Finalize', fn: () => executeStep8(campaignId) }
    ]

    const phase2Results = []
    for (const step of phase2Steps) {
      try {
        const result = await step.fn()
        phase2Results.push({ step: step.name, status: 'success', data: result })
      } catch (error) {
        console.error(`[Cron] Phase 2 failed at ${step.name}:`, error)
        phase2Results.push({ step: step.name, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' })
        throw new Error(`Phase 2 failed at ${step.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    console.log(`[Cron] Phase 2 completed for campaign: ${campaignId}`)

    return NextResponse.json({
      success: true,
      message: 'Full RSS processing workflow completed successfully',
      campaignId: campaignId,
      campaignDate: campaignDate,
      phase1_results: phase1Results,
      phase2_results: phase2Results,
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


    // Always create a new campaign (duplicate dates are now allowed)
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

    // Select prompt and AI apps for the campaign
    await PromptSelector.selectPromptForCampaign(campaignId!)
    try {
      const { AppSelector } = await import('@/lib/app-selector')
      await AppSelector.selectAppsForCampaign(campaignId!, newsletter.id)
    } catch (appSelectionError) {
      console.error('AI app selection failed:', appSelectionError instanceof Error ? appSelectionError.message : 'Unknown error')
    }

    // Phase 1: Archive, Fetch+Extract, Score (steps 1-3)
    console.log(`[Cron] Phase 1 starting for campaign: ${campaignId}`)
    
    const phase1Steps = [
      { name: 'Archive', fn: () => executeStep1(campaignId) },
      { name: 'Fetch+Extract', fn: () => executeStep2(campaignId) },
      { name: 'Score', fn: () => executeStep3(campaignId) }
    ]

    const phase1Results = []
    for (const step of phase1Steps) {
      try {
        const result = await step.fn()
        phase1Results.push({ step: step.name, status: 'success', data: result })
      } catch (error) {
        console.error(`[Cron] Phase 1 failed at ${step.name}:`, error)
        phase1Results.push({ step: step.name, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' })
        throw new Error(`Phase 1 failed at ${step.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    console.log(`[Cron] Phase 1 completed for campaign: ${campaignId}`)

    // Phase 2: Deduplicate, Generate, Select+Subject, Welcome, Finalize (steps 4-8)
    console.log(`[Cron] Phase 2 starting for campaign: ${campaignId}`)
    
    const phase2Steps = [
      { name: 'Deduplicate', fn: () => executeStep4(campaignId) },
      { name: 'Generate', fn: () => executeStep5(campaignId) },
      { name: 'Select+Subject', fn: () => executeStep6(campaignId) },
      { name: 'Welcome', fn: () => executeStep7(campaignId) },
      { name: 'Finalize', fn: () => executeStep8(campaignId) }
    ]

    const phase2Results = []
    for (const step of phase2Steps) {
      try {
        const result = await step.fn()
        phase2Results.push({ step: step.name, status: 'success', data: result })
      } catch (error) {
        console.error(`[Cron] Phase 2 failed at ${step.name}:`, error)
        phase2Results.push({ step: step.name, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' })
        throw new Error(`Phase 2 failed at ${step.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    console.log(`[Cron] Phase 2 completed for campaign: ${campaignId}`)

    return NextResponse.json({
      success: true,
      message: 'Full RSS processing workflow completed successfully',
      campaignId: campaignId,
      campaignDate: campaignDate,
      phase1_results: phase1Results,
      phase2_results: phase2Results,
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