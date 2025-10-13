import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      body: adBody,
      word_count,
      business_name,
      contact_name,
      contact_email,
      contact_phone,
      business_address,
      business_website,
      frequency,
      times,
      preferred_start_date,
      total_amount
    } = body

    // Validation
    if (!title || !adBody || !business_name || !contact_name || !contact_email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!frequency || !times || !total_amount) {
      return NextResponse.json({ error: 'Invalid pricing information' }, { status: 400 })
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY

    if (!stripeSecretKey) {
      console.error('Stripe secret key not configured')
      return NextResponse.json({ error: 'Payment system not configured' }, { status: 500 })
    }

    // Create line item for Stripe
    const frequencyLabel = frequency === 'single' ? 'Single' : frequency === 'weekly' ? 'Weekly' : 'Monthly'
    const lineItem = {
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${frequencyLabel} Advertisement - ${business_name}`,
          description: `${times} appearance(s) in St. Cloud Scoop Newsletter`
        },
        unit_amount: Math.round(total_amount * 100) // Convert to cents
      },
      quantity: 1
    }

    // Create metadata for Stripe
    const metadata = {
      type: 'advertisement',
      business_name,
      contact_email,
      frequency,
      times: times.toString(),
      preferred_start_date: preferred_start_date || ''
    }

    // Create Stripe Checkout session
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'mode': 'payment',
        'success_url': `${process.env.NEXT_PUBLIC_URL || 'https://st-cloud-scoop.vercel.app'}/ads/success?session_id={CHECKOUT_SESSION_ID}`,
        'cancel_url': `${process.env.NEXT_PUBLIC_URL || 'https://st-cloud-scoop.vercel.app'}/ads/submit`,
        'customer_email': contact_email,
        'line_items[0][price_data][currency]': lineItem.price_data.currency,
        'line_items[0][price_data][product_data][name]': lineItem.price_data.product_data.name,
        'line_items[0][price_data][product_data][description]': lineItem.price_data.product_data.description,
        'line_items[0][price_data][unit_amount]': lineItem.price_data.unit_amount.toString(),
        'line_items[0][quantity]': lineItem.quantity.toString(),
        ...Object.fromEntries(
          Object.entries(metadata).map(([key, value]) => [`metadata[${key}]`, value])
        )
      })
    })

    if (!stripeResponse.ok) {
      const error = await stripeResponse.text()
      console.error('Stripe API error:', error)
      throw new Error('Failed to create checkout session')
    }

    const session = await stripeResponse.json()

    // Store ad submission in advertisements table with pending_payment status
    const { data: ad, error: insertError } = await supabaseAdmin
      .from('advertisements')
      .insert({
        title,
        body: adBody,
        word_count,
        business_name,
        contact_name,
        contact_email,
        contact_phone,
        business_address,
        business_website,
        frequency,
        times_paid: times,
        times_used: 0,
        status: 'pending_payment',
        preferred_start_date,
        payment_intent_id: session.id,
        payment_amount: total_amount,
        payment_status: 'pending',
        submission_date: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to store ad submission:', insertError)
      // Continue anyway - can be processed via webhook
    } else {
      console.log(`[Checkout] Created ad submission ID: ${ad.id} for session: ${session.id}`)
    }

    return NextResponse.json({
      sessionUrl: session.url,
      sessionId: session.id,
      adId: ad?.id
    })

  } catch (error) {
    console.error('Checkout creation failed:', error)
    return NextResponse.json({
      error: 'Failed to create checkout session',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
