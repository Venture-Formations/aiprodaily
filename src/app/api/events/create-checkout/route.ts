import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { events, total } = await request.json()

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({
        error: 'No events provided'
      }, { status: 400 })
    }

    if (!total || total <= 0) {
      return NextResponse.json({
        error: 'Invalid total amount'
      }, { status: 400 })
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY

    if (!stripeSecretKey) {
      console.error('Stripe secret key not configured')
      return NextResponse.json({
        error: 'Payment system not configured'
      }, { status: 500 })
    }

    // Validate submitter information
    const submitterEmail = events[0]?.submitter_email
    const submitterName = events[0]?.submitter_name

    if (!submitterEmail || !submitterName) {
      return NextResponse.json({
        error: 'Submitter information required'
      }, { status: 400 })
    }

    // Create line items for Stripe
    const lineItems = events.map((event: any) => {
      let name = event.title
      let price = 0

      if (event.paid_placement) {
        name += ' - Paid Placement'
        price = 500 // $5.00 in cents
      } else if (event.featured) {
        name += ' - Featured Event'
        price = 1500 // $15.00 in cents
      }

      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: name,
            description: `Event at ${event.venue}`,
          },
          unit_amount: price,
        },
        quantity: 1,
      }
    }).filter((item: any) => item.price_data.unit_amount > 0)

    if (lineItems.length === 0) {
      return NextResponse.json({
        error: 'No paid items in cart'
      }, { status: 400 })
    }

    // Store events data in metadata (Stripe has 500 char limit per value, so we'll use a reference ID)
    const sessionId = `session_${Date.now()}`

    // Store the full event data in session storage on the server side
    // For now, we'll pass minimal metadata and handle the rest via success webhook
    const metadata = {
      session_id: sessionId,
      event_count: events.length.toString(),
      submitter_email: events[0].submitter_email,
      submitter_name: events[0].submitter_name
    }

    // Create Stripe Checkout session
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'mode': 'payment',
        'success_url': `${process.env.NEXT_PUBLIC_URL || 'https://st-cloud-scoop.vercel.app'}/events/success?session_id={CHECKOUT_SESSION_ID}`,
        'cancel_url': `${process.env.NEXT_PUBLIC_URL || 'https://st-cloud-scoop.vercel.app'}/events/checkout`,
        'customer_email': events[0].submitter_email,
        ...Object.fromEntries(
          lineItems.flatMap((item: any, index: number) => [
            [`line_items[${index}][price_data][currency]`, item.price_data.currency],
            [`line_items[${index}][price_data][product_data][name]`, item.price_data.product_data.name],
            [`line_items[${index}][price_data][product_data][description]`, item.price_data.product_data.description],
            [`line_items[${index}][price_data][unit_amount]`, item.price_data.unit_amount.toString()],
            [`line_items[${index}][quantity]`, item.quantity.toString()],
          ])
        ),
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

    // Store events data in pending_event_submissions table
    // This will be retrieved by the webhook handler after successful payment
    const { error: insertError } = await supabaseAdmin
      .from('pending_event_submissions')
      .insert({
        stripe_session_id: session.id,
        events_data: events,
        submitter_email: submitterEmail,
        submitter_name: submitterName,
        total_amount: total,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        processed: false
      })

    if (insertError) {
      console.error('Failed to store pending submission:', insertError)
      // Continue anyway - webhook can still process without this record
      // but log it for debugging
    }

    console.log(`[Checkout] Created pending submission for session: ${session.id}`)
    console.log(`[Checkout] Events count: ${events.length}, Total: $${total}`)

    return NextResponse.json({
      checkout_url: session.url,
      session_id: session.id
    })

  } catch (error) {
    console.error('Checkout creation failed:', error)
    return NextResponse.json({
      error: 'Failed to create checkout session',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
