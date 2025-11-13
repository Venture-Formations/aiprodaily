import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams
    const issueId = searchParams.get('issue_id')

    // Get all AI apps
    const { data: allApps, error: appsError } = await supabaseAdmin
      .from('ai_applications')
      .select('*')
      .eq('is_active', true)
      .order('app_name')

    if (appsError) {
      return NextResponse.json({ error: appsError.message }, { status: 500 })
    }

    // If issue ID provided, get selections for that issue
    let issueSelections = null
    if (issueId) {
      const { data: selections, error: selectionsError } = await supabaseAdmin
        .from('issue_ai_app_selections')
        .select(`
          *,
          app:ai_applications(*)
        `)
        .eq('issue_id', issueId)

      if (selectionsError) {
        return NextResponse.json({ error: selectionsError.message }, { status: 500 })
      }

      issueSelections = selections
    }

    // Check if accounting newsletter exists
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id, name, slug')
      .eq('slug', 'accounting')
      .single()

    return NextResponse.json({
      success: true,
      total_ai_apps: allApps?.length || 0,
      ai_apps: allApps?.map(app => ({
        id: app.id,
        name: app.app_name,
        is_active: app.is_active,
        publication_id: app.publication_id
      })),
      newsletter: newsletter || null,
      issue_id: issueId,
      issue_selections: issueSelections?.length || 0,
      selected_apps: issueSelections?.map(s => ({
        app_id: s.app_id,
        selection_order: s.selection_order,
        app_name: s.app?.app_name
      })) || []
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
