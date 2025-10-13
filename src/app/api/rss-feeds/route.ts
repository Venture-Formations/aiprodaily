import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { RssFeed } from '@/types/database'

/**
 * GET - Fetch all RSS feeds for the current newsletter
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get newsletter context (for now, using first newsletter)
    const { data: newsletters } = await supabaseAdmin
      .from('newsletters')
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
      .eq('newsletter_id', newsletters.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching RSS feeds:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      feeds: feeds || []
    })

  } catch (error) {
    console.error('RSS feeds error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST - Create a new RSS feed
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      .from('newsletters')
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
        newsletter_id: newsletters.id,
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

  } catch (error) {
    console.error('Create RSS feed error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
