import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET - Fetch all RSS feeds for the current newsletter
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'rss-feeds' },
  async () => {
    // Get newsletter context (for now, using first newsletter)
    const { data: newsletters } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!newsletters) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

    // Fetch RSS feeds for this newsletter
    const { data: feeds, error } = await supabaseAdmin
      .from('rss_feeds')
      .select('*')
      .eq('publication_id', newsletters.id)
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
  { authTier: 'authenticated', logContext: 'rss-feeds' },
  async ({ request }) => {
    const body = await request.json()
    const { url, name, description, active = true } = body

    if (!url || !name) {
      return NextResponse.json(
        { error: 'URL and name are required' },
        { status: 400 }
      )
    }

    // Get newsletter context
    const { data: newsletters } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!newsletters) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

    // Create the RSS feed
    const { data: feed, error } = await supabaseAdmin
      .from('rss_feeds')
      .insert({
        publication_id: newsletters.id,
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
