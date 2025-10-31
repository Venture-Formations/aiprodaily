import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'
import { ScheduleChecker } from '@/lib/schedule-checker'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'
import { PromptSelector } from '@/lib/prompt-selector'
import { executeStep1 } from '@/app/api/rss/combined-steps/step1-archive-fetch'
import { executeStep2 } from '@/app/api/rss/combined-steps/step2-extract-score'
import { executeStep3 } from '@/app/api/rss/combined-steps/step3-generate'
import { executeStep4 } from '@/app/api/rss/combined-steps/step4-finalize'

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


    // Initialize RSS processor
    const rssProcessor = new RSSProcessor()

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

    const steps = [
      { name: 'Archive+Fetch', fn: () => executeStep1(campaignId!) },
      { name: 'Extract+Score', fn: () => executeStep2(campaignId!) },
      { name: 'Generate', fn: () => executeStep3(campaignId!) },
      { name: 'Finalize', fn: () => executeStep4(campaignId!) }
    ]

    const results: any[] = []

    try {
      // Execute each step with retry logic
      for (const step of steps) {
        let stepSuccessful = false
        let attempt = 1

        while (attempt <= 2 && !stepSuccessful) {
          try {
            const result = await step.fn()
            results.push({ step: step.name, success: true, ...result })
            stepSuccessful = true
          } catch (error) {
            console.error(`[RSS] ${step.name} failed (attempt ${attempt}/2):`, error)
            attempt++

            if (attempt > 2) {
              throw new Error(`${step.name} failed after 2 attempts`)
            }
          }
        }

        if (!stepSuccessful) {
          throw new Error(`Failed to complete ${step.name}`)
        }
      }

    } catch (stepError) {
      console.error('Failed to complete RSS processing:', stepError)

      // Mark campaign as failed
      try {
        await supabaseAdmin
          .from('newsletter_campaigns')
          .update({ status: 'failed' })
          .eq('id', campaignId)
      } catch (updateError) {
        console.error('Failed to update campaign status:', updateError)
      }

      throw stepError
    }


    return NextResponse.json({
      success: true,
      message: 'RSS processing completed successfully',
      campaignId: campaignId,
      campaignDate: campaignDate,
      steps_completed: results.map(r => r.step),
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

    const steps = [
      { name: 'Archive+Fetch', fn: () => executeStep1(campaignId!) },
      { name: 'Extract+Score', fn: () => executeStep2(campaignId!) },
      { name: 'Generate', fn: () => executeStep3(campaignId!) },
      { name: 'Finalize', fn: () => executeStep4(campaignId!) }
    ]

    const results: any[] = []

    try {
      // Execute each step with retry logic
      for (const step of steps) {
        let stepSuccessful = false
        let attempt = 1

        while (attempt <= 2 && !stepSuccessful) {
          try {
            const result = await step.fn()
            results.push({ step: step.name, success: true, ...result })
            stepSuccessful = true
          } catch (error) {
            console.error(`[RSS] ${step.name} failed (attempt ${attempt}/2):`, error)
            attempt++

            if (attempt > 2) {
              throw new Error(`${step.name} failed after 2 attempts`)
            }
          }
        }

        if (!stepSuccessful) {
          throw new Error(`Failed to complete ${step.name}`)
        }
      }

    } catch (stepError) {
      console.error('Failed to complete RSS processing:', stepError)

      // Mark campaign as failed
      try {
        await supabaseAdmin
          .from('newsletter_campaigns')
          .update({ status: 'failed' })
          .eq('id', campaignId)
      } catch (updateError) {
        console.error('Failed to update campaign status:', updateError)
      }

      throw stepError
    }


    return NextResponse.json({
      success: true,
      message: 'RSS processing completed successfully',
      campaignId: campaignId,
      campaignDate: campaignDate,
      steps_completed: results.map(r => r.step),
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