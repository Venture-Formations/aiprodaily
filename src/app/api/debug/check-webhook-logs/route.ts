import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')

  try {
    if (!sessionId) {
      return NextResponse.json({
        error: 'Please provide ?session_id=cs_...'
      }, { status: 400 })
    }

    // Check pending submissions
    const { data: pending, error: pendingError } = await supabaseAdmin
      .from('pending_event_submissions')
      .select('*')
      .eq('stripe_session_id', sessionId)
      .maybeSingle()

    // Check events table
    const { data: events, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('payment_intent_id', sessionId)

    // Check Vercel env vars
    const envVars = {
      STRIPE_SECRET_KEY_SET: !!process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET_SET: !!process.env.STRIPE_WEBHOOK_SECRET,
      SLACK_WEBHOOK_URL_SET: !!process.env.SLACK_WEBHOOK_URL,
      NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL || 'not set'
    }

    return NextResponse.json({
      success: true,
      session_id: sessionId,
      pending_submission: pending || 'Not found',
      pending_error: pendingError?.message || null,
      events_created: events?.length || 0,
      events: events || [],
      events_error: eventsError?.message || null,
      environment_variables: envVars,
      diagnosis: !pending
        ? '❌ No pending submission found - checkout may have failed or session ID is wrong'
        : pending.processed
          ? '✅ Already processed successfully'
          : '⚠️ Pending submission exists but not processed - webhook likely failed',
      next_steps: !pending
        ? 'Check Stripe Dashboard → Payments to verify payment succeeded'
        : !pending.processed
          ? 'Check Vercel logs for webhook errors. Try manually resending webhook from Stripe Dashboard.'
          : 'Everything looks good!'
    })

  } catch (error) {
    console.error('Check webhook logs error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
