import { supabaseAdmin } from '../supabase'
import { checkUserAgent } from '../bot-detection/ua-detector'
import type {
  ActiveSubscribeAbTest,
  SubscribeAbEventType,
  SubscribeAbTest,
  SubscribeAbTestVariantWithPage,
} from './types'

export const VISITOR_COOKIE = 'subv_vid'

interface AssignmentResult {
  variant: SubscribeAbTestVariantWithPage
  isNew: boolean
}

interface RecordEventCtx {
  publicationId: string
  visitorId?: string | null
  subscriberEmail?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Returns the single active subscribe A/B test for a publication, with
 * variants joined to their page presets. Returns null when no test is active.
 */
export async function getActiveTestForPublication(
  publicationId: string
): Promise<ActiveSubscribeAbTest | null> {
  const { data: test, error: testErr } = await supabaseAdmin
    .from('subscribe_ab_tests')
    .select('id, publication_id, name, status, start_date, end_date, started_at, ended_at, created_at, updated_at')
    .eq('publication_id', publicationId)
    .eq('status', 'active')
    .maybeSingle()

  if (testErr) {
    console.error('[SubscribeAB] Error loading active test:', testErr.message)
    return null
  }
  if (!test) return null

  const { data: variants, error: varErr } = await supabaseAdmin
    .from('subscribe_ab_test_variants')
    .select(`
      id, test_id, page_id, label, weight, display_order, created_at,
      page:subscribe_pages!inner(id, publication_id, name, content, is_archived, created_at, updated_at)
    `)
    .eq('test_id', test.id)
    .order('display_order', { ascending: true })

  if (varErr) {
    console.error('[SubscribeAB] Error loading variants:', varErr.message)
    return null
  }
  if (!variants || variants.length === 0) return null

  return {
    test: test as SubscribeAbTest,
    // Supabase joins return the related row as an array when the FK relationship
    // is reverse-defined; normalize to a single object.
    variants: variants.map((v: any) => ({
      ...v,
      page: Array.isArray(v.page) ? v.page[0] : v.page,
    })) as SubscribeAbTestVariantWithPage[],
  }
}

/**
 * Pick a variant by weighted random over the variants' weight values.
 * Falls back to the first variant if all weights are 0.
 */
function pickWeightedVariant(
  variants: SubscribeAbTestVariantWithPage[]
): SubscribeAbTestVariantWithPage {
  const totalWeight = variants.reduce((sum, v) => sum + Math.max(0, v.weight), 0)
  if (totalWeight <= 0) return variants[0]

  let pick = Math.random() * totalWeight
  for (const v of variants) {
    pick -= Math.max(0, v.weight)
    if (pick <= 0) return v
  }
  return variants[variants.length - 1]
}

/**
 * Look up an existing assignment for this visitor in this test, or create
 * one with a freshly picked variant. Idempotent under concurrent requests
 * via the (test_id, visitor_id) unique constraint.
 */
export async function ensureAssignment(
  active: ActiveSubscribeAbTest,
  visitorId: string,
  ctx: { ipAddress: string | null; userAgent: string | null; isBotUa: boolean }
): Promise<AssignmentResult | null> {
  const { test, variants } = active

  const { data: existing } = await supabaseAdmin
    .from('subscribe_ab_assignments')
    .select('variant_id')
    .eq('test_id', test.id)
    .eq('visitor_id', visitorId)
    .maybeSingle()

  if (existing?.variant_id) {
    const v = variants.find((vv) => vv.id === existing.variant_id)
    if (v) return { variant: v, isNew: false }
    // Fallthrough: variant id no longer matches a current variant → re-assign
  }

  const picked = pickWeightedVariant(variants)

  const { error: insertErr } = await supabaseAdmin
    .from('subscribe_ab_assignments')
    .insert({
      test_id: test.id,
      variant_id: picked.id,
      publication_id: test.publication_id,
      visitor_id: visitorId,
      ip_address: ctx.ipAddress,
      user_agent: ctx.userAgent,
      is_bot_ua: ctx.isBotUa,
    })

  if (insertErr) {
    // Race-condition: another request inserted first; re-read.
    const { data: retry } = await supabaseAdmin
      .from('subscribe_ab_assignments')
      .select('variant_id')
      .eq('test_id', test.id)
      .eq('visitor_id', visitorId)
      .maybeSingle()
    if (retry?.variant_id) {
      const v = variants.find((vv) => vv.id === retry.variant_id)
      if (v) return { variant: v, isNew: false }
    }
    console.error('[SubscribeAB] Assignment insert failed:', insertErr.message)
    return null
  }

  return { variant: picked, isNew: true }
}

/**
 * Insert a single event row scoped to (test_id, variant_id). No-ops if
 * variantId is missing.
 */
export async function recordEvent(
  testId: string,
  variantId: string | null,
  eventType: SubscribeAbEventType,
  ctx: RecordEventCtx
): Promise<void> {
  if (!variantId) return

  const isBotUa = ctx.userAgent ? checkUserAgent(ctx.userAgent).isBot : false

  const { error } = await supabaseAdmin
    .from('subscribe_ab_events')
    .insert({
      test_id: testId,
      variant_id: variantId,
      publication_id: ctx.publicationId,
      visitor_id: ctx.visitorId ?? null,
      subscriber_email: ctx.subscriberEmail ?? null,
      event_type: eventType,
      ip_address: ctx.ipAddress ?? null,
      is_bot_ua: isBotUa,
      metadata: ctx.metadata ?? {},
    })

  if (error) {
    console.error(`[SubscribeAB] Event insert failed (${eventType}):`, error.message)
  }
}

/**
 * Record subscriber email on the assignment row (called after first signup).
 * Used to attribute later conversions (SparkLoop webhook) by email.
 */
export async function attachEmailToAssignment(
  testId: string,
  visitorId: string,
  email: string
): Promise<void> {
  if (!email) return
  const { error } = await supabaseAdmin
    .from('subscribe_ab_assignments')
    .update({ subscriber_email: email })
    .eq('test_id', testId)
    .eq('visitor_id', visitorId)

  if (error) {
    console.error('[SubscribeAB] attachEmailToAssignment failed:', error.message)
  }
}

/**
 * Resolve (test_id, variant_id) for a given subscriber email scoped to a
 * publication's currently active test. Used by the SparkLoop webhook path
 * where the visitor cookie is no longer present.
 */
export async function attributeBySubscriberEmail(
  publicationId: string,
  email: string
): Promise<{ testId: string; variantId: string; visitorId: string } | null> {
  if (!email) return null

  const active = await getActiveTestForPublication(publicationId)
  if (!active) return null

  const { data } = await supabaseAdmin
    .from('subscribe_ab_assignments')
    .select('test_id, variant_id, visitor_id')
    .eq('test_id', active.test.id)
    .eq('subscriber_email', email)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return { testId: data.test_id, variantId: data.variant_id, visitorId: data.visitor_id }
}

/**
 * Resolve (test_id, variant_id) for a request that arrives with a visitor
 * cookie but no active context (e.g. /api/subscribe POST). Returns the
 * variant only if it belongs to the publication's currently active test.
 */
export async function attributeByVisitor(
  publicationId: string,
  visitorId: string
): Promise<{ testId: string; variantId: string } | null> {
  if (!visitorId) return null

  const active = await getActiveTestForPublication(publicationId)
  if (!active) return null

  const { data } = await supabaseAdmin
    .from('subscribe_ab_assignments')
    .select('test_id, variant_id')
    .eq('test_id', active.test.id)
    .eq('visitor_id', visitorId)
    .maybeSingle()

  if (!data) return null
  return { testId: data.test_id, variantId: data.variant_id }
}
