import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'

const COLUMNS = 'id, publication_id, category, lookup_key, display_name, image_url, metadata, created_at, updated_at'

const updateSchema = z.object({
  display_name: z.string().min(1).optional(),
  image_url: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  lookup_key: z.string().min(1).optional()
})

export const PATCH = withApiHandler(
  { authTier: 'authenticated', inputSchema: updateSchema, logContext: 'article-images/[id]' },
  async ({ input, params }) => {
    const id = params.id

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.display_name !== undefined) updateData.display_name = input.display_name
    if (input.image_url !== undefined) updateData.image_url = input.image_url
    if (input.metadata !== undefined) updateData.metadata = input.metadata
    if (input.lookup_key !== undefined) updateData.lookup_key = input.lookup_key

    const { data, error } = await supabaseAdmin
      .from('article_images')
      .update(updateData)
      .eq('id', id)
      .select(COLUMNS)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ image: data })
  }
)

export const DELETE = withApiHandler(
  { authTier: 'authenticated', logContext: 'article-images/[id]' },
  async ({ params }) => {
    const id = params.id

    const { error } = await supabaseAdmin
      .from('article_images')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }
)
