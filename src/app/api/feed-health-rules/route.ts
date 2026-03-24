import { withApiHandler } from '@/lib/api-handler'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'

const RULE_COLUMNS = 'id, publication_id, feed_id, rule_type, description, threshold_value, threshold_unit, baseline_value, is_active, created_by, last_triggered, last_evaluated, created_at, updated_at'

/**
 * GET /api/feed-health-rules?publication_id=...
 * List all feed health rules for a publication.
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'feed-health-rules', requirePublicationId: true },
  async ({ publicationId, logger }) => {
    const { data: rules, error } = await supabaseAdmin
      .from('feed_health_rules')
      .select(RULE_COLUMNS)
      .eq('publication_id', publicationId!)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error({ err: error }, 'Failed to fetch feed health rules')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also fetch feed names for display
    const feedIds = Array.from(new Set((rules || []).map(r => r.feed_id)))
    let feedNames: Record<string, string> = {}
    if (feedIds.length > 0) {
      const { data: feeds } = await supabaseAdmin
        .from('rss_feeds')
        .select('id, name')
        .in('id', feedIds)
      feedNames = Object.fromEntries((feeds || []).map(f => [f.id, f.name]))
    }

    return NextResponse.json({
      rules: (rules || []).map(r => ({
        ...r,
        feed_name: feedNames[r.feed_id] || r.feed_id,
      })),
    })
  }
)

const createRuleSchema = z.object({
  publication_id: z.string().uuid(),
  feed_id: z.string().uuid(),
  rule_type: z.enum(['freshness', 'quality', 'extraction', 'volume']),
  description: z.string().min(1).max(500),
  threshold_value: z.number(),
  threshold_unit: z.string().min(1),
  baseline_value: z.number().nullable().optional(),
})

/**
 * POST /api/feed-health-rules
 * Create a manual feed health rule.
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', inputSchema: createRuleSchema, logContext: 'feed-health-rules' },
  async ({ input, logger }) => {
    const { error } = await supabaseAdmin
      .from('feed_health_rules')
      .insert({
        publication_id: input.publication_id,
        feed_id: input.feed_id,
        rule_type: input.rule_type,
        description: input.description,
        threshold_value: input.threshold_value,
        threshold_unit: input.threshold_unit,
        baseline_value: input.baseline_value ?? null,
        is_active: true,
        created_by: 'manual',
      })

    if (error) {
      logger.error({ err: error }, 'Failed to create feed health rule')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }
)

const patchRuleSchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean().optional(),
})

/**
 * PATCH /api/feed-health-rules
 * Toggle a rule's active status.
 */
export const PATCH = withApiHandler(
  { authTier: 'authenticated', inputSchema: patchRuleSchema, logContext: 'feed-health-rules' },
  async ({ input, logger }) => {
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (input.is_active !== undefined) updates.is_active = input.is_active

    const { error } = await supabaseAdmin
      .from('feed_health_rules')
      .update(updates)
      .eq('id', input.id)

    if (error) {
      logger.error({ err: error }, 'Failed to update feed health rule')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }
)

const deleteRuleSchema = z.object({
  id: z.string().uuid(),
})

/**
 * DELETE /api/feed-health-rules
 * Delete a feed health rule.
 */
export const DELETE = withApiHandler(
  { authTier: 'authenticated', inputSchema: deleteRuleSchema, logContext: 'feed-health-rules' },
  async ({ input, logger }) => {
    const { error } = await supabaseAdmin
      .from('feed_health_rules')
      .delete()
      .eq('id', input.id)

    if (error) {
      logger.error({ err: error }, 'Failed to delete feed health rule')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }
)
