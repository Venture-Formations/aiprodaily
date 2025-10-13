import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'
import { GmailService } from '@/lib/gmail-service'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const { reason } = await request.json()

    // Get event details to check if refund is needed
    const { data: event, error: fetchError } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    let refundResult = null

    // If this was a paid event, process refund
    if (event.payment_intent_id && event.payment_status === 'completed' && event.payment_amount && event.payment_amount > 0) {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY

      if (stripeSecretKey) {
        try {
          console.log(`[Reject] Processing refund for event ${id}, payment: ${event.payment_intent_id}`)

          // Get payment intent to find the charge ID
          const paymentResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${event.payment_intent_id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${stripeSecretKey}`,
            }
          })

          if (paymentResponse.ok) {
            const checkoutSession = await paymentResponse.json()
            const paymentIntentId = checkoutSession.payment_intent

            if (paymentIntentId) {
              // Create partial refund for only this event's amount
              const refundAmount = Math.round(event.payment_amount * 100) // Convert to cents

              console.log(`[Reject] Creating partial refund of $${event.payment_amount} (${refundAmount} cents)`)

              const refundResponse = await fetch('https://api.stripe.com/v1/refunds', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${stripeSecretKey}`,
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  'payment_intent': paymentIntentId,
                  'amount': refundAmount.toString(), // Partial refund for just this event
                  'reason': 'requested_by_customer',
                  'metadata[event_id]': id,
                  'metadata[event_title]': event.title,
                  'metadata[rejection_reason]': reason || 'Event rejected by admin'
                })
              })

              if (refundResponse.ok) {
                const refund = await refundResponse.json()
                console.log(`[Reject] Refund successful: ${refund.id}`)
                refundResult = {
                  success: true,
                  refund_id: refund.id,
                  amount: refund.amount / 100
                }

                // Update payment status
                await supabaseAdmin
                  .from('events')
                  .update({
                    payment_status: 'refunded'
                  })
                  .eq('id', id)
              } else {
                const errorText = await refundResponse.text()
                console.error('[Reject] Refund failed:', errorText)
                refundResult = {
                  success: false,
                  error: errorText
                }
              }
            }
          }
        } catch (refundError) {
          console.error('[Reject] Refund error:', refundError)
          refundResult = {
            success: false,
            error: refundError instanceof Error ? refundError.message : 'Unknown refund error'
          }
        }
      }
    }

    // Update event status
    const { error } = await supabaseAdmin
      .from('events')
      .update({
        submission_status: 'rejected',
        active: false,
        reviewed_by: session.user?.email || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) throw error

    // Send rejection email
    if (event.submitter_email) {
      const gmail = new GmailService()
      await gmail.sendEventRejectionEmail({
        title: event.title,
        description: event.description,
        start_date: event.start_date,
        submitter_email: event.submitter_email,
        submitter_name: event.submitter_name || 'Event Submitter'
      }, reason)
    }

    // Log the rejection
    if (session.user?.email) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

      if (user) {
        await supabaseAdmin
          .from('user_activities')
          .insert([{
            user_id: user.id,
            action: 'event_submission_rejected',
            details: {
              event_id: id,
              reason: reason || 'No reason provided'
            }
          }])
      }
    }

    return NextResponse.json({
      success: true,
      refund: refundResult
    })

  } catch (error) {
    console.error('Failed to reject submission:', error)
    return NextResponse.json({
      error: 'Failed to reject submission',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
