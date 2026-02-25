import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

/**
 * GET /api/campaigns/[id]/ai-app-modules
 * Fetches AI app module selections for an issue
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]/ai-app-modules' },
  async ({ params }) => {
    const issueId = params.id

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

    // Fetch selections for this issue from new module system
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

    // If no selections in new system, check legacy issue_ai_app_selections table
    let legacyAppIds: string[] = []
    if (allAppIds.length === 0) {
      const { data: legacySelections } = await supabaseAdmin
        .from('issue_ai_app_selections')
        .select('app_id')
        .eq('issue_id', issueId)
        .order('selection_order', { ascending: true })

      if (legacySelections && legacySelections.length > 0) {
        legacyAppIds = legacySelections.map(s => s.app_id)
      }
    }

    // Combine app IDs (new system takes priority)
    const combinedAppIds = allAppIds.length > 0 ? allAppIds : legacyAppIds

    // Fetch all apps
    let apps: any[] = []
    if (combinedAppIds.length > 0) {
      const { data: appsData, error: appsError } = await supabaseAdmin
        .from('ai_applications')
        .select('id, app_name, tagline, description, app_url, logo_url, category, is_affiliate')
        .in('id', combinedAppIds)

      if (appsError) {
        throw appsError
      }
      apps = appsData || []
    }

    // If using legacy data, create a synthetic selection for display
    let finalSelections = selections || []
    if (allAppIds.length === 0 && legacyAppIds.length > 0 && modules && modules.length > 0) {
      // Create a synthetic selection using the first module
      finalSelections = [{
        id: 'legacy',
        issue_id: issueId,
        ai_app_module_id: modules[0].id,
        app_ids: legacyAppIds,
        selection_mode: 'legacy',
        selected_at: null,
        used_at: null
      }]
    }

    return NextResponse.json({
      modules: modules || [],
      selections: finalSelections,
      apps
    })
  }
)
