import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { PUBLICATION_ID } from '@/lib/config'

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  const masked = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : '***'
  return `${masked}@${domain}`
}

export const GET = withApiHandler(
  { authTier: 'system', logContext: 'afteroffers/postback' },
  async ({ request, logger }) => {
    // Require AFTEROFFERS_WEBHOOK_SECRET — endpoint is closed if not configured
    const expectedSecret = process.env.AFTEROFFERS_WEBHOOK_SECRET
    if (!expectedSecret) {
      logger.error('AFTEROFFERS_WEBHOOK_SECRET is not configured — rejecting postback')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

    const authHeader = request.headers.get('authorization') || ''
    if (authHeader !== `Bearer ${expectedSecret}`) {
      logger.warn('Unauthorized AfterOffers postback attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const searchParams = url.searchParams

    const clickId = searchParams.get('click_id') || ''
    const revenueRaw = searchParams.get('revenue')
    const email = searchParams.get('email') || undefined
    const eventParam = searchParams.get('event') || searchParams.get('action') || undefined

    if (!clickId) {
      return NextResponse.json(
        { error: 'click_id is required' },
        { status: 400 }
      )
    }

    const eventType = eventParam && eventParam.trim() !== '' ? eventParam : 'conversion'

    let revenue: number | null = null
    if (revenueRaw != null) {
      const parsed = Number(revenueRaw)
      if (!Number.isNaN(parsed)) {
        revenue = parsed
      } else {
        logger.warn({ revenueRaw }, 'Invalid revenue value in AfterOffers postback')
      }
    }

    const rawPayload = Object.fromEntries(searchParams.entries())

    // Upsert to handle webhook replays — unique on (publication_id, click_id, event_type)
    const { error } = await supabaseAdmin
      .from('afteroffers_events')
      .upsert(
        {
          publication_id: PUBLICATION_ID,
          click_id: clickId,
          email,
          revenue,
          event_type: eventType,
          raw_payload: rawPayload,
        },
        { onConflict: 'publication_id,click_id,event_type' }
      )

    if (error) {
      logger.error({ err: error, clickId }, 'Failed to store AfterOffers event')
      throw new Error(`Database error: ${error.message}`)
    }

    logger.info(
      {
        clickId,
        maskedEmail: email ? maskEmail(email) : undefined,
        revenue,
        eventType,
      },
      'Recorded AfterOffers postback event'
    )

    return NextResponse.json({ success: true })
  }
)
