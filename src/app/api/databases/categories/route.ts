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

// GET - List all categories
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'databases/categories' },
  async ({ logger }) => {
    const activeNewsletter = await getActivePublication()
    if (!activeNewsletter) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

    const { data: categories, error } = await supabaseAdmin
      .from('article_categories')
      .select('*')
      .eq('publication_id', activeNewsletter.id)
      .order('name', { ascending: true })

    if (error) {
      logger.error({ err: error }, 'Error fetching categories')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ categories })
  }
)

// POST - Create a new category
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'databases/categories' },
  async ({ request, logger }) => {
    const activeNewsletter = await getActivePublication()
    if (!activeNewsletter) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Check for duplicate slug
    const { data: existing } = await supabaseAdmin
      .from('article_categories')
      .select('id')
      .eq('publication_id', activeNewsletter.id)
      .eq('slug', slug)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 })
    }

    const { data: category, error } = await supabaseAdmin
      .from('article_categories')
      .insert({
        publication_id: activeNewsletter.id,
        name: name.trim(),
        slug
      })
      .select()
      .single()

    if (error) {
      logger.error({ err: error }, 'Error creating category')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ category }, { status: 201 })
  }
)
