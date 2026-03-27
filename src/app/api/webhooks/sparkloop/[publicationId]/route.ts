import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { getSparkLoopCredentials } from '@/lib/publication-settings'
import { dispatchWebhookEvent } from '@/lib/sparkloop-client/webhook-handlers'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function safeTokenCompare(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(provided, 'utf8')
    const b = Buffer.from(expected, 'utf8')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * POST /api/webhooks/sparkloop/[publicationId]
 *
 * Per-publication SparkLoop webhook endpoint.
 * Each publication configures this URL in their SparkLoop dashboard.
 *
 * Security:
 * - Validates publicationId is a real, active publication
 * - Fails closed: rejects if no webhook secret is configured
 * - Uses timing-safe comparison for token verification
 * - Returns uniform 401 for all auth failures (no enumeration)
 */
export const POST = withApiHandler(
  { authTier: 'public', logContext: 'sparkloop-webhook' },
  async ({ request, params, logger }) => {
    const publicationId = params.publicationId

    // Validate UUID format
    if (!publicationId || !UUID_REGEX.test(publicationId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate publication exists and is active
    const { data: pub } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('id', publicationId)
      .eq('is_active', true)
      .single()

    if (!pub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Load credentials — fail closed if no secret configured
    const creds = await getSparkLoopCredentials(pub.id)
    if (!creds.webhookSecret) {
      logger.error(`No webhook secret configured for publication ${pub.id}`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Timing-safe token comparison
    const token = request.headers.get('sparkloop-token') || ''
    if (!token || !safeTokenCompare(token, creds.webhookSecret)) {
      logger.error(`Invalid token for publication ${pub.id}`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Token verified')

    // Parse payload
    let payload
    try {
      payload = await request.json()
      logger.info(`Received event: ${payload.event || 'unknown'}`)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // Dispatch to shared handlers with validated publication ID
    await dispatchWebhookEvent(payload, pub.id)

    return NextResponse.json({ received: true })
  }
)
