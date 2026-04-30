import { getPublicationSetting, getEmailProviderSettings } from '@/lib/publication-settings'
import { claimMakeWebhookFire, fireMakeWebhook } from './make-webhook'

export interface TriggerMakeWebhookArgs {
  publicationId: string
  subscriberEmail: string
  source: 'sparkloop' | 'afteroffers'
  subscriberId: string
}

export interface TriggerMakeWebhookResult {
  claimed: boolean
  fired: boolean
  gated: boolean
}

/**
 * Single entry point for subscribe routes to trigger the Make.com webhook.
 *
 * Decides between immediate fire (legacy behavior) and pending claim
 * (new Beehiiv first-open gate) based on per-publication settings:
 *   - make_webhook_require_first_open === 'true' AND email_provider === 'beehiiv'
 *     → claim with status='pending'; cron will fire later
 *   - Otherwise → claim with status='fired' and fire now (legacy behavior)
 *
 * If the gate setting is true but the provider is not Beehiiv, logs a warning
 * and falls back to immediate fire (the gate is Beehiiv-only by design).
 */
export async function triggerMakeWebhook(
  args: TriggerMakeWebhookArgs
): Promise<TriggerMakeWebhookResult> {
  const webhookUrl = await getPublicationSetting(args.publicationId, 'sparkloop_webhook_url')
  if (!webhookUrl || !webhookUrl.trim()) {
    return { claimed: false, fired: false, gated: false }
  }

  const [requireFirstOpen, providerSettings] = await Promise.all([
    getPublicationSetting(args.publicationId, 'make_webhook_require_first_open'),
    getEmailProviderSettings(args.publicationId),
  ])
  const settingOn = requireFirstOpen === 'true'
  const isBeehiiv = providerSettings.provider === 'beehiiv'

  let gated = settingOn && isBeehiiv
  if (settingOn && !isBeehiiv) {
    console.warn(
      `[MakeWebhook] Misconfiguration: first-open gate enabled (make_webhook_require_first_open=true) but email_provider=${providerSettings.provider} for pub=${args.publicationId}; gate is Beehiiv-only. Falling back to immediate fire.`
    )
    gated = false
  }

  const claimed = await claimMakeWebhookFire({
    publicationId: args.publicationId,
    subscriberEmail: args.subscriberEmail,
    source: args.source,
    subscriberId: args.subscriberId,
    status: gated ? 'pending' : 'fired',
  })

  if (!claimed) {
    return { claimed: false, fired: false, gated }
  }

  if (gated) {
    return { claimed: true, fired: false, gated: true }
  }

  const fired = await fireMakeWebhook(
    webhookUrl,
    {
      subscriber_email: args.subscriberEmail.trim().toLowerCase(),
      subscriber_id: args.subscriberId,
    },
    { publicationId: args.publicationId }
  )
  return { claimed: true, fired, gated: false }
}
