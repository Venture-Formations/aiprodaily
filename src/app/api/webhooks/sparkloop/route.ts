import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SlackNotificationService } from '@/lib/slack'
import { PUBLICATION_ID } from '@/lib/config'

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
  const campaign = payload.campaign || payload.data?.campaign || {}

  const subscriberEmail = subscriber.email || payload.email
  const subscriberUuid = subscriber.uuid || subscriber.id
  const refCode = campaign.referral_code || offer.ref_code || payload.ref_code

  console.log(`[SparkLoop Webhook] Partner referral (${status}): ${subscriberEmail} - ref_code: ${refCode}`)

  await storeEvent(eventType, payload, {
    subscriber_email: subscriberEmail,
    subscriber_uuid: subscriberUuid,
    referred_publication: offer.publication_name || campaign.publication_name,
    referred_publication_id: offer.id || campaign.publication_id,
  })

  // Update our recommendation metrics if we have a ref_code
  if (refCode) {
    try {
      if (status === 'confirmed') {
        await supabaseAdmin.rpc('record_sparkloop_confirm', {
          p_publication_id: PUBLICATION_ID,
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
          p_publication_id: PUBLICATION_ID,
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

  // Update sparkloop_referrals tracking table
  if (refCode && subscriberEmail) {
    try {
      await updateReferralTracking(subscriberEmail, refCode, status)
    } catch (trackingError) {
      console.error(`[SparkLoop Webhook] Failed to update referral tracking:`, trackingError)
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
 * Update sparkloop_referrals tracking table for a webhook event.
 * Tries to match existing popup referral first; if no match, inserts as webhook_only.
 */
async function updateReferralTracking(
  subscriberEmail: string,
  refCode: string,
  status: 'pending' | 'confirmed' | 'rejected'
) {
  const now = new Date().toISOString()

  if (status === 'pending') {
    // Try to update existing custom_popup referral
    const { data: updated } = await supabaseAdmin
      .from('sparkloop_referrals')
      .update({ status: 'pending', pending_at: now, updated_at: now })
      .eq('publication_id', PUBLICATION_ID)
      .eq('subscriber_email', subscriberEmail)
      .eq('ref_code', refCode)
      .eq('source', 'custom_popup')
      .in('status', ['subscribed'])
      .select('id')

    if (updated && updated.length > 0) {
      console.log(`[SparkLoop Webhook] Updated popup referral to pending: ${subscriberEmail} / ${refCode}`)
    } else {
      // No match — insert as webhook_only
      const { error } = await supabaseAdmin
        .from('sparkloop_referrals')
        .upsert({
          publication_id: PUBLICATION_ID,
          subscriber_email: subscriberEmail,
          ref_code: refCode,
          source: 'webhook_only',
          status: 'pending',
          pending_at: now,
        }, { onConflict: 'publication_id,subscriber_email,ref_code', ignoreDuplicates: true })

      if (error && error.code !== '23505') {
        console.error('[SparkLoop Webhook] Failed to insert webhook_only pending referral:', error)
      } else {
        console.log(`[SparkLoop Webhook] Inserted webhook_only pending referral: ${subscriberEmail} / ${refCode}`)
      }
    }
  } else if (status === 'confirmed') {
    // Try to update existing referral (any source)
    const { data: existing } = await supabaseAdmin
      .from('sparkloop_referrals')
      .select('id, source')
      .eq('publication_id', PUBLICATION_ID)
      .eq('subscriber_email', subscriberEmail)
      .eq('ref_code', refCode)
      .limit(1)
      .single()

    if (existing) {
      await supabaseAdmin
        .from('sparkloop_referrals')
        .update({ status: 'confirmed', confirmed_at: now, updated_at: now })
        .eq('id', existing.id)

      // Update aggregate columns if it was from our popup
      if (existing.source === 'custom_popup') {
        const { error: confirmErr } = await supabaseAdmin.rpc('record_our_confirm', {
          p_publication_id: PUBLICATION_ID,
          p_ref_code: refCode,
        })
        if (confirmErr) console.error('[SparkLoop Webhook] Failed to record our confirm:', confirmErr)
      }
      console.log(`[SparkLoop Webhook] Updated referral to confirmed (${existing.source}): ${subscriberEmail} / ${refCode}`)
    } else {
      // No existing row — insert as webhook_only confirmed
      await supabaseAdmin
        .from('sparkloop_referrals')
        .upsert({
          publication_id: PUBLICATION_ID,
          subscriber_email: subscriberEmail,
          ref_code: refCode,
          source: 'webhook_only',
          status: 'confirmed',
          confirmed_at: now,
        }, { onConflict: 'publication_id,subscriber_email,ref_code', ignoreDuplicates: true })

      console.log(`[SparkLoop Webhook] Inserted webhook_only confirmed referral: ${subscriberEmail} / ${refCode}`)
    }
  } else if (status === 'rejected') {
    // Try to update existing referral
    const { data: existing } = await supabaseAdmin
      .from('sparkloop_referrals')
      .select('id, source')
      .eq('publication_id', PUBLICATION_ID)
      .eq('subscriber_email', subscriberEmail)
      .eq('ref_code', refCode)
      .limit(1)
      .single()

    if (existing) {
      await supabaseAdmin
        .from('sparkloop_referrals')
        .update({ status: 'rejected', rejected_at: now, updated_at: now })
        .eq('id', existing.id)

      if (existing.source === 'custom_popup') {
        const { error: rejErr } = await supabaseAdmin.rpc('record_our_rejection', {
          p_publication_id: PUBLICATION_ID,
          p_ref_code: refCode,
        })
        if (rejErr) console.error('[SparkLoop Webhook] Failed to record our rejection:', rejErr)
      }
      console.log(`[SparkLoop Webhook] Updated referral to rejected (${existing.source}): ${subscriberEmail} / ${refCode}`)
    } else {
      await supabaseAdmin
        .from('sparkloop_referrals')
        .upsert({
          publication_id: PUBLICATION_ID,
          subscriber_email: subscriberEmail,
          ref_code: refCode,
          source: 'webhook_only',
          status: 'rejected',
          rejected_at: now,
        }, { onConflict: 'publication_id,subscriber_email,ref_code', ignoreDuplicates: true })

      console.log(`[SparkLoop Webhook] Inserted webhook_only rejected referral: ${subscriberEmail} / ${refCode}`)
    }
  }
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
      publication_id: PUBLICATION_ID,
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
