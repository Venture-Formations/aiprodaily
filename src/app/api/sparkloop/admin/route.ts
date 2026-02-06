import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Default publication ID for AI Pro Daily
const DEFAULT_PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

/**
 * GET /api/sparkloop/admin
 *
 * Get all recommendations for admin management
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all' // all, active, excluded

    let query = supabaseAdmin
      .from('sparkloop_recommendations')
      .select('*')
      .eq('publication_id', DEFAULT_PUBLICATION_ID)
      .order('excluded', { ascending: true })
      .order('cpa', { ascending: false, nullsFirst: false })

    if (filter === 'active') {
      query = query.eq('status', 'active').or('excluded.is.null,excluded.eq.false')
    } else if (filter === 'excluded') {
      query = query.eq('excluded', true)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    // Calculate scores for each recommendation
    const withScores = (data || []).map(rec => {
      const cr = rec.our_cr !== null ? rec.our_cr / 100 : 0.10
      const rcr = rec.our_rcr !== null
        ? rec.our_rcr / 100
        : (rec.sparkloop_rcr !== null ? rec.sparkloop_rcr / 100 : 0.25)
      const cpa = (rec.cpa || 0) / 100
      const score = cr * cpa * rcr

      return {
        ...rec,
        calculated_score: score,
        effective_cr: rec.our_cr !== null ? rec.our_cr : 10,
        effective_rcr: rec.our_rcr !== null ? rec.our_rcr : (rec.sparkloop_rcr || 25),
        cr_source: rec.our_cr !== null ? 'ours' : 'default',
        rcr_source: rec.our_rcr !== null ? 'ours' : (rec.sparkloop_rcr !== null ? 'sparkloop' : 'default'),
      }
    })

    // Get full counts from unfiltered data
    const { data: allData } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('status, excluded')
      .eq('publication_id', DEFAULT_PUBLICATION_ID)

    return NextResponse.json({
      success: true,
      recommendations: withScores,
      counts: {
        total: allData?.length || 0,
        active: allData?.filter(r => r.status === 'active' && !r.excluded).length || 0,
        excluded: allData?.filter(r => r.excluded).length || 0,
        paused: allData?.filter(r => r.status === 'paused').length || 0,
        archived: allData?.filter(r => r.status === 'archived' || r.status === 'awaiting_approval').length || 0,
      },
    })
  } catch (error) {
    console.error('[SparkLoop Admin] Failed to fetch recommendations:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/sparkloop/admin
 *
 * Update recommendation (exclude/reactivate)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, excluded, excluded_reason } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Recommendation ID is required' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {
      excluded: excluded ?? false,
      excluded_reason: excluded ? (excluded_reason || 'manual_exclusion') : null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    console.log(`[SparkLoop Admin] ${excluded ? 'Excluded' : 'Reactivated'} recommendation: ${data.publication_name}`)

    return NextResponse.json({
      success: true,
      recommendation: data,
    })
  } catch (error) {
    console.error('[SparkLoop Admin] Failed to update recommendation:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/sparkloop/admin
 *
 * Bulk update recommendations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ids, excluded_reason } = body

    if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Action and IDs array are required' },
        { status: 400 }
      )
    }

    let updateData: Record<string, unknown> = {}

    if (action === 'exclude') {
      updateData = {
        excluded: true,
        excluded_reason: excluded_reason || 'bulk_exclusion',
        updated_at: new Date().toISOString(),
      }
    } else if (action === 'reactivate') {
      updateData = {
        excluded: false,
        excluded_reason: null,
        updated_at: new Date().toISOString(),
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use "exclude" or "reactivate"' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .update(updateData)
      .in('id', ids)
      .select()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    console.log(`[SparkLoop Admin] Bulk ${action}: ${data?.length || 0} recommendations`)

    return NextResponse.json({
      success: true,
      updated: data?.length || 0,
    })
  } catch (error) {
    console.error('[SparkLoop Admin] Bulk update failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
