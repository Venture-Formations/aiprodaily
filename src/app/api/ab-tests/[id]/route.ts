import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

const patchSchema = z.object({
  publication_id: z.string().uuid(),
  action: z.enum(['start', 'end']).optional(),
  name: z.string().min(1).max(160).optional(),
  start_date: z.string().datetime().nullable().optional(),
  end_date: z.string().datetime().nullable().optional(),
})

export const GET = withApiHandler(
  {
    authTier: 'authenticated',
    logContext: 'ab-tests-get',
    requirePublicationId: true,
    inputSchema: z.object({ publication_id: z.string().uuid() }),
  },
  async ({ publicationId, params }) => {
    const { data: test, error } = await supabaseAdmin
      .from('subscribe_ab_tests')
      .select('id, publication_id, name, status, start_date, end_date, started_at, ended_at, created_at, updated_at')
      .eq('id', params.id)
      .eq('publication_id', publicationId!)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!test) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: variants } = await supabaseAdmin
      .from('subscribe_ab_test_variants')
      .select(`
        id, test_id, page_id, label, weight, display_order, created_at,
        page:subscribe_pages!inner(id, name, content, is_archived)
      `)
      .eq('test_id', test.id)
      .order('display_order', { ascending: true })

    return NextResponse.json({
      success: true,
      test,
      variants: (variants || []).map((v: any) => ({
        ...v,
        page: Array.isArray(v.page) ? v.page[0] : v.page,
      })),
    })
  }
)

export const PATCH = withApiHandler(
  {
    authTier: 'authenticated',
    logContext: 'ab-tests-patch',
    requirePublicationId: true,
    inputSchema: patchSchema,
  },
  async ({ input, publicationId, params }) => {
    const parsed = input as z.infer<typeof patchSchema>

    const { data: existing } = await supabaseAdmin
      .from('subscribe_ab_tests')
      .select('id, status')
      .eq('id', params.id)
      .eq('publication_id', publicationId!)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (parsed.name !== undefined) patch.name = parsed.name
    if (parsed.start_date !== undefined) patch.start_date = parsed.start_date
    if (parsed.end_date !== undefined) patch.end_date = parsed.end_date

    if (parsed.action === 'start') {
      if (existing.status === 'ended') {
        return NextResponse.json(
          { error: 'Cannot restart a test that has already ended. Create a new test.' },
          { status: 400 }
        )
      }
      const { data: activeOther } = await supabaseAdmin
        .from('subscribe_ab_tests')
        .select('id')
        .eq('publication_id', publicationId!)
        .eq('status', 'active')
        .neq('id', params.id)
        .maybeSingle()
      if (activeOther) {
        return NextResponse.json(
          { error: 'Another test is already active for this publication' },
          { status: 409 }
        )
      }
      patch.status = 'active'
      patch.started_at = new Date().toISOString()
    } else if (parsed.action === 'end') {
      patch.status = 'ended'
      patch.ended_at = new Date().toISOString()
    }

    const { data, error } = await supabaseAdmin
      .from('subscribe_ab_tests')
      .update(patch)
      .eq('id', params.id)
      .eq('publication_id', publicationId!)
      .select('id, publication_id, name, status, start_date, end_date, started_at, ended_at, created_at, updated_at')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, test: data })
  }
)
