import { NextRequest, NextResponse } from 'next/server'
import { PUBLICATION_ID } from '@/lib/config'
import { dispatchWebhookEvent } from '@/lib/sparkloop-client/webhook-handlers'

/**
 * SparkLoop Webhook Handler (LEGACY)
 *
 * @deprecated Use /api/webhooks/sparkloop/[publicationId] instead.
 * This route is kept for backward compatibility with existing SparkLoop
 * webhook configurations. Migrate to the per-publication route.
 */
export async function POST(request: NextRequest) {
  console.warn('[SparkLoop Webhook] Using legacy catch-all route. Migrate to /api/webhooks/sparkloop/<publicationId>')

  const sparkloopToken = request.headers.get('sparkloop-token')
  const expectedToken = process.env.SPARKLOOP_WEBHOOK_SECRET

  // Verify webhook token if configured
  if (expectedToken) {
    if (!sparkloopToken || sparkloopToken !== expectedToken) {
      console.error('[SparkLoop Webhook] Invalid or missing SparkLoop-Token header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[SparkLoop Webhook] Token verified')
  } else {
    console.log('[SparkLoop Webhook] No secret configured, skipping token verification')
  }

  let payload
  try {
    payload = await request.json()
    console.log(`[SparkLoop Webhook] Received event: ${payload.event || 'unknown'}`)
  } catch (err) {
    console.error('[SparkLoop Webhook] Failed to parse JSON body:', err)
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    await dispatchWebhookEvent(payload, PUBLICATION_ID)
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[SparkLoop Webhook] Error processing event:', error)
    return NextResponse.json({
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
