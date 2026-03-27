/**
 * SparkLoop Webhook Handlers (shared)
 *
 * Extracted handler logic used by both the legacy global webhook route
 * and the new per-publication webhook route.
 *
 * IMPORTANT: Every function takes publicationId as an explicit parameter.
 * Never import PUBLICATION_ID from config in this module.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { SlackNotificationService } from '@/lib/slack'

// SparkLoop webhook event types
export const EVENT_TYPES = {
  NEW_OFFER_LEAD: 'new_offer_lead',
  NEW_REFERRAL: 'new_referral',
  NEW_PARTNER_PENDING_REFERRAL: 'new_partner_pending_referral',
  NEW_PARTNER_REFERRAL: 'new_partner_referral', // Confirmed referral
  PARTNER_REFERRAL_REJECTED: 'partner_referral_rejected',
  REWARD_UNLOCKED: 'reward_unlocked',
  REWARD_REDEEMED: 'reward_redeemed',
  SYNC_SUBSCRIBER: 'sync_subscriber',
} as const

/**
 * Dispatch a webhook payload to the appropriate handler
 */
export async function dispatchWebhookEvent(payload: any, publicationId: string): Promise<void> {
  const eventType = payload.event || payload.type || 'unknown'

  switch (eventType) {
    case EVENT_TYPES.NEW_OFFER_LEAD:
      await handleNewOfferLead(payload, publicationId)
      break

    case EVENT_TYPES.NEW_REFERRAL:
      await handleNewReferral(payload, publicationId)
      break

    case EVENT_TYPES.NEW_PARTNER_PENDING_REFERRAL:
      await handlePartnerReferral(payload, eventType, 'pending', publicationId)
      break

    case EVENT_TYPES.NEW_PARTNER_REFERRAL:
      await handlePartnerReferral(payload, eventType, 'confirmed', publicationId)
      break

    case EVENT_TYPES.PARTNER_REFERRAL_REJECTED:
      await handlePartnerReferral(payload, eventType, 'rejected', publicationId)
      break

    case EVENT_TYPES.REWARD_UNLOCKED:
    case EVENT_TYPES.REWARD_REDEEMED:
      await handleRewardEvent(payload, eventType, publicationId)
      break

    case EVENT_TYPES.SYNC_SUBSCRIBER:
      await handleSyncSubscriber(payload, publicationId)
      break

    default:
      console.log(`[SparkLoop Webhook] Unhandled event type: ${eventType}`)
      await storeEvent(eventType, payload, publicationId)
  }
}

/**
 * Handle new_offer_lead event
 * Fired when a subscriber opts into a recommended newsletter via Upscribe
 */
