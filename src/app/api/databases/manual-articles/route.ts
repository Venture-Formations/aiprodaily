import { NextRequest, NextResponse } from 'next/server'
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

// GET - List all manual articles
export async function GET(request: NextRequest) {
  try {
    const activeNewsletter = await getActivePublication()
    if (!activeNewsletter) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // Optional filter: draft, published, used

    let query = supabaseAdmin
      .from('manual_articles')
      .select(`
        *,
        category:article_categories(id, name, slug)
      `)
      .eq('publication_id', activeNewsletter.id)
      .order('publish_date', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: articles, error } = await query

    if (error) {
      console.error('[API] Error fetching manual articles:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ articles })
  } catch (error: any) {
    console.error('[API] Manual articles GET error:', error.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new manual article
export async function POST(request: NextRequest) {
  try {
    const activeNewsletter = await getActivePublication()
    if (!activeNewsletter) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

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
        .eq('publication_id', activeNewsletter.id)
        .eq('slug', slugToUse)
        .single()

      if (!existing) break
      counter++
      slugToUse = `${slug}-${counter}`
    }

    const { data: article, error } = await supabaseAdmin
      .from('manual_articles')
      .insert({
        publication_id: activeNewsletter.id,
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
      console.error('[API] Error creating manual article:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ article }, { status: 201 })
  } catch (error: any) {
    console.error('[API] Manual articles POST error:', error.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
