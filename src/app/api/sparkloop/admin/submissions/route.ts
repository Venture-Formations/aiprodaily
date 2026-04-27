import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { buildDateRangeBoundaries, type SupportedTz } from '@/lib/date-utils'

/**
 * GET /api/sparkloop/admin/submissions
 *
 * Returns individual referral submissions for a specific publication (ref_code)
 * within a date range, grouped by source (custom_popup vs recs_page).
 *
 * Query params: ref_code, start (YYYY-MM-DD), end (YYYY-MM-DD)
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'sparkloop/admin/submissions', requirePublicationId: true },
  async ({ request, publicationId, logger }) => {
    const { searchParams } = new URL(request.url)
    const refCode = searchParams.get('ref_code')
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    const tz = (searchParams.get('tz') || 'CST') as SupportedTz

    if (!refCode || !start || !end) {
      return NextResponse.json(
        { success: false, error: 'ref_code, start, and end params required' },
        { status: 400 }
      )
    }

    const { startDate: startDateObj, endDate: endDateObj } = buildDateRangeBoundaries(start, end, tz)
    const startDate = startDateObj.toISOString()
    const endDateFinal = endDateObj.toISOString()

    const { data: referrals, error } = await supabaseAdmin
      .from('sparkloop_referrals')
      .select('subscriber_email, subscribed_at, status, source')
      .eq('publication_id', publicationId)
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
