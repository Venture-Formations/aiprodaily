import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET - Fetch all RSS sources (authors) with post counts and image blocking status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all unique authors from rss_posts with their post counts
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .select('author')

    if (postsError) {
      console.error('Error fetching RSS posts:', postsError)
      return NextResponse.json({ error: postsError.message }, { status: 500 })
    }

    // Get excluded sources from settings table
    const { data: excludedSettings, error: settingsError } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'excluded_rss_sources')
      .single()

    const excludedSources: string[] = excludedSettings?.value
      ? JSON.parse(excludedSettings.value)
      : []

    // Count posts by author
    const authorCounts: { [key: string]: number } = {}
    posts?.forEach(post => {
      const author = post.author || '(No Author)'
      authorCounts[author] = (authorCounts[author] || 0) + 1
    })

    // Build sources array
    const sources = Object.entries(authorCounts).map(([author, count]) => ({
      author,
      post_count: count,
      excluded: excludedSources.includes(author)
    }))

    // Sort by post count descending
    sources.sort((a, b) => b.post_count - a.post_count)

    return NextResponse.json({
      success: true,
      sources
    })

  } catch (error) {
    console.error('RSS sources error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Update exclusion status for a source
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { author, excluded } = body

    if (!author || typeof excluded !== 'boolean') {
      return NextResponse.json(
        { error: 'Author and excluded status required' },
        { status: 400 }
      )
    }

    // Get current excluded sources
    const { data: currentSettings, error: fetchError } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'excluded_rss_sources')
      .single()

    console.log('Current settings fetch:', { currentSettings, fetchError })

    let excludedSources: string[] = currentSettings?.value
      ? JSON.parse(currentSettings.value)
      : []

    console.log('Current excluded sources:', excludedSources)

    // Update the list
    if (excluded) {
      // Add to excluded list if not already there
      if (!excludedSources.includes(author)) {
        excludedSources.push(author)
      }
    } else {
      // Remove from excluded list
      excludedSources = excludedSources.filter(s => s !== author)
    }

    console.log('Updated excluded sources:', excludedSources)

    // Save back to settings
    const { error: updateError } = await supabaseAdmin
      .from('app_settings')
      .upsert({
        key: 'excluded_rss_sources',
        value: JSON.stringify(excludedSources),
        description: 'List of RSS post authors/sources whose images should be blocked (posts still processed, but without images)',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })

    if (updateError) {
      console.error('Error updating excluded sources:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Images from "${author}" ${excluded ? 'blocked' : 'unblocked'} successfully`
    })

  } catch (error) {
    console.error('Update RSS source error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
