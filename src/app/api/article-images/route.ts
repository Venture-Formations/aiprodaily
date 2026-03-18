import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'

const COLUMNS = 'id, publication_id, category, lookup_key, display_name, image_url, metadata, created_at, updated_at'

const createSchema = z.object({
  publication_id: z.string().uuid(),
  category: z.enum(['trade', 'member', 'transaction', 'custom']),
  lookup_key: z.string().min(1),
  display_name: z.string().min(1),
  image_url: z.string().url(),
  metadata: z.record(z.string(), z.unknown()).optional().default({})
})

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'article-images' },
  async ({ request }) => {
    const publicationId = request.nextUrl.searchParams.get('publication_id')
    const category = request.nextUrl.searchParams.get('category')

    if (!publicationId) {
      return NextResponse.json({ error: 'publication_id is required' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('article_images')
      .select(COLUMNS)
      .eq('publication_id', publicationId)
      .order('category')
      .order('display_name')

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ images: data || [] })
  }
)

export const POST = withApiHandler(
  { authTier: 'authenticated', inputSchema: createSchema, logContext: 'article-images' },
  async ({ input }) => {
    const { data, error } = await supabaseAdmin
      .from('article_images')
      .insert({
        publication_id: input.publication_id,
        category: input.category,
        lookup_key: input.lookup_key,
        display_name: input.display_name,
        image_url: input.image_url,
        metadata: input.metadata
      })
      .select(COLUMNS)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'An image with this category and lookup key already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ image: data }, { status: 201 })
  }
)
