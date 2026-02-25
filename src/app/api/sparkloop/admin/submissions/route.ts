import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { PUBLICATION_ID } from '@/lib/config'

/**
 * GET /api/sparkloop/admin/submissions
 *
 * Returns individual referral submissions for a specific publication (ref_code)
 * within a date range, grouped by source (custom_popup vs recs_page).
 *
 * Query params: ref_code, start (YYYY-MM-DD), end (YYYY-MM-DD)
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'sparkloop/admin/submissions' },
  async ({ request, logger }) => {
    const { searchParams } = new URL(request.url)
    const refCode = searchParams.get('ref_code')
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    const tz = searchParams.get('tz') || 'CST'

    if (!refCode || !start || !end) {
      return NextResponse.json(
        { success: false, error: 'ref_code, start, and end params required' },
        { status: 400 }
      )
    }

    // CST = UTC-6: midnight CST = 06:00 UTC; UTC = no offset
    const offset = tz === 'UTC' ? 'T00:00:00.000Z' : 'T06:00:00.000Z'
    const startDate = `${start}${offset}`
    const endDate = `${end}${offset}`
    // End date goes to end of day in the selected timezone
    const endDateObj = new Date(endDate)
    endDateObj.setUTCDate(endDateObj.getUTCDate() + 1)
    endDateObj.setUTCMilliseconds(-1)
    const endDateFinal = endDateObj.toISOString()

    const { data: referrals, error } = await supabaseAdmin
      .from('sparkloop_referrals')
      .select('subscriber_email, subscribed_at, status, source')
      .eq('publication_id', PUBLICATION_ID)
      .eq('ref_code', refCode)
      .gte('subscribed_at', startDate)
      .lte('subscribed_at', endDateFinal)
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

    logger.info({ refCode, start, end, total: referrals?.length || 0 }, 'Submissions query completed')

    return NextResponse.json({
      success: true,
      referrals: referrals || [],
      summary,
    })
  }
)
