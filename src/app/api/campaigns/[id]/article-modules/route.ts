import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'
import { ArticleModuleSelector } from '@/lib/article-modules'

/**
 * GET /api/campaigns/[id]/article-modules - Get article module selections for an issue
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: issueId } = await params

    // Get the issue to get publication_id and status
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('publication_id, status')
      .eq('id', issueId)
      .single()

    if (issueError || !issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    // Get all article module selections for this issue
    let selections = await ArticleModuleSelector.getIssueArticleSelections(issueId)

    // If no selections exist and not a sent issue, initialize them
    if ((!selections || selections.length === 0) && issue.status !== 'sent') {
      await ArticleModuleSelector.initializeSelectionsForIssue(issueId, issue.publication_id)
      selections = await ArticleModuleSelector.getIssueArticleSelections(issueId)
    }

    // Get all active article modules for the publication
    const modules = await ArticleModuleSelector.getActiveModules(issue.publication_id)

    // Get publication settings for preview styling
    const { data: pubSettings } = await supabaseAdmin
      .from('publication_settings')
      .select('primary_color, secondary_color, tertiary_color, heading_font, body_font')
      .eq('publication_id', issue.publication_id)
      .single()

    return NextResponse.json({
      selections: selections || [],
      modules: modules || [],
      styles: {
        primaryColor: pubSettings?.primary_color || '#667eea',
        secondaryColor: pubSettings?.secondary_color || '#764ba2',
        tertiaryColor: pubSettings?.tertiary_color || '#ffffff',
        headingFont: pubSettings?.heading_font || 'Georgia, serif',
        bodyFont: pubSettings?.body_font || 'Arial, sans-serif'
      }
    })

  } catch (error: any) {
    console.error('[ArticleModules] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch article modules', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/campaigns/[id]/article-modules - Manually swap articles for a module
 * Body: { moduleId, articleIds } - array of article IDs to activate (in order)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: issueId } = await params
    const body = await request.json()
    const { moduleId, articleIds } = body

    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    if (!articleIds || !Array.isArray(articleIds)) {
      return NextResponse.json({ error: 'articleIds array is required' }, { status: 400 })
    }

    // Verify issue exists and is editable
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('status')
      .eq('id', issueId)
      .single()

    if (issueError || !issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    if (issue.status === 'sent') {
      return NextResponse.json({ error: 'Cannot modify articles for sent issues' }, { status: 400 })
    }

    const result = await ArticleModuleSelector.manuallySelectArticles(issueId, moduleId, articleIds)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Return updated selections
    const selections = await ArticleModuleSelector.getIssueArticleSelections(issueId)

    return NextResponse.json({
      success: true,
      selections
    })

  } catch (error: any) {
    console.error('[ArticleModules] Error swapping articles:', error)
    return NextResponse.json(
      { error: 'Failed to swap articles', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/campaigns/[id]/article-modules - Get all articles for swapping (active and inactive)
 * Query: moduleId
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: issueId } = await params
    const moduleId = request.nextUrl.searchParams.get('moduleId')

    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId query parameter is required' }, { status: 400 })
    }

    // Get all articles (active and inactive) for swapping UI
    const articles = await ArticleModuleSelector.getAllArticlesForModule(issueId, moduleId)

    return NextResponse.json({
      success: true,
      articles
    })

  } catch (error: any) {
    console.error('[ArticleModules] Error fetching swap articles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch articles for swapping', details: error.message },
      { status: 500 }
    )
  }
}
