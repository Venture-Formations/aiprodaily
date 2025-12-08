import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const EXPECTED_PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

export async function GET(request: NextRequest) {
  try {
    // Get all ai_applications ordered by most recent
    const { data: allApps, error: allError } = await supabaseAdmin
      .from('ai_applications')
      .select('id, app_name, is_active, is_featured, is_paid_placement, publication_id, submission_status, created_at, approved_at')
      .order('created_at', { ascending: false })
      .limit(20)

    // Get active apps with correct publication_id (what should show on /tools)
    const { data: activeApps, error: activeError } = await supabaseAdmin
      .from('ai_applications')
      .select('id, app_name, is_active, is_featured, is_paid_placement, publication_id, submission_status')
      .eq('publication_id', EXPECTED_PUBLICATION_ID)
      .eq('is_active', true)
      .order('is_paid_placement', { ascending: false })
      .order('is_featured', { ascending: false })
      .order('app_name', { ascending: true })
      .limit(20)

    // Find apps that are is_active=true but don't match expected publication_id
    const mismatched = allApps?.filter(app =>
      app.is_active === true && app.publication_id !== EXPECTED_PUBLICATION_ID
    ) || []

    // Find recently approved apps
    const recentlyApproved = allApps?.filter(app => app.approved_at) || []

    return NextResponse.json({
      expected_publication_id: EXPECTED_PUBLICATION_ID,
      all_recent_apps: {
        count: allApps?.length || 0,
        data: allApps,
        error: allError?.message || null
      },
      active_apps_visible_on_tools_page: {
        count: activeApps?.length || 0,
        data: activeApps,
        error: activeError?.message || null
      },
      diagnosis: {
        mismatched_publication_ids: mismatched.map(app => ({
          id: app.id,
          app_name: app.app_name,
          actual_publication_id: app.publication_id,
          is_active: app.is_active
        })),
        recently_approved: recentlyApproved.map(app => ({
          id: app.id,
          app_name: app.app_name,
          publication_id: app.publication_id,
          is_active: app.is_active,
          approved_at: app.approved_at,
          matches_expected: app.publication_id === EXPECTED_PUBLICATION_ID
        }))
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check tool visibility',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
