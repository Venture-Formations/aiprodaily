import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'
import { PromptSelector } from '@/lib/prompt-selector'
import { AppSelector } from '@/lib/app-selector'

// Helper function to initialize AI app selection for a new campaign
async function initializeAIAppSelection(campaignId: string) {
  try {
    console.log(`Initializing AI app selection for campaign ${campaignId}`)

    // Get accounting newsletter ID
    const { data: newsletter } = await supabaseAdmin
      .from('newsletters')
      .select('id')
      .eq('slug', 'accounting')
      .single()

    if (!newsletter) {
      console.error('Accounting newsletter not found')
      return
    }

    // Use AppSelector to select apps with proper category rotation logic
    const selectedApps = await AppSelector.selectAppsForCampaign(campaignId, newsletter.id)

    if (selectedApps.length > 0) {
      console.log(`Successfully selected ${selectedApps.length} AI applications`)
    } else {
      console.log('No apps available for selection')
    }
  } catch (error) {
    console.error('Error initializing AI app selection:', error)
  }
}

// Helper function to initialize prompt ideas selection for a new campaign
async function initializePromptSelection(campaignId: string) {
  try {
    console.log(`Initializing prompt ideas selection for campaign ${campaignId}`)

    // Use PromptSelector to select ONE prompt with proper rotation logic
    const selectedPrompt = await PromptSelector.selectPromptForCampaign(campaignId)

    if (selectedPrompt) {
      console.log(`Successfully selected prompt: ${selectedPrompt.title}`)
    } else {
      console.log('No prompts available for selection')
    }
  } catch (error) {
    console.error('Error initializing prompt selection:', error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const status = url.searchParams.get('status')

    let query = supabaseAdmin
      .from('newsletter_campaigns')
      .select(`
        *,
        articles:articles(
          count
        ),
        manual_articles:manual_articles(
          count
        ),
        email_metrics(*)
      `)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: campaigns, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      campaigns: campaigns || [],
      total: campaigns?.length || 0
    })

  } catch (error) {
    console.error('Failed to fetch campaigns:', error)
    return NextResponse.json({
      error: 'Failed to fetch campaigns',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { date } = body

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    // Create new campaign (duplicate dates are now allowed)
    const { data: campaign, error } = await supabaseAdmin
      .from('newsletter_campaigns')
      .insert([{
        date,
        status: 'draft'
      }])
      .select('*')
      .single()

    if (error) {
      throw error
    }

    // Initialize all content selections for the new campaign
    console.log('Initializing campaign content selections...')

    // Run all initializations in parallel for better performance
    await Promise.all([
      initializeAIAppSelection(campaign.id),
      initializePromptSelection(campaign.id)
    ])

    console.log('Campaign content initialization completed')

    return NextResponse.json({ campaign }, { status: 201 })

  } catch (error) {
    console.error('Failed to create campaign:', error)
    return NextResponse.json({
      error: 'Failed to create campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}