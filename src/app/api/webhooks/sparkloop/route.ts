import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SlackNotificationService } from '@/lib/slack'

// Default publication ID (can be overridden via webhook payload or config)
const DEFAULT_PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

// SparkLoop webhook event types
const EVENT_TYPES = {
  NEW_OFFER_LEAD: 'new_offer_lead',
  NEW_REFERRAL: 'new_referral',
  NEW_PARTNER_PENDING_REFERRAL: 'new_partner_pending_referral',
  NEW_PARTNER_REFERRAL: 'new_partner_referral', // Confirmed referral
  PARTNER_REFERRAL_REJECTED: 'partner_referral_rejected',
  REWARD_UNLOCKED: 'reward_unlocked',
  REWARD_REDEEMED: 'reward_redeemed',
  SYNC_SUBSCRIBER: 'sync_subscriber',
}

/**
 * SparkLoop Webhook Handler
 *
 * Receives webhook events from SparkLoop for:
 * - new_offer_lead: When a subscriber opts into a recommended newsletter
 * - new_referral: When a subscriber generates a referral
 * - new_partner_referral: When a partner referral is confirmed
 * - reward_unlocked: When a subscriber earns a reward
 * - reward_redeemed: When a subscriber claims a reward
 * - sync_subscriber: General subscriber updates
 *
 * Configure webhooks at: SparkLoop Dashboard > Account Settings > Integrations
 */
