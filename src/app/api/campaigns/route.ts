import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'
import { PromptSelector } from '@/lib/prompt-selector'
import { AppModuleSelector } from '@/lib/ai-app-modules'
import { ArticleModuleSelector } from '@/lib/article-modules'

// Helper function to initialize article module selections for a new issue
async function initializeArticleModuleSelection(issueId: string, publicationId: string) {
  try {
    console.log(`Initializing article module selections for issue ${issueId}`)

    // Use ArticleModuleSelector to initialize empty selections for all active article modules
    // Articles will be populated when the workflow runs
    await ArticleModuleSelector.initializeSelectionsForIssue(issueId, publicationId)

    console.log('Article module selections initialized')
  } catch (error) {
    console.error('Error initializing article module selections:', error)
  }
}

// Helper function to initialize AI app selection for a new issue
async function initializeAIAppSelection(issueId: string, publicationId: string) {
  try {
    console.log(`Initializing AI app selection for issue ${issueId}`)

    // Use AppModuleSelector to select apps for all active modules
    const results = await AppModuleSelector.selectAppsForIssue(issueId, publicationId, new Date())

    const totalApps = results.reduce((sum, r) => sum + r.result.apps.length, 0)
    if (totalApps > 0) {
      console.log(`Successfully selected ${totalApps} AI applications across ${results.length} modules`)
    } else {
      console.log('No apps available for selection')
    }
  } catch (error) {
    console.error('Error initializing AI app selection:', error)
  }
}

// Helper function to initialize prompt ideas selection for a new issue
async function initializePromptSelection(issueId: string) {
  try {
    console.log(`Initializing prompt ideas selection for issue ${issueId}`)

    // Use PromptSelector to select ONE prompt with proper rotation logic
    const selectedPrompt = await PromptSelector.selectPromptForissue(issueId)

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
    const newsletterSlug = url.searchParams.get('newsletter_slug')
    const days = url.searchParams.get('days')

    // Get publication_id from slug (REQUIRED for multi-tenant isolation)
    let newsletterId: string | undefined
    if (newsletterSlug) {
      const { data: newsletter, error: newsletterError } = await supabaseAdmin
        .from('publications')
        .select('id')
        .eq('slug', newsletterSlug)
        .single()

      if (newsletterError || !newsletter) {
        console.error('[DB] Newsletter not found:', newsletterSlug)
        return NextResponse.json({
          error: 'Newsletter not found'
        }, { status: 404 })
      }

      newsletterId = newsletter.id
    }

    let query = supabaseAdmin
      .from('publication_issues')
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

    // CRITICAL: Multi-tenant filtering (REQUIRED)
    if (newsletterId) {
      query = query.eq('publication_id', newsletterId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    // Timeframe filtering (for analytics)
    if (days) {
      const daysNum = parseInt(days)
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - daysNum)

      // Use local date strings (NO UTC conversion - per CLAUDE.md)
      const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
      const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

      query = query
        .gte('date', startDateStr)
        .lte('date', endDateStr)
    }

    const { data: campaigns, error } = await query

    if (error) {
      console.error('[DB] Query failed:', error.message)
      throw error
    }

    // Transform email_metrics from array to single object (or null)
    // Supabase returns email_metrics(*) as an array even for one-to-one relationships
    const transformedCampaigns = (campaigns || []).map((campaign: any) => ({
      ...campaign,
      email_metrics: Array.isArray(campaign.email_metrics) && campaign.email_metrics.length > 0
        ? campaign.email_metrics[0]
        : null
    }))

    return NextResponse.json({
      issues: transformedCampaigns,
      total: transformedCampaigns.length
    })

  } catch (error) {
    console.error('[API] Failed to fetch issues:', error)
    return NextResponse.json({
      error: 'Failed to fetch issues',
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

    // Get accounting newsletter ID
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('slug', 'accounting')
      .single()

    if (!newsletter) {
      return NextResponse.json({
        error: 'Accounting newsletter not found'
      }, { status: 404 })
    }

    // Create new issue (duplicate dates are now allowed)
    const { data: issue, error } = await supabaseAdmin
      .from('publication_issues')
      .insert([{
        date,
        status: 'draft',
        publication_id: newsletter.id
      }])
      .select('*')
      .single()

    if (error) {
      throw error
    }

    // Initialize all content selections for the new issue
    console.log('Initializing issue content selections...')

    // Run all initializations in parallel for better performance
    await Promise.all([
      initializeAIAppSelection(issue.id, newsletter.id),
      initializePromptSelection(issue.id),
      initializeArticleModuleSelection(issue.id, newsletter.id)
    ])

    console.log('issue content initialization completed')

    return NextResponse.json({ issue }, { status: 201 })

  } catch (error) {
    console.error('Failed to create issue:', error)
    return NextResponse.json({
      error: 'Failed to create issue',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}