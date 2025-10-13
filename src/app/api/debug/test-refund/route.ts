import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const testMode = request.nextUrl.searchParams.get('mode') || 'dry-run'
    const checkoutSessionId = request.nextUrl.searchParams.get('session_id')
    const partialAmount = request.nextUrl.searchParams.get('amount') // Optional: specific amount to refund in dollars

    if (!checkoutSessionId) {
      return NextResponse.json({
        error: 'Missing session_id parameter',
        usage: 'Add ?session_id=YOUR_STRIPE_SESSION_ID&mode=dry-run (or mode=live)&amount=5.00 (optional)'
      }, { status: 400 })
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY

    if (!stripeSecretKey) {
      return NextResponse.json({
        error: 'STRIPE_SECRET_KEY not configured'
      }, { status: 500 })
    }

    const results: any = {
      mode: testMode,
      checkoutSessionId,
      steps: []
    }

    // Step 1: Fetch checkout session
    results.steps.push({ step: 1, action: 'Fetching checkout session from Stripe...' })

    const sessionResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${checkoutSessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
      }
    })

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text()
      return NextResponse.json({
        error: 'Failed to fetch checkout session',
        details: errorText,
        results
      }, { status: 500 })
    }

    const checkoutSession = await sessionResponse.json()
    results.checkoutSession = {
      id: checkoutSession.id,
      payment_status: checkoutSession.payment_status,
      amount_total: checkoutSession.amount_total / 100,
      customer_email: checkoutSession.customer_details?.email,
      payment_intent: checkoutSession.payment_intent
    }

    results.steps.push({
      step: 2,
      action: 'Checkout session retrieved',
      data: results.checkoutSession
    })

    // Step 2: Get payment intent
    const paymentIntentId = checkoutSession.payment_intent

    if (!paymentIntentId) {
      return NextResponse.json({
        error: 'No payment_intent found in checkout session',
        results
      }, { status: 400 })
    }

    results.steps.push({
      step: 3,
      action: 'Payment Intent ID found',
      paymentIntentId
    })

    // Determine refund amount (partial or full)
    const refundAmountCents = partialAmount
      ? Math.round(parseFloat(partialAmount) * 100)
      : checkoutSession.amount_total

    const refundAmountDollars = refundAmountCents / 100

    results.refundType = partialAmount
      ? `Partial refund of $${refundAmountDollars}`
      : `Full refund of $${refundAmountDollars}`

    // Step 3: Check if this is a dry-run or live test
    if (testMode === 'dry-run') {
      results.steps.push({
        step: 4,
        action: 'DRY RUN MODE - Would create refund with the following parameters',
        refundRequest: {
          payment_intent: paymentIntentId,
          reason: 'requested_by_customer',
          amount: refundAmountCents,
          amountDisplay: `$${refundAmountDollars}`,
          isPartial: !!partialAmount,
          metadata: {
            event_id: 'test-event-id',
            rejection_reason: 'Test refund via debug endpoint'
          }
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Dry run completed successfully - no actual refund created',
        results,
        nextSteps: [
          'To create a real refund, use: ?session_id=YOUR_SESSION_ID&mode=live',
          'For partial refund: add &amount=5.00 (or any amount)',
          'WARNING: mode=live will actually process a refund in Stripe!'
        ]
      })
    }

    // Step 4: Create actual refund (LIVE mode)
    results.steps.push({
      step: 4,
      action: `⚠️ LIVE MODE - Creating ${partialAmount ? 'PARTIAL' : 'FULL'} refund in Stripe...`,
      amount: `$${refundAmountDollars}`
    })

    const refundParams: any = {
      'payment_intent': paymentIntentId,
      'reason': 'requested_by_customer',
      'metadata[event_id]': 'test-event',
      'metadata[rejection_reason]': 'Test refund via debug endpoint',
      'metadata[test_mode]': 'true'
    }

    // Add amount for partial refund
    if (partialAmount) {
      refundParams['amount'] = refundAmountCents.toString()
    }

    const refundResponse = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(refundParams)
    })

    if (!refundResponse.ok) {
      const errorText = await refundResponse.text()
      results.steps.push({
        step: 5,
        action: 'Refund failed',
        error: errorText
      })

      return NextResponse.json({
        success: false,
        error: 'Failed to create refund',
        details: errorText,
        results
      }, { status: 500 })
    }

    const refund = await refundResponse.json()
    results.refund = {
      id: refund.id,
      amount: refund.amount / 100,
      status: refund.status,
      created: new Date(refund.created * 1000).toISOString()
    }

    results.steps.push({
      step: 5,
      action: '✅ Refund created successfully',
      refund: results.refund
    })

    return NextResponse.json({
      success: true,
      message: '✅ Refund test completed successfully',
      results,
      warning: 'This was a LIVE refund - it has been processed in Stripe!'
    })

  } catch (error) {
    console.error('Refund test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Refund test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
