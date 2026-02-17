import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const DEFAULT_PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

/**
 * GET /api/sparkloop/admin/submissions
 *
 * Returns individual referral submissions for a specific publication (ref_code)
 * within a date range, grouped by source (custom_popup vs recs_page).
 *
 * Query params: ref_code, start (YYYY-MM-DD), end (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const refCode = searchParams.get('ref_code')
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!refCode || !start || !end) {
      return NextResponse.json(
        { success: false, error: 'ref_code, start, and end params required' },
        { status: 400 }
      )
    }

    // CST = UTC-6: midnight CST = 06:00 UTC
    const startDate = `${start}T06:00:00.000Z`
    const endDate = `${end}T06:00:00.000Z`
    // End date needs to go to next day 05:59:59 UTC (end of CST day)
    const endDateObj = new Date(endDate)
    endDateObj.setUTCDate(endDateObj.getUTCDate() + 1)
    endDateObj.setUTCMilliseconds(-1)
    const endDateCST = endDateObj.toISOString()

    const { data: referrals, error } = await supabaseAdmin
      .from('sparkloop_referrals')
      .select('subscriber_email, subscribed_at, status, source')
      .eq('publication_id', DEFAULT_PUBLICATION_ID)
      .eq('ref_code', refCode)
      .gte('subscribed_at', startDate)
      .lte('subscribed_at', endDateCST)
      .order('subscribed_at', { ascending: false })

    if (error) {
      throw new Error(`Referrals query failed: ${error.message}`)
    }

    const summary = {
      popup: { total: 0, confirmed: 0, rejected: 0, pending: 0, subscribed: 0 },
      page: { total: 0, confirmed: 0, rejected: 0, pending: 0, subscribed: 0 },
    }

    for (const r of referrals || []) {
      const bucket = r.source === 'recs_page' ? summary.page : summary.popup
      bucket.total++
      if (r.status === 'confirmed') bucket.confirmed++
      else if (r.status === 'rejected') bucket.rejected++
      else if (r.status === 'subscribed') bucket.subscribed++
      else bucket.pending++
    }

    console.log(`[SparkLoop Admin] Submissions for ${refCode} (${start} to ${end}): ${referrals?.length || 0} total`)

    return NextResponse.json({
      success: true,
      referrals: referrals || [],
      summary,
    })
  } catch (error) {
    console.error('[SparkLoop Admin] Submissions query failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
