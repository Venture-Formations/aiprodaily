import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

const contentSchema = z.record(z.string(), z.string().optional()).optional()

const listSchema = z.object({
  publication_id: z.string().uuid(),
  include_archived: z.enum(['true', 'false']).optional(),
})

const createSchema = z.object({
  publication_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  content: contentSchema,
})

export const GET = withApiHandler(
  {
    authTier: 'authenticated',
    logContext: 'subscribe-pages-list',
    requirePublicationId: true,
    inputSchema: listSchema,
  },
  async ({ input, publicationId }) => {
    const includeArchived = (input as z.infer<typeof listSchema>).include_archived === 'true'

    let query = supabaseAdmin
      .from('subscribe_pages')
      .select('id, publication_id, name, content, is_archived, created_at, updated_at')
      .eq('publication_id', publicationId!)
      .order('updated_at', { ascending: false })

    if (!includeArchived) {
      query = query.eq('is_archived', false)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, pages: data || [] })
  }
)

export const POST = withApiHandler(
  {
    authTier: 'authenticated',
    logContext: 'subscribe-pages-create',
    requirePublicationId: true,
    inputSchema: createSchema,
  },
  async ({ input, publicationId }) => {
    const parsed = input as z.infer<typeof createSchema>

    const { data, error } = await supabaseAdmin
      .from('subscribe_pages')
      .insert({
        publication_id: publicationId!,
        name: parsed.name,
        content: parsed.content ?? {},
      })
      .select('id, publication_id, name, content, is_archived, created_at, updated_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, page: data })
  }
)