export async function POST(request: NextRequest) {
  const sparkloopToken = request.headers.get('sparkloop-token')
  const expectedToken = process.env.SPARKLOOP_WEBHOOK_SECRET

  // Verify webhook token if configured (optional but recommended)
  // If no SPARKLOOP_WEBHOOK_SECRET is set, skip verification
  if (expectedToken) {
    if (!sparkloopToken || sparkloopToken !== expectedToken) {
      console.error('[SparkLoop Webhook] Invalid or missing SparkLoop-Token header')
      return NextResponse.json({
        error: 'Unauthorized'
      }, { status: 401 })
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
    return NextResponse.json({
      error: 'Invalid JSON'
    }, { status: 400 })
  }

  try {
    const eventType = payload.event || payload.type || 'unknown'

    switch (eventType) {
      case EVENT_TYPES.NEW_OFFER_LEAD:
        await handleNewOfferLead(payload)
        break

      case EVENT_TYPES.NEW_REFERRAL:
        await handleNewReferral(payload)
        break

      case EVENT_TYPES.NEW_PARTNER_PENDING_REFERRAL:
        await handlePartnerReferral(payload, eventType, 'pending')
        break

      case EVENT_TYPES.NEW_PARTNER_REFERRAL:
        await handlePartnerReferral(payload, eventType, 'confirmed')
        break

      case EVENT_TYPES.PARTNER_REFERRAL_REJECTED:
        await handlePartnerReferral(payload, eventType, 'rejected')
        break

      case EVENT_TYPES.REWARD_UNLOCKED:
      case EVENT_TYPES.REWARD_REDEEMED:
        await handleRewardEvent(payload, eventType)
        break

      case EVENT_TYPES.SYNC_SUBSCRIBER:
        await handleSyncSubscriber(payload)
        break

      default:
        console.log(`[SparkLoop Webhook] Unhandled event type: ${eventType}`)
        // Still store it for debugging
        await storeEvent(eventType, payload)
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('[SparkLoop Webhook] Error processing event:', error)
    return NextResponse.json({
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Handle new_offer_lead event
 * Fired when a subscriber opts into a recommended newsletter via Upscribe
 */
async function handleNewOfferLead(payload: any) {
  const subscriber = payload.subscriber || payload.data?.subscriber || {}
  const offer = payload.offer || payload.data?.offer || {}

  const subscriberEmail = subscriber.email || payload.email
  const subscriberUuid = subscriber.uuid || subscriber.id
  const referredPublication = offer.name || offer.publication_name || payload.publication_name
  const referredPublicationId = offer.id || offer.publication_id || payload.publication_id

  console.log(`[SparkLoop Webhook] New offer lead: ${subscriberEmail} subscribed to "${referredPublication}"`)

  await storeEvent(EVENT_TYPES.NEW_OFFER_LEAD, payload, {
    subscriber_email: subscriberEmail,
    subscriber_uuid: subscriberUuid,
    referred_publication: referredPublication,
    referred_publication_id: referredPublicationId,
  })

  // Send Slack notification
  const slack = new SlackNotificationService()
  await slack.sendSimpleMessage(
    `✨ SparkLoop Offer Lead\n\n` +
    `Subscriber: ${subscriberEmail}\n` +
    `Opted into: ${referredPublication || 'Unknown newsletter'}\n` +
    `Time: ${new Date().toISOString()}`
  )
}

/**
 * Handle new_referral event
 * Fired when someone refers a new subscriber
 */
async function handleNewReferral(payload: any) {
  const subscriber = payload.subscriber || payload.data?.subscriber || {}
  const referrer = payload.referrer || payload.data?.referrer || {}

  const subscriberEmail = subscriber.email || payload.email
  const subscriberUuid = subscriber.uuid || subscriber.id
  const referrerEmail = referrer.email
  const referrerUuid = referrer.uuid || referrer.id

  console.log(`[SparkLoop Webhook] New referral: ${subscriberEmail} referred by ${referrerEmail}`)

  await storeEvent(EVENT_TYPES.NEW_REFERRAL, payload, {
    subscriber_email: subscriberEmail,
    subscriber_uuid: subscriberUuid,
    referrer_email: referrerEmail,
    referrer_uuid: referrerUuid,
  })

  // Send Slack notification
  const slack = new SlackNotificationService()
  await slack.sendSimpleMessage(
    `🎯 SparkLoop Referral\n\n` +
    `New subscriber: ${subscriberEmail}\n` +
    `Referred by: ${referrerEmail || 'Unknown'}\n` +
    `Time: ${new Date().toISOString()}`
  )
}

/**
 * Handle partner referral events (pending, confirmed, rejected)
 * Updates our recommendation metrics for RCR calculation
 */
async function handlePartnerReferral(
  payload: any,
  eventType: string,
  status: 'pending' | 'confirmed' | 'rejected'
) {
  const subscriber = payload.subscriber || payload.data?.subscriber || {}
  const offer = payload.offer || payload.data?.offer || {}

  const subscriberEmail = subscriber.email || payload.email
  const subscriberUuid = subscriber.uuid || subscriber.id
  const refCode = offer.ref_code || payload.ref_code

  console.log(`[SparkLoop Webhook] Partner referral (${status}): ${subscriberEmail} - ref_code: ${refCode}`)

  await storeEvent(eventType, payload, {
    subscriber_email: subscriberEmail,
    subscriber_uuid: subscriberUuid,
    referred_publication: offer.publication_name,
    referred_publication_id: offer.id,
  })

  // Update our recommendation metrics if we have a ref_code
  if (refCode) {
    try {
      if (status === 'confirmed') {
        await supabaseAdmin.rpc('record_sparkloop_confirm', {
          p_publication_id: DEFAULT_PUBLICATION_ID,
          p_ref_code: refCode,
        })
        console.log(`[SparkLoop Webhook] Recorded confirm for ${refCode}`)

        // Send Slack notification for confirmed referral
        const slack = new SlackNotificationService()
        await slack.sendSimpleMessage(
          `✅ SparkLoop Referral Confirmed!\n\n` +
          `Subscriber: ${subscriberEmail}\n` +
          `Newsletter: ${offer.publication_name || refCode}\n` +
          `Time: ${new Date().toISOString()}`
        )
      } else if (status === 'rejected') {
        await supabaseAdmin.rpc('record_sparkloop_rejection', {
          p_publication_id: DEFAULT_PUBLICATION_ID,
          p_ref_code: refCode,
        })
        console.log(`[SparkLoop Webhook] Recorded rejection for ${refCode}`)

        // Send Slack notification for rejected referral
        const slack = new SlackNotificationService()
        await slack.sendSimpleMessage(
          `❌ SparkLoop Referral Rejected\n\n` +
          `Subscriber: ${subscriberEmail}\n` +
          `Newsletter: ${offer.publication_name || refCode}\n` +
          `Time: ${new Date().toISOString()}`
        )
      }
      // For 'pending', we don't need to update metrics here - it's tracked when submitted
    } catch (metricsError) {
      console.error(`[SparkLoop Webhook] Failed to update metrics for ${refCode}:`, metricsError)
      // Don't fail the webhook for metrics errors
    }
  }
}

/**
 * Handle reward events
 */
async function handleRewardEvent(payload: any, eventType: string) {
  const subscriber = payload.subscriber || payload.data?.subscriber || {}
  const reward = payload.reward || payload.data?.reward || {}

  const subscriberEmail = subscriber.email || payload.email
  const subscriberUuid = subscriber.uuid || subscriber.id
  const rewardName = reward.name || reward.title
  const rewardId = reward.id

  console.log(`[SparkLoop Webhook] Reward ${eventType}: ${subscriberEmail} - ${rewardName}`)

  await storeEvent(eventType, payload, {
    subscriber_email: subscriberEmail,
    subscriber_uuid: subscriberUuid,
    reward_name: rewardName,
    reward_id: rewardId,
  })

  // Send Slack notification for rewards
  const slack = new SlackNotificationService()
  const emoji = eventType === EVENT_TYPES.REWARD_UNLOCKED ? '🏆' : '🎁'
  await slack.sendSimpleMessage(
    `${emoji} SparkLoop Reward ${eventType === EVENT_TYPES.REWARD_UNLOCKED ? 'Unlocked' : 'Redeemed'}\n\n` +
    `Subscriber: ${subscriberEmail}\n` +
    `Reward: ${rewardName || 'Unknown'}\n` +
    `Time: ${new Date().toISOString()}`
  )
}

/**
 * Handle sync_subscriber event
 */
async function handleSyncSubscriber(payload: any) {
  const subscriber = payload.subscriber || payload.data?.subscriber || {}

  const subscriberEmail = subscriber.email || payload.email
  const subscriberUuid = subscriber.uuid || subscriber.id

  console.log(`[SparkLoop Webhook] Sync subscriber: ${subscriberEmail}`)

  await storeEvent(EVENT_TYPES.SYNC_SUBSCRIBER, payload, {
    subscriber_email: subscriberEmail,
    subscriber_uuid: subscriberUuid,
  })
}

/**
 * Store event in database
 */
async function storeEvent(
  eventType: string,
  payload: any,
  extracted?: {
    subscriber_email?: string
    subscriber_uuid?: string
    referred_publication?: string
    referred_publication_id?: string
    referrer_email?: string
    referrer_uuid?: string
    reward_name?: string
    reward_id?: string
  }
) {
  // Extract subscriber email from various payload formats
  const subscriberEmail = extracted?.subscriber_email ||
    payload.subscriber?.email ||
    payload.data?.subscriber?.email ||
    payload.email ||
    'unknown'

  const eventTimestamp = payload.timestamp || payload.created_at || payload.data?.created_at

  const { error } = await supabaseAdmin
    .from('sparkloop_events')
    .insert({
      publication_id: DEFAULT_PUBLICATION_ID,
      event_type: eventType,
      event_id: payload.id || payload.event_id,
      subscriber_email: subscriberEmail,
      subscriber_uuid: extracted?.subscriber_uuid,
      referred_publication: extracted?.referred_publication,
      referred_publication_id: extracted?.referred_publication_id,
      referrer_email: extracted?.referrer_email,
      referrer_uuid: extracted?.referrer_uuid,
      reward_name: extracted?.reward_name,
      reward_id: extracted?.reward_id,
      raw_payload: payload,
      event_timestamp: eventTimestamp ? new Date(eventTimestamp).toISOString() : null,
    })
    .select()
    .single()

  if (error) {
    // Ignore duplicate constraint violations
    if (error.code === '23505') {
      console.log(`[SparkLoop Webhook] Duplicate event ignored: ${eventType} for ${subscriberEmail}`)
      return
    }
    console.error('[SparkLoop Webhook] Failed to store event:', error)
    throw error
  }

  console.log(`[SparkLoop Webhook] Stored event: ${eventType} for ${subscriberEmail}`)
}
