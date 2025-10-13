import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 400 })
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY

    if (!stripeSecretKey) {
      return NextResponse.json({ error: 'Payment system not configured' }, { status: 500 })
    }

    // Verify payment with Stripe
    const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`
      }
    })

    if (!stripeResponse.ok) {
      throw new Error('Failed to verify payment with Stripe')
    }

    const session = await stripeResponse.json()

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
    }

    // Update ad status to pending_review
    const { data: ad, error: updateError } = await supabaseAdmin
      .from('advertisements')
      .update({
        status: 'pending_review',
        payment_status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('payment_intent_id', sessionId)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update ad status:', updateError)
      return NextResponse.json({ error: 'Failed to update ad status' }, { status: 500 })
    }

    console.log(`[Verify Payment] Updated ad ${ad.id} to pending_review status`)

    return NextResponse.json({
      success: true,
      ad: {
        id: ad.id,
        title: ad.title,
        status: ad.status
      }
    })

  } catch (error) {
    console.error('Payment verification failed:', error)
    return NextResponse.json({
      error: 'Failed to verify payment',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
