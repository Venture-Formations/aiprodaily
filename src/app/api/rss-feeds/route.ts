import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET - Fetch all RSS feeds for the current newsletter
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'rss-feeds' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const publicationId = searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json({ error: 'publication_id query parameter is required' }, { status: 400 })
    }

    // Fetch RSS feeds for this publication
    const { data: feeds, error } = await supabaseAdmin
      .from('rss_feeds')
      .select('id, publication_id, url, name, description, active, last_processed, processing_errors, last_error, use_for_primary_section, use_for_secondary_section, article_module_id, created_at, updated_at')
      .eq('publication_id', publicationId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching RSS feeds:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      feeds: feeds || []
    })
  }
)

/**
 * POST - Create a new RSS feed
 */
export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'rss-feeds' },
  async ({ request }) => {
    const body = await request.json()
    const { url, name, description, active = true, publication_id } = body

    if (!url || !name) {
      return NextResponse.json(
        { error: 'URL and name are required' },
        { status: 400 }
      )
    }

    if (!publication_id) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    // Create the RSS feed
    const { data: feed, error } = await supabaseAdmin
      .from('rss_feeds')
      .insert({
        publication_id,
        url,
        name,
        description: description || null,
        active,
        processing_errors: 0
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating RSS feed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'RSS feed created successfully',
      feed
    })
  }
)