async function handleNewOfferLead(payload: any, publicationId: string) {
  const subscriber = payload.subscriber || payload.data?.subscriber || {}
  const offer = payload.offer || payload.data?.offer || {}

  const subscriberEmail = subscriber.email || payload.email
  const subscriberUuid = subscriber.uuid || subscriber.id
  const referredPublication = offer.name || offer.publication_name || payload.publication_name
  const referredPublicationId = offer.id || offer.publication_id || payload.publication_id

  console.log(`[SparkLoop Webhook] New offer lead: ${subscriberEmail} subscribed to "${referredPublication}"`)

  await storeEvent(EVENT_TYPES.NEW_OFFER_LEAD, payload, publicationId, {
    subscriber_email: subscriberEmail,
    subscriber_uuid: subscriberUuid,
    referred_publication: referredPublication,
    referred_publication_id: referredPublicationId,
  })

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
async function handleNewReferral(payload: any, publicationId: string) {
  const subscriber = payload.subscriber || payload.data?.subscriber || {}
  const referrer = payload.referrer || payload.data?.referrer || {}

  const subscriberEmail = subscriber.email || payload.email
  const subscriberUuid = subscriber.uuid || subscriber.id
  const referrerEmail = referrer.email
  const referrerUuid = referrer.uuid || referrer.id

  console.log(`[SparkLoop Webhook] New referral: ${subscriberEmail} referred by ${referrerEmail}`)

  await storeEvent(EVENT_TYPES.NEW_REFERRAL, payload, publicationId, {
    subscriber_email: subscriberEmail,
    subscriber_uuid: subscriberUuid,
    referrer_email: referrerEmail,
    referrer_uuid: referrerUuid,
  })

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
  status: 'pending' | 'confirmed' | 'rejected',
  publicationId: string
) {
  const subscriber = payload.subscriber || payload.data?.subscriber || {}
  const offer = payload.offer || payload.data?.offer || {}
  const campaign = payload.campaign || payload.data?.campaign || {}

  const subscriberEmail = subscriber.email || payload.email
  const subscriberUuid = subscriber.uuid || subscriber.id
  const refCode = campaign.referral_code || offer.ref_code || payload.ref_code

  console.log(`[SparkLoop Webhook] Partner referral (${status}): ${subscriberEmail} - ref_code: ${refCode}`)

  await storeEvent(eventType, payload, publicationId, {
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
          p_publication_id: publicationId,
          p_ref_code: refCode,
        })
        console.log(`[SparkLoop Webhook] Recorded confirm for ${refCode}`)

        const slack = new SlackNotificationService()
        await slack.sendSimpleMessage(
          `✅ SparkLoop Referral Confirmed!\n\n` +
          `Subscriber: ${subscriberEmail}\n` +
          `Newsletter: ${offer.publication_name || refCode}\n` +
          `Time: ${new Date().toISOString()}`
        )
      } else if (status === 'rejected') {
        await supabaseAdmin.rpc('record_sparkloop_rejection', {
          p_publication_id: publicationId,
          p_ref_code: refCode,
        })
        console.log(`[SparkLoop Webhook] Recorded rejection for ${refCode}`)

        const slack = new SlackNotificationService()
        await slack.sendSimpleMessage(
          `❌ SparkLoop Referral Rejected\n\n` +
          `Subscriber: ${subscriberEmail}\n` +
          `Newsletter: ${offer.publication_name || refCode}\n` +
          `Time: ${new Date().toISOString()}`
        )
      }
    } catch (metricsError) {
      console.error(`[SparkLoop Webhook] Failed to update metrics for ${refCode}:`, metricsError)
    }
  }

  // Update sparkloop_referrals tracking table
  if (refCode && subscriberEmail) {
    try {
      await updateReferralTracking(subscriberEmail, refCode, status, publicationId)
    } catch (trackingError) {
      console.error(`[SparkLoop Webhook] Failed to update referral tracking:`, trackingError)
    }
  }
}

/**
 * Handle reward events
 */
