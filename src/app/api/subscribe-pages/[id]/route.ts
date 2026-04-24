import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

const updateSchema = z.object({
  publication_id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  content: z.record(z.string(), z.string().optional()).optional(),
  is_archived: z.boolean().optional(),
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
      .select('id, publication_id, name, content, is_archived, created_at, updated_at')
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

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (parsed.name !== undefined) patch.name = parsed.name
    if (parsed.content !== undefined) patch.content = parsed.content
    if (parsed.is_archived !== undefined) patch.is_archived = parsed.is_archived

    const { data, error } = await supabaseAdmin
      .from('subscribe_pages')
      .update(patch)
      .eq('id', params.id)
      .eq('publication_id', publicationId!)
      .select('id, publication_id, name, content, is_archived, created_at, updated_at')
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
    const { error } = await supabaseAdmin
      .from('subscribe_pages')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('publication_id', publicationId!)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  }
)
