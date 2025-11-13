import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/debug/reset-app-usage
 *
 * Resets app usage tracking for testing purposes
 *
 * Body params:
 * - mode: 'all' | 'affiliates' | 'non-affiliates' | 'specific'
 * - appIds: (optional) Array of app IDs to reset (when mode='specific')
 * - clearSelections: (optional) Also clear issue_ai_app_selections
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mode = 'all', appIds = [], clearSelections = false } = body

    // Get newsletter
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('slug', 'accounting')
      .single()

    if (!newsletter) {
      return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 })
    }

    let resetCount = 0

    // Reset based on mode
    switch (mode) {
      case 'all':
        // Reset all apps
        const { data: allApps } = await supabaseAdmin
          .from('ai_applications')
          .update({
            last_used_date: null,
            times_used: 0
          })
          .eq('publication_id', newsletter.id)
          .select('id')

        resetCount = allApps?.length || 0
        break

      case 'affiliates':
        // Reset only affiliate apps
        const { data: affiliateApps } = await supabaseAdmin
          .from('ai_applications')
          .update({
            last_used_date: null,
            times_used: 0
          })
          .eq('publication_id', newsletter.id)
          .eq('is_affiliate', true)
          .select('id')

        resetCount = affiliateApps?.length || 0
        break

      case 'non-affiliates':
        // Reset only non-affiliate apps
        const { data: nonAffiliateApps } = await supabaseAdmin
          .from('ai_applications')
          .update({
            last_used_date: null,
            times_used: 0
          })
          .eq('publication_id', newsletter.id)
          .eq('is_affiliate', false)
          .select('id')

        resetCount = nonAffiliateApps?.length || 0
        break

      case 'specific':
        // Reset specific apps by ID
        if (!appIds || appIds.length === 0) {
          return NextResponse.json(
            { error: 'appIds array required when mode=specific' },
            { status: 400 }
          )
        }

        const { data: specificApps } = await supabaseAdmin
          .from('ai_applications')
          .update({
            last_used_date: null,
            times_used: 0
          })
          .in('id', appIds)
          .eq('publication_id', newsletter.id)
          .select('id')

        resetCount = specificApps?.length || 0
        break

      default:
        return NextResponse.json(
          { error: 'Invalid mode. Use: all, affiliates, non-affiliates, or specific' },
          { status: 400 }
        )
    }

    // Clear issue selections if requested
    let selectionsCleared = 0
    if (clearSelections) {
      const { data: issues } = await supabaseAdmin
        .from('publication_issues')
        .select('id')
        .eq('publication_id', newsletter.id)

      if (issues && issues.length > 0) {
        const issueIds = issues.map(c => c.id)

        const { data: deleted } = await supabaseAdmin
          .from('issue_ai_app_selections')
          .delete()
          .in('issue_id', issueIds)
          .select('id')

        selectionsCleared = deleted?.length || 0
      }
    }

    return NextResponse.json({
      success: true,
      mode,
      apps_reset: resetCount,
      selections_cleared: selectionsCleared,
      message: `Reset ${resetCount} app(s)${clearSelections ? ` and cleared ${selectionsCleared} selection(s)` : ''}`
    })

  } catch (error: any) {
    console.error('Reset error:', error)
    return NextResponse.json(
      { error: 'Reset failed', details: error.message },
      { status: 500 }
    )
  }
}

export const maxDuration = 600
