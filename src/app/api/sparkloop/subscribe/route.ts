import { NextRequest, NextResponse } from 'next/server'
import { SparkLoopService } from '@/lib/sparkloop-client'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'

// Default publication ID for AI Pro Daily
const DEFAULT_PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

/**
 * POST /api/sparkloop/subscribe
 *
 * Subscribe a user to selected newsletter recommendations
 * Proxies to SparkLoop API to keep API key server-side
 * Also tracks submissions in our recommendation metrics
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, refCodes, countryCode } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    if (!refCodes || !Array.isArray(refCodes) || refCodes.length === 0) {
      return NextResponse.json(
        { error: 'At least one recommendation must be selected' },
        { status: 400 }
      )
    }

    const service = new SparkLoopService()

    await service.subscribeToNewsletters({
      subscriber_email: email,
      country_code: countryCode || 'US',
      recommendations: refCodes.join(','),
      utm_source: 'custom_popup',
    })

    // Record submissions in our metrics (increments submissions and pending counts)
    try {
      await supabaseAdmin.rpc('increment_sparkloop_submissions', {
        p_publication_id: DEFAULT_PUBLICATION_ID,
        p_ref_codes: refCodes,
      })
      console.log(`[SparkLoop Subscribe] Recorded ${refCodes.length} submissions`)
    } catch (metricsError) {
      console.error('[SparkLoop Subscribe] Failed to record metrics:', metricsError)
      // Don't fail the request for metrics errors
    }

    // Update MailerLite subscriber field to mark as SparkLoop participant
    try {
      const mailerlite = new MailerLiteService()
      const result = await mailerlite.updateSubscriberField(email, 'SparkLoop', true)
      if (result.success) {
        console.log(`[SparkLoop Subscribe] Updated MailerLite SparkLoop field for ${email}`)
      } else {
        console.error('[SparkLoop Subscribe] Failed to update MailerLite field:', result.error)
      }
    } catch (mailerliteError) {
      console.error('[SparkLoop Subscribe] MailerLite update error:', mailerliteError)
      // Don't fail the request for MailerLite errors
    }

    console.log(`[SparkLoop Subscribe] Successfully subscribed ${email} to ${refCodes.length} newsletters`)

    return NextResponse.json({
      success: true,
      subscribedCount: refCodes.length,
    })
  } catch (error) {
    console.error('[SparkLoop Subscribe] Failed:', error)

    return NextResponse.json(
      {
        error: 'Failed to subscribe to newsletters',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
