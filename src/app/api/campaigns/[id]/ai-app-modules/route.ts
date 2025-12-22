import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

/**
 * GET /api/campaigns/[id]/ai-app-modules
 * Fetches AI app module selections for an issue
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: issueId } = await params

    // Fetch all AI app modules for the publication
    const { data: issue } = await supabaseAdmin
      .from('publication_issues')
      .select('publication_id')
      .eq('id', issueId)
      .single()

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    // Fetch all modules for this publication
    const { data: modules, error: modulesError } = await supabaseAdmin
      .from('ai_app_modules')
      .select('*')
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (modulesError) {
      throw modulesError
    }

    // Fetch selections for this issue
    const { data: selections, error: selectionsError } = await supabaseAdmin
      .from('issue_ai_app_modules')
      .select('*')
      .eq('issue_id', issueId)

    if (selectionsError) {
      throw selectionsError
    }

    // Collect all app IDs from selections
    const allAppIds: string[] = []
    for (const selection of selections || []) {
      const appIds = selection.app_ids as string[] || []
      allAppIds.push(...appIds)
    }

    // Fetch all apps
    let apps: any[] = []
    if (allAppIds.length > 0) {
      const { data: appsData, error: appsError } = await supabaseAdmin
        .from('ai_applications')
        .select('id, app_name, tagline, description, app_url, logo_url, category, is_affiliate')
        .in('id', allAppIds)

      if (appsError) {
        throw appsError
      }
      apps = appsData || []
    }

    return NextResponse.json({
      modules: modules || [],
      selections: selections || [],
      apps
    })

  } catch (error) {
    console.error('Failed to fetch AI app modules:', error)
    return NextResponse.json({
      error: 'Failed to fetch AI app modules',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