async function handleRewardEvent(payload: any, eventType: string, publicationId: string) {
  const subscriber = payload.subscriber || payload.data?.subscriber || {}
  const reward = payload.reward || payload.data?.reward || {}

  const subscriberEmail = subscriber.email || payload.email
  const subscriberUuid = subscriber.uuid || subscriber.id
  const rewardName = reward.name || reward.title
  const rewardId = reward.id

  console.log(`[SparkLoop Webhook] Reward ${eventType}: ${subscriberEmail} - ${rewardName}`)

  await storeEvent(eventType, payload, publicationId, {
    subscriber_email: subscriberEmail,
    subscriber_uuid: subscriberUuid,
    reward_name: rewardName,
    reward_id: rewardId,
  })

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
async function handleSyncSubscriber(payload: any, publicationId: string) {
  const subscriber = payload.subscriber || payload.data?.subscriber || {}

  const subscriberEmail = subscriber.email || payload.email
  const subscriberUuid = subscriber.uuid || subscriber.id

  console.log(`[SparkLoop Webhook] Sync subscriber: ${subscriberEmail}`)

  await storeEvent(EVENT_TYPES.SYNC_SUBSCRIBER, payload, publicationId, {
    subscriber_email: subscriberEmail,
    subscriber_uuid: subscriberUuid,
  })
}

/**
 * Update sparkloop_referrals tracking table for a webhook event.
 * Tries to match existing popup referral first; if no match, inserts as webhook_only.
 */
export async function updateReferralTracking(
  subscriberEmail: string,
  refCode: string,
  status: 'pending' | 'confirmed' | 'rejected',
  publicationId: string
) {
  const now = new Date().toISOString()

  if (status === 'pending') {
    // Try to update existing custom_popup referral
    const { data: updated } = await supabaseAdmin
      .from('sparkloop_referrals')
      .update({ status: 'pending', pending_at: now, updated_at: now })
      .eq('publication_id', publicationId)
      .eq('subscriber_email', subscriberEmail)
      .eq('ref_code', refCode)
      .eq('source', 'custom_popup')
      .in('status', ['subscribed'])
      .select('id')

    if (updated && updated.length > 0) {
      console.log(`[SparkLoop Webhook] Updated popup referral to pending: ${subscriberEmail} / ${refCode}`)
    } else {
      const { error } = await supabaseAdmin
        .from('sparkloop_referrals')
        .upsert({
          publication_id: publicationId,
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
    const { data: existing } = await supabaseAdmin
      .from('sparkloop_referrals')
      .select('id, source')
      .eq('publication_id', publicationId)
      .eq('subscriber_email', subscriberEmail)
      .eq('ref_code', refCode)
      .limit(1)
      .single()

    if (existing) {
      await supabaseAdmin
        .from('sparkloop_referrals')
        .update({ status: 'confirmed', confirmed_at: now, updated_at: now })
        .eq('id', existing.id)

      if (existing.source === 'custom_popup') {
        const { error: confirmErr } = await supabaseAdmin.rpc('record_our_confirm', {
          p_publication_id: publicationId,
          p_ref_code: refCode,
        })
        if (confirmErr) console.error('[SparkLoop Webhook] Failed to record our confirm:', confirmErr)
      }
      console.log(`[SparkLoop Webhook] Updated referral to confirmed (${existing.source}): ${subscriberEmail} / ${refCode}`)
    } else {
      await supabaseAdmin
        .from('sparkloop_referrals')
        .upsert({
          publication_id: publicationId,
          subscriber_email: subscriberEmail,
          ref_code: refCode,
          source: 'webhook_only',
          status: 'confirmed',
          confirmed_at: now,
        }, { onConflict: 'publication_id,subscriber_email,ref_code', ignoreDuplicates: true })

      console.log(`[SparkLoop Webhook] Inserted webhook_only confirmed referral: ${subscriberEmail} / ${refCode}`)
    }
  } else if (status === 'rejected') {
    const { data: existing } = await supabaseAdmin
      .from('sparkloop_referrals')
      .select('id, source')
      .eq('publication_id', publicationId)
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
          p_publication_id: publicationId,
          p_ref_code: refCode,
        })
        if (rejErr) console.error('[SparkLoop Webhook] Failed to record our rejection:', rejErr)
      }
      console.log(`[SparkLoop Webhook] Updated referral to rejected (${existing.source}): ${subscriberEmail} / ${refCode}`)
    } else {
      await supabaseAdmin
        .from('sparkloop_referrals')
        .upsert({
          publication_id: publicationId,
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
export async function storeEvent(
  eventType: string,
  payload: any,
  publicationId: string,
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
  const subscriberEmail = extracted?.subscriber_email ||
    payload.subscriber?.email ||
    payload.data?.subscriber?.email ||
    payload.email ||
    'unknown'

  const eventTimestamp = payload.timestamp || payload.created_at || payload.data?.created_at

  const { error } = await supabaseAdmin
    .from('sparkloop_events')
    .insert({
      publication_id: publicationId,
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
    if (error.code === '23505') {
      console.log(`[SparkLoop Webhook] Duplicate event ignored: ${eventType} for ${subscriberEmail}`)
      return
    }
    console.error('[SparkLoop Webhook] Failed to store event:', error)
    throw error
  }

  console.log(`[SparkLoop Webhook] Stored event: ${eventType} for ${subscriberEmail}`)
}
