import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

// Helper to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// GET - List all manual articles
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'databases/manual-articles', requirePublicationId: true },
  async ({ request, publicationId, logger }) => {
    // Also fetch website_domain for this publication
    const { data: pub } = await supabaseAdmin
      .from('publications')
      .select('website_domain')
      .eq('id', publicationId!)
      .single()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // Optional filter: draft, published, used

    let query = supabaseAdmin
      .from('manual_articles')
      .select(`
        *,
        category:article_categories(id, name, slug)
      `)
      .eq('publication_id', publicationId!)
      .order('publish_date', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: articles, error } = await query

    if (error) {
      logger.error({ err: error }, 'Error fetching manual articles')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      articles,
      website_domain: pub?.website_domain || ''
    })
  }
)

// POST - Create a new manual article
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'databases/manual-articles', requirePublicationId: true },
  async ({ request, publicationId, logger }) => {
    const body = await request.json()
    const {
      title,
      body: articleBody,
      image_url,
      section_type,
      category_id,
      publish_date,
      slug: customSlug
    } = body

    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (!articleBody || typeof articleBody !== 'string' || articleBody.trim().length === 0) {
      return NextResponse.json({ error: 'Article body is required' }, { status: 400 })
    }

    if (!section_type || !['primary_articles', 'secondary_articles'].includes(section_type)) {
      return NextResponse.json({ error: 'Valid section type is required' }, { status: 400 })
    }

    // Generate or use custom slug
    let slug = customSlug ? generateSlug(customSlug) : generateSlug(title)

    // Check for duplicate slug and append number if needed
    let slugToUse = slug
    let counter = 1
    while (true) {
      const { data: existing } = await supabaseAdmin
        .from('manual_articles')
        .select('id')
        .eq('publication_id', publicationId!)
        .eq('slug', slugToUse)
        .single()

      if (!existing) break
      counter++
      slugToUse = `${slug}-${counter}`
    }

    const { data: article, error } = await supabaseAdmin
      .from('manual_articles')
      .insert({
        publication_id: publicationId!,
        title: title.trim(),
        slug: slugToUse,
        body: articleBody,
        image_url: image_url || null,
        section_type,
        category_id: category_id || null,
        publish_date: publish_date || new Date().toISOString().split('T')[0],
        status: 'draft'
      })
      .select(`
        *,
        category:article_categories(id, name, slug)
      `)
      .single()

    if (error) {
      logger.error({ err: error }, 'Error creating manual article')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ article }, { status: 201 })
  }
)
