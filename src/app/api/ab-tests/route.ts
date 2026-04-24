import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

const listSchema = z.object({
  publication_id: z.string().uuid(),
  status: z.enum(['draft', 'active', 'ended']).optional(),
})

const variantInput = z.object({
  page_id: z.string().uuid(),
  label: z.string().min(1).max(40),
  weight: z.number().int().min(0).max(1000).default(50),
  display_order: z.number().int().min(0).default(0),
})

const createSchema = z.object({
  publication_id: z.string().uuid(),
  name: z.string().min(1).max(160),
  variants: z.array(variantInput).min(2),
  start_date: z.string().datetime().optional().nullable(),
  end_date: z.string().datetime().optional().nullable(),
  activate: z.boolean().optional(),
})

export const GET = withApiHandler(
  {
    authTier: 'authenticated',
    logContext: 'ab-tests-list',
    requirePublicationId: true,
    inputSchema: listSchema,
  },
  async ({ input, publicationId }) => {
    const parsed = input as z.infer<typeof listSchema>

    let query = supabaseAdmin
      .from('subscribe_ab_tests')
      .select('id, publication_id, name, status, start_date, end_date, started_at, ended_at, created_at, updated_at')
      .eq('publication_id', publicationId!)
      .order('created_at', { ascending: false })

    if (parsed.status) query = query.eq('status', parsed.status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, tests: data || [] })
  }
)

export const POST = withApiHandler(
  {
    authTier: 'authenticated',
    logContext: 'ab-tests-create',
    requirePublicationId: true,
    inputSchema: createSchema,
  },
  async ({ input, publicationId }) => {
    const parsed = input as z.infer<typeof createSchema>

    // Verify variant labels are unique within this test
    const labelSet = new Set(parsed.variants.map(v => v.label))
    if (labelSet.size !== parsed.variants.length) {
      return NextResponse.json(
        { error: 'Variant labels must be unique within a test' },
        { status: 400 }
      )
    }

    // Verify all referenced pages belong to this publication (tenant isolation)
    // and are not archived — archived pages can't be used in new tests.
    const pageIds = Array.from(new Set(parsed.variants.map(v => v.page_id)))
    const { data: pages } = await supabaseAdmin
      .from('subscribe_pages')
      .select('id')
      .eq('publication_id', publicationId!)
      .eq('is_archived', false)
      .in('id', pageIds)

    if (!pages || pages.length !== pageIds.length) {
      return NextResponse.json(
        { error: 'One or more page_ids do not belong to this publication or are archived' },
        { status: 400 }
      )
    }

    // If starting as active, refuse when another active test exists
    if (parsed.activate) {
      const { data: existing } = await supabaseAdmin
        .from('subscribe_ab_tests')
        .select('id')
        .eq('publication_id', publicationId!)
        .eq('status', 'active')
        .maybeSingle()
      if (existing) {
        return NextResponse.json(
          { error: 'Another test is already active for this publication' },
          { status: 409 }
        )
      }
    }

    const now = new Date().toISOString()
    const { data: test, error: testErr } = await supabaseAdmin
      .from('subscribe_ab_tests')
      .insert({
        publication_id: publicationId!,
        name: parsed.name,
        status: parsed.activate ? 'active' : 'draft',
        start_date: parsed.start_date ?? null,
        end_date: parsed.end_date ?? null,
        started_at: parsed.activate ? now : null,
      })
      .select('id, publication_id, name, status, start_date, end_date, started_at, ended_at, created_at, updated_at')
      .single()

    if (testErr || !test) {
      return NextResponse.json({ error: testErr?.message || 'Create failed' }, { status: 500 })
    }

    const variantRows = parsed.variants.map(v => ({
      test_id: test.id,
      page_id: v.page_id,
      label: v.label,
      weight: v.weight,
      display_order: v.display_order,
    }))

    const { error: varErr } = await supabaseAdmin
      .from('subscribe_ab_test_variants')
      .insert(variantRows)

    if (varErr) {
      // Roll back the test if variant insert failed
      await supabaseAdmin.from('subscribe_ab_tests').delete().eq('id', test.id)
      return NextResponse.json({ error: varErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, test })
  }
)
