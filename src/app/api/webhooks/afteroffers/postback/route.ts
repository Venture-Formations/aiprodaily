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

async function handlePostback(request: Request, logger: ReturnType<typeof import('@/lib/logger').createLogger>) {
  const url = new URL(request.url)
  const searchParams = url.searchParams

  // Capture POST body if present
  let body: Record<string, unknown> | null = null
  if (request.method === 'POST') {
    try {
      body = await request.json()
    } catch {
      try {
        const text = await request.text()
        if (text) body = { _raw_text: text }
      } catch { /* no body */ }
    }
  }

  // Merge query params and body — body fields take precedence
  const params: Record<string, string> = Object.fromEntries(searchParams.entries())
  const merged = { ...params, ...(body || {}) }

  const clickId = String(merged.click_id || '') || ''
  const revenueRaw = merged.revenue != null ? String(merged.revenue) : null
  let email: string | undefined = String(merged.email || '') || undefined
  const eventParam = String(merged.event || merged.action || '') || undefined

  if (!clickId) {
    return NextResponse.json(
      { error: 'click_id is required' },
      { status: 400 }
    )
  }

  // If email missing, look up from click mapping table
  if (!email && clickId) {
    const { data: mapping } = await supabaseAdmin
      .from('afteroffers_click_mappings')
      .select('email')
      .eq('publication_id', PUBLICATION_ID)
      .eq('click_id', clickId)
      .maybeSingle()

    if (mapping?.email) {
      email = mapping.email
      logger.info({ clickId }, 'Resolved email from click mapping')
    }
  }

  const eventType = eventParam && eventParam.trim() !== '' ? eventParam.trim().toLowerCase() : 'conversion'

  let revenue: number | null = null
  if (revenueRaw != null) {
    const parsed = Number(revenueRaw)
    if (!Number.isNaN(parsed)) {
      revenue = parsed
    } else {
      logger.warn({ revenueRaw }, 'Invalid revenue value in AfterOffers postback')
    }
  }

  // Build full raw payload with headers, query params, and body
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    // Skip large/noisy headers
    if (!['cookie', 'authorization'].includes(key.toLowerCase())) {
      headers[key] = value
    }
  })

  const rawPayload = {
    method: request.method,
    query_params: params,
    body: body,
    headers,
    url: url.pathname + url.search,
  }

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
      method: request.method,
    },
    'Recorded AfterOffers postback event'
  )

  // Update email provider subscriber field for conversion events
  if (email && eventType === 'conversion') {
    try {
      const { getEmailProviderSettings } = await import('@/lib/publication-settings')
      const providerSettings = await getEmailProviderSettings(PUBLICATION_ID)

      if (providerSettings.provider === 'beehiiv') {
        const { updateBeehiivSubscriberField } = await import('@/lib/beehiiv')
        const { beehiivPublicationId, beehiivApiKey } = providerSettings
        if (beehiivPublicationId && beehiivApiKey) {
          let result = await updateBeehiivSubscriberField(email, 'afteroffers_conversion', 'true', beehiivPublicationId, beehiivApiKey)
          if (!result.success && result.error === 'Subscriber not found') {
            logger.info({ email: maskEmail(email) }, 'Subscriber not found in Beehiiv, retrying in 2s')
            await new Promise(resolve => setTimeout(resolve, 2000))
            result = await updateBeehiivSubscriberField(email, 'afteroffers_conversion', 'true', beehiivPublicationId, beehiivApiKey)
          }
          if (result.success) {
            logger.info({ email: maskEmail(email) }, 'Updated Beehiiv afteroffers_conversion field')
          } else {
            logger.warn({ error: result.error }, 'Failed to update Beehiiv afteroffers_conversion field')
          }
        }
      } else {
        const { MailerLiteService } = await import('@/lib/mailerlite/mailerlite-service')
        const mailerlite = new MailerLiteService()
        let result = await mailerlite.updateSubscriberField(email, 'afteroffers_conversion', 'true')
        if (!result.success && result.error === 'Subscriber not found') {
          logger.info({ email: maskEmail(email) }, 'Subscriber not found, retrying in 2s')
          await new Promise(resolve => setTimeout(resolve, 2000))
          result = await mailerlite.updateSubscriberField(email, 'afteroffers_conversion', 'true')
        }
        if (result.success) {
          logger.info({ email: maskEmail(email) }, 'Updated MailerLite afteroffers_conversion field')
        } else {
          logger.warn({ error: result.error }, 'Failed to update MailerLite afteroffers_conversion field')
        }
      }
    } catch (mlError: unknown) {
      const errMsg = mlError instanceof Error ? mlError.message : 'Unknown error'
      logger.error({ error: errMsg, clickId, maskedEmail: maskEmail(email) }, 'Email provider afteroffers_conversion update error (non-fatal)')
    }

    // Fire direct Make.com webhook (same setting as SparkLoop subscribes).
    // Uses the AfterOffers click_id as subscriber_id since AfterOffers does not
    // produce a SparkLoop UUID.
    try {
      const { getPublicationSetting } = await import('@/lib/publication-settings')
      const { fireMakeWebhook } = await import('@/lib/sparkloop-client')
      const webhookUrl = await getPublicationSetting(PUBLICATION_ID, 'sparkloop_webhook_url')
      await fireMakeWebhook(
        webhookUrl,
        { subscriber_email: email, subscriber_id: clickId },
        { publicationId: PUBLICATION_ID }
      )
    } catch (whErr: unknown) {
      const errMsg = whErr instanceof Error ? whErr.message : 'Unknown error'
      logger.error({ error: errMsg, clickId, maskedEmail: maskEmail(email) }, 'Make webhook error (non-fatal)')
    }
  }

  return NextResponse.json({ success: true })
}

export const GET = withApiHandler(
  { authTier: 'public', logContext: 'afteroffers/postback' },
  async ({ request, logger }) => handlePostback(request, logger)
)

export const POST = withApiHandler(
  { authTier: 'public', logContext: 'afteroffers/postback' },
  async ({ request, logger }) => handlePostback(request, logger)
)
