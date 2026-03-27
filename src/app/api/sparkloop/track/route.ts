import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withApiHandler } from '@/lib/api-handler'
import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { PUBLICATION_ID } from '@/lib/config'

const VALID_EVENT_TYPES = [
  'popup_opened',
  'subscriptions_success',
  'recommendation_selected',
  'subscriptions_failed',
  'popup_skipped',
  'popup_closed',
  'recommendations_not_selected',
] as const

const VALID_SOURCES = ['custom_popup', 'recs_page', 'newsletter_module'] as const

const trackEventSchema = z.object({
  event_type: z.enum(VALID_EVENT_TYPES),
  subscriber_email: z.string().email().max(254),
  ref_codes: z.array(z.string().max(64)).max(20).optional(),
  source: z.enum(VALID_SOURCES).optional(),
  recommendation_count: z.number().int().min(0).max(100).optional(),
  selected_count: z.number().int().min(0).max(100).optional(),
  timestamp: z.string().optional(),
  error_message: z.string().max(500).optional(),
})

// Simple in-memory rate limiting: max 30 events per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30

function isRateLimited(ipHash: string | null): boolean {
  if (!ipHash) return false
  const now = Date.now()
  const entry = rateLimitMap.get(ipHash)
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ipHash, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

// Periodically clean up stale entries (every 5 min)
setInterval(() => {
  const now = Date.now()
  rateLimitMap.forEach((entry, key) => {
    if (now >= entry.resetAt) rateLimitMap.delete(key)
  })
}, 5 * 60_000)

/**
 * POST /api/sparkloop/track
 *
 * Track popup interaction events for analytics
 * Stores events in sparkloop_events table
 * Also updates recommendation metrics (impressions, selections)
 */
export const POST = withApiHandler(
  { authTier: 'public', logContext: 'sparkloop-track', inputSchema: trackEventSchema },
  async ({ input, request, logger }) => {
    // Resolve publication from server-side default (no trust anchor available)
    const publicationId = PUBLICATION_ID

    const eventType = input.event_type

    // Extract IP hash for rate limiting and subscription events
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
    const ipHash = ipAddress ? createHash('sha256').update(ipAddress).digest('hex').slice(0, 16) : null

    // Rate limit check
    if (isRateLimited(ipHash)) {
      logger.warn({ ipHash }, 'Rate limited')
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // Build metadata for raw_payload
    const metadata: Record<string, unknown> = {
      source: input.source || 'custom_popup',
      event_type: input.event_type,
      recommendation_count: input.recommendation_count,
      selected_count: input.selected_count,
      ref_codes: input.ref_codes,
      error_message: input.error_message,
      client_timestamp: input.timestamp,
      ...(eventType === 'subscriptions_success' && { ip_hash: ipHash }),
    }

    // Store event in sparkloop_events table
    const { error } = await supabaseAdmin
      .from('sparkloop_events')
      .insert({
        publication_id: publicationId,
        event_type: eventType,
        subscriber_email: input.subscriber_email,
        raw_payload: metadata,
        event_timestamp: input.timestamp ? new Date(input.timestamp).toISOString() : new Date().toISOString(),
      })

    if (error && error.code !== '23505') {
      logger.error({ error }, 'Failed to store event')
    }

    // Update recommendation metrics based on event type
    if (input.ref_codes && input.ref_codes.length > 0) {
      try {
        if (eventType === 'popup_opened') {
          // Record impressions -- route to popup or page column based on source
          const isRecsPage = input.source === 'recs_page'
          const rpcName = isRecsPage
            ? 'increment_sparkloop_page_impressions'
            : 'increment_sparkloop_impressions'
          await supabaseAdmin.rpc(rpcName, {
            p_publication_id: publicationId,
            p_ref_codes: input.ref_codes,
          })
          logger.info({ count: input.ref_codes.length, source: isRecsPage ? 'page' : 'popup' }, 'Recorded impressions')
        } else if (eventType === 'subscriptions_success') {
          // Record confirmed impressions — this subscriber actually completed signup.
          // Look up the ref_codes shown in their popup_opened event.
          const isRecsPage = input.source === 'recs_page'
          const { data: openEvent } = await supabaseAdmin
            .from('sparkloop_events')
            .select('raw_payload')
            .eq('publication_id', publicationId)
            .eq('event_type', 'popup_opened')
            .eq('subscriber_email', input.subscriber_email)
            .order('event_timestamp', { ascending: false })
            .limit(1)
            .maybeSingle()

          const shownRefCodes = (openEvent?.raw_payload as Record<string, unknown>)?.ref_codes as string[] | null
          if (shownRefCodes && shownRefCodes.length > 0) {
            // Validate ref_codes exist in our recommendations before incrementing
            const { data: validRecs } = await supabaseAdmin
              .from('sparkloop_recommendations')
              .select('ref_code')
              .eq('publication_id', publicationId)
              .in('ref_code', shownRefCodes)

            const validRefCodes = (validRecs ?? []).map(r => r.ref_code)
            if (validRefCodes.length > 0) {
              const rpcName = isRecsPage
                ? 'increment_sparkloop_confirmed_page_impressions'
                : 'increment_sparkloop_confirmed_impressions'
              const { error: rpcErr } = await supabaseAdmin.rpc(rpcName, {
                p_publication_id: publicationId,
                p_ref_codes: validRefCodes,
              })
              if (rpcErr) {
                logger.warn({ rpcName, error: rpcErr.message }, 'Confirmed impressions RPC failed')
              }
              logger.info({ count: validRefCodes.length, source: isRecsPage ? 'page' : 'popup' }, 'Recorded confirmed impressions')
            }
          }
        } else if (eventType === 'recommendation_selected') {
          // Record selection for the selected recommendation
          await supabaseAdmin.rpc('increment_sparkloop_selections', {
            p_publication_id: publicationId,
            p_ref_codes: input.ref_codes,
          })
          logger.info({ refCode: input.ref_codes[0] }, 'Recorded selection')
        }
      } catch (metricsError) {
        logger.error({ error: metricsError }, 'Failed to update metrics')
        // Don't fail the request for metrics errors
      }
    }

    logger.info({ eventType, ipHash }, 'Event recorded')

    return NextResponse.json({ success: true })
  }
)
