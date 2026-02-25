import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

// Helper to get active publication
async function getActivePublication() {
  const { data: publication } = await supabaseAdmin
    .from('publications')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single()
  return publication
}

// Helper to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// GET - Get a single article
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'databases/manual-articles/[id]' },
  async ({ params, logger }) => {
    const id = params.id

    const { data: article, error } = await supabaseAdmin
      .from('manual_articles')
      .select(`
        *,
        category:article_categories(id, name, slug)
      `)
      .eq('id', id)
      .single()

    if (error) {
      logger.error({ err: error }, 'Error fetching manual article')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    return NextResponse.json({ article })
  }
)

// PATCH - Update an article
export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'databases/manual-articles/[id]' },
  async ({ params, request, logger }) => {
    const id = params.id
    const body = await request.json()

    const activeNewsletter = await getActivePublication()
    if (!activeNewsletter) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

    // Get existing article
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('manual_articles')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Can't edit used articles
    if (existing.status === 'used') {
      return NextResponse.json({ error: 'Cannot edit an article that has been used in a newsletter' }, { status: 400 })
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    // Handle title update (may need to update slug)
    if (body.title !== undefined) {
      updateData.title = body.title.trim()
    }

    // Handle custom slug update
    if (body.slug !== undefined && body.slug !== existing.slug) {
      const newSlug = generateSlug(body.slug)

      // Check for duplicate slug
      const { data: slugExists } = await supabaseAdmin
        .from('manual_articles')
        .select('id')
        .eq('publication_id', activeNewsletter.id)
        .eq('slug', newSlug)
        .neq('id', id)
        .single()

      if (slugExists) {
        return NextResponse.json({ error: 'An article with this slug already exists' }, { status: 409 })
      }

      updateData.slug = newSlug
    }

    // Handle other field updates
    if (body.body !== undefined) {
      updateData.body = body.body
    }

    if (body.image_url !== undefined) {
      updateData.image_url = body.image_url || null
    }

    if (body.section_type !== undefined) {
      if (!['primary_articles', 'secondary_articles'].includes(body.section_type)) {
        return NextResponse.json({ error: 'Invalid section type' }, { status: 400 })
      }
      updateData.section_type = body.section_type
    }

    if (body.category_id !== undefined) {
      updateData.category_id = body.category_id || null
    }

    if (body.publish_date !== undefined) {
      updateData.publish_date = body.publish_date
    }

    if (body.status !== undefined) {
      if (!['draft', 'published'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status (can only set to draft or published)' }, { status: 400 })
      }
      updateData.status = body.status
    }

    const { data: article, error } = await supabaseAdmin
      .from('manual_articles')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        category:article_categories(id, name, slug)
      `)
      .single()

    if (error) {
      logger.error({ err: error }, 'Error updating manual article')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ article })
  }
)

// DELETE - Delete an article
export const DELETE = withApiHandler(
  { authTier: 'authenticated', logContext: 'databases/manual-articles/[id]' },
  async ({ params, logger }) => {
    const id = params.id

    // Get existing article
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('manual_articles')
      .select('status')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Can't delete used articles
    if (existing.status === 'used') {
      return NextResponse.json({ error: 'Cannot delete an article that has been used in a newsletter' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('manual_articles')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error({ err: error }, 'Error deleting manual article')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }
)
