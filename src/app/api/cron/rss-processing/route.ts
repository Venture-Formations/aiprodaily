import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'
import { ScheduleChecker } from '@/lib/schedule-checker'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'
import { PromptSelector } from '@/lib/prompt-selector'

export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    console.log('Auth header received:', authHeader ? 'Present' : 'Missing')
    console.log('Expected format:', `Bearer ${process.env.CRON_SECRET?.substring(0, 5)}...`)

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('Authentication failed - headers:', Object.fromEntries(request.headers.entries()))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('=== AUTOMATED RSS PROCESSING CHECK ===')
    console.log('Time:', new Date().toISOString())

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

    console.log('=== RSS PROCESSING STARTED (Time Matched) ===')
    const currentCentralTime = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    console.log('Central Time:', currentCentralTime)

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

    console.log('Processing RSS for tomorrow\'s campaign date:', campaignDate)
    console.log('Debug: UTC now:', now.toISOString())
    console.log('Debug: Central date today:', centralDate)
    console.log('Debug: Central tomorrow:', campaignDate)

    // STEP 1: Create new campaign for tomorrow (allow duplicate dates)
    console.log('Creating new campaign for tomorrow...')

    // Initialize RSS processor
    const rssProcessor = new RSSProcessor()

    // Always create a new campaign (duplicate dates are now allowed)
    const { data: newCampaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .insert([{
        date: campaignDate,
        status: 'processing'
      }])
      .select()
      .single()

    if (campaignError || !newCampaign) {
      throw new Error(`Failed to create campaign: ${campaignError?.message}`)
    }

    const campaignId = newCampaign.id
    console.log('Created new campaign:', campaignId, 'for date:', campaignDate)

    // Trigger RSS processing workflow (all steps run sequentially in one endpoint)
    console.log('Starting RSS processing workflow...')

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://aiprodaily.vercel.app'

    try {
      const response = await fetch(`${baseUrl}/api/rss/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`
        },
        body: JSON.stringify({ campaign_id: campaignId })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(`RSS processing failed: ${result.message || 'Unknown error'}`)
      }

      console.log('✅ RSS processing completed successfully')
      console.log('All steps executed:', result.results?.map((r: any) => r.step).join(' → '))
    } catch (stepError) {
      console.error('Failed to complete RSS processing:', stepError)
      throw stepError
    }

    console.log('=== RSS PROCESSING WORKFLOW COMPLETED ===')
    console.log('All 6 steps completed sequentially:')
    console.log('Archive → Fetch Feeds → Extract Articles → Score Posts → Generate Articles → Finalize')

    return NextResponse.json({
      success: true,
      message: 'Step-based RSS processing workflow initiated successfully',
      campaignId: campaignId,
      campaignDate: campaignDate,
      note: 'Processing will continue in background with no time limits',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('=== RSS PROCESSING FAILED ===')
    console.error('Error:', error)

    return NextResponse.json({
      success: false,
      error: 'RSS processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Handle GET requests from Vercel cron (no auth header, uses URL secret)
export async function GET(request: NextRequest) {
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

    console.log('=== AUTOMATED RSS PROCESSING CHECK (GET) ===')
    console.log('Time:', new Date().toISOString())
    console.log('Request type:', isVercelCron ? 'Vercel Cron' : 'Manual Test')

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

    console.log('=== RSS PROCESSING STARTED (Time Matched) ===')
    const currentCentralTime = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    console.log('Central Time:', currentCentralTime)

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

    console.log('Processing RSS for tomorrow\'s campaign date:', campaignDate)
    console.log('Debug: UTC now:', now.toISOString())
    console.log('Debug: Central date today:', centralDate)
    console.log('Debug: Central tomorrow:', campaignDate)

    // STEP 1: Create new campaign for tomorrow (allow duplicate dates)
    console.log('Creating new campaign for tomorrow...')

    // Always create a new campaign (duplicate dates are now allowed)
    const { data: newCampaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .insert([{
        date: campaignDate,
        subject_line: '', // Will be generated later
        status: 'processing',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select('id')
      .single()

    if (campaignError || !newCampaign) {
      throw new Error(`Failed to create campaign: ${campaignError?.message}`)
    }

    const campaignId = newCampaign.id
    console.log('Created new campaign:', campaignId, 'for date:', campaignDate)

    // Select prompt for the campaign immediately after creation
    console.log('Selecting prompt for campaign...')
    const selectedPrompt = await PromptSelector.selectPromptForCampaign(campaignId)
    if (selectedPrompt) {
      console.log(`Selected prompt: ${selectedPrompt.title}`)
    } else {
      console.log('No prompts available for selection')
    }

    // Select AI apps for the campaign
    console.log('=== SELECTING AI APPS FOR CAMPAIGN ===')
    try {
      const { AppSelector } = await import('@/lib/app-selector')

      // Get the first active newsletter (dynamic, not hardcoded to 'accounting')
      const { data: newsletter, error: newsletterError } = await supabaseAdmin
        .from('newsletters')
        .select('id, name, slug')
        .eq('is_active', true)
        .limit(1)
        .single()

      if (newsletterError) {
        console.error('Error fetching newsletter:', newsletterError)
        throw new Error(`Newsletter fetch error: ${newsletterError.message}`)
      }

      if (newsletter) {
        console.log(`Found newsletter: ${newsletter.name} (${newsletter.slug}, ID: ${newsletter.id})`)
        console.log(`Calling AppSelector.selectAppsForCampaign(${campaignId}, ${newsletter.id})...`)

        const selectedApps = await AppSelector.selectAppsForCampaign(campaignId, newsletter.id)

        console.log(`✅ Successfully selected ${selectedApps.length} AI applications`)
        console.log(`Selected apps:`, selectedApps.map(app => `${app.app_name} (${app.category})`).join(', '))
      } else {
        console.warn('⚠️ No active newsletter found, skipping AI app selection')
      }
    } catch (appSelectionError) {
      console.error('❌ CRITICAL ERROR selecting AI apps:', appSelectionError)
      console.error('Error details:', appSelectionError instanceof Error ? appSelectionError.stack : 'No stack trace')
      // Don't throw - log error but continue with RSS processing
    }
    console.log('=== AI APP SELECTION COMPLETE ===\n')

    // Trigger RSS processing workflow (all steps run sequentially in one endpoint)
    console.log('Starting RSS processing workflow...')

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://aiprodaily.vercel.app'

    try {
      const response = await fetch(`${baseUrl}/api/rss/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`
        },
        body: JSON.stringify({ campaign_id: campaignId })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(`RSS processing failed: ${result.message || 'Unknown error'}`)
      }

      console.log('✅ RSS processing completed successfully')
      console.log('All steps executed:', result.results?.map((r: any) => r.step).join(' → '))
    } catch (stepError) {
      console.error('Failed to complete RSS processing:', stepError)
      throw stepError
    }

    console.log('=== RSS PROCESSING WORKFLOW COMPLETED ===')
    console.log('All 6 steps completed sequentially:')
    console.log('Archive → Fetch Feeds → Extract Articles → Score Posts → Generate Articles → Finalize')

    return NextResponse.json({
      success: true,
      message: 'Step-based RSS processing workflow initiated successfully',
      campaignId: campaignId,
      campaignDate: campaignDate,
      note: 'Processing will continue in background with no time limits',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('=== RSS PROCESSING FAILED ===')
    console.error('Error:', error)

    return NextResponse.json({
      success: false,
      error: 'RSS processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}