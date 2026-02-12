import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const DEFAULT_PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

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
 * Auth: Bearer token via MAKE_WEBHOOK_SECRET env var
 */
export async function POST(request: NextRequest) {
  // Verify auth
  const authHeader = request.headers.get('authorization')
  const expectedSecret = process.env.MAKE_WEBHOOK_SECRET
  if (expectedSecret) {
    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
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
      .eq('publication_id', DEFAULT_PUBLICATION_ID)
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
  } catch (error) {
    console.error('[SparkLoop FB] Failed:', error)
    return NextResponse.json(
      { error: 'Failed to update', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
