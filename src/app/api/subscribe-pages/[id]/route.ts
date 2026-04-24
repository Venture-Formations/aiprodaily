import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

const updateSchema = z.object({
  publication_id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  content: z.record(z.string(), z.string().optional()).optional(),
  is_archived: z.boolean().optional(),
  is_default: z.boolean().optional(),
})

export const GET = withApiHandler(
  {
    authTier: 'authenticated',
    logContext: 'subscribe-pages-get',
    requirePublicationId: true,
    inputSchema: z.object({ publication_id: z.string().uuid() }),
  },
  async ({ publicationId, params }) => {
    const { data, error } = await supabaseAdmin
      .from('subscribe_pages')
      .select('id, publication_id, name, content, is_archived, is_default, created_at, updated_at')
      .eq('id', params.id)
      .eq('publication_id', publicationId!)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ success: true, page: data })
  }
)

export const PUT = withApiHandler(
  {
    authTier: 'authenticated',
    logContext: 'subscribe-pages-update',
    requirePublicationId: true,
    inputSchema: updateSchema,
  },
  async ({ input, publicationId, params }) => {
    const parsed = input as z.infer<typeof updateSchema>

    // Look up current state so we can enforce default/archive invariants
    const { data: current } = await supabaseAdmin
      .from('subscribe_pages')
      .select('id, is_default')
      .eq('id', params.id)
      .eq('publication_id', publicationId!)
      .maybeSingle()

    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Can't archive the current default — user must mark another page default first
    if (parsed.is_archived === true && current.is_default) {
      return NextResponse.json(
        { error: 'Cannot archive the default page. Mark another page as default first.' },
        { status: 400 }
      )
    }

    // If promoting this row to default, clear any existing default in the same publication
    if (parsed.is_default === true && !current.is_default) {
      await supabaseAdmin
        .from('subscribe_pages')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq('publication_id', publicationId!)
        .eq('is_default', true)
        .neq('id', params.id)
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (parsed.name !== undefined) patch.name = parsed.name
    if (parsed.content !== undefined) patch.content = parsed.content
    if (parsed.is_archived !== undefined) patch.is_archived = parsed.is_archived
    if (parsed.is_default !== undefined) patch.is_default = parsed.is_default

    const { data, error } = await supabaseAdmin
      .from('subscribe_pages')
      .update(patch)
      .eq('id', params.id)
      .eq('publication_id', publicationId!)
      .select('id, publication_id, name, content, is_archived, is_default, created_at, updated_at')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ success: true, page: data })
  }
)

export const DELETE = withApiHandler(
  {
    authTier: 'authenticated',
    logContext: 'subscribe-pages-delete',
    requirePublicationId: true,
    inputSchema: z.object({ publication_id: z.string().uuid() }),
  },
  async ({ publicationId, params }) => {
    // Soft delete: archive rather than hard-delete so historical A/B tests still
    // resolve the page row they reference.
    const { data: current } = await supabaseAdmin
      .from('subscribe_pages')
      .select('is_default')
      .eq('id', params.id)
      .eq('publication_id', publicationId!)
      .maybeSingle()

    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (current.is_default) {
      return NextResponse.json(
        { error: 'Cannot archive the default page. Mark another page as default first.' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('subscribe_pages')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('publication_id', publicationId!)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  }
)
