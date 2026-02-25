import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { PUBLICATION_ID } from '@/lib/config'

/**
 * POST /api/sparkloop/fb-conversion
 *
 * Called by Make after sending a subscriber conversion to Facebook.
 * Marks all SparkLoop referrals for that subscriber with fb_conversion_sent_at.
 *
 * Expected payload (from Make HTTP module):
 * {
 *   "email": "subscriber@example.com"
 * }
 *
 * Auth: System tier via withApiHandler + additional MAKE_WEBHOOK_SECRET check
 */
export const POST = withApiHandler(
  { authTier: 'system', logContext: 'sparkloop/fb-conversion' },
  async ({ request }) => {
    // Additional auth: verify MAKE_WEBHOOK_SECRET (kept inside handler per migration notes)
    const authHeader = request.headers.get('authorization')
    const expectedSecret = process.env.MAKE_WEBHOOK_SECRET
    if (expectedSecret) {
      if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await request.json()
    const email = body.email || body.subscriber_email

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Mark all SparkLoop referrals for this subscriber as FB conversion sent
    const { data, error } = await supabaseAdmin
      .from('sparkloop_referrals')
      .update({ fb_conversion_sent_at: now, updated_at: now })
      .eq('publication_id', PUBLICATION_ID)
      .eq('subscriber_email', email)
      .is('fb_conversion_sent_at', null)
      .select('id, ref_code')

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    const count = data?.length || 0
    if (count > 0) {
      console.log(`[SparkLoop FB] Marked ${count} referrals as FB conversion sent for ${email}`)
    } else {
      console.log(`[SparkLoop FB] No unmarked referrals found for ${email}`)
    }

    return NextResponse.json({
      success: true,
      updated: count,
      referrals: data?.map(r => r.ref_code) || [],
    })
  }
)
