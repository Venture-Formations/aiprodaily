import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const issueId = url.searchParams.get('issue_id')

    if (!issueId) {
      return NextResponse.json({ error: 'issueId required' }, { status: 400 })
    }

    console.log('Fetching issue data for:', issueId)

    // Test 1: Check issue_ai_app_selections table directly
    const { data: selections, error: selectionsError } = await supabaseAdmin
      .from('issue_ai_app_selections')
      .select('*')
      .eq('issue_id', issueId)

    console.log('Direct selections query:', selections?.length || 0, 'results')
    if (selectionsError) {
      console.error('Selections error:', selectionsError)
    }

    // Test 2: Check with join to ai_applications
    const { data: selectionsWithApps, error: joinError } = await supabaseAdmin
      .from('issue_ai_app_selections')
      .select('*, app:ai_applications(*)')
      .eq('issue_id', issueId)

    console.log('Selections with apps join:', selectionsWithApps?.length || 0, 'results')
    if (joinError) {
      console.error('Join error:', joinError)
    }

    // Test 3: Full issue query (same as issue detail page)
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        *,
        articles:articles(
          *,
          rss_post:rss_posts(
            *,
            post_rating:post_ratings(*),
            rss_feed:rss_feeds(*)
          )
        ),
        secondary_articles:secondary_articles(
          *,
          rss_post:rss_posts(
            *,
            post_rating:post_ratings(*),
            rss_feed:rss_feeds(*)
          )
        ),
        manual_articles:manual_articles(*),
        email_metrics(*),
        issue_ai_app_selections(
          *,
          app:ai_applications(*)
        )
      `)
      .eq('id', issueId)
      .single()

    console.log('Full issue query:', {
      found: !!issue,
      ai_apps_count: issue?.issue_ai_app_selections?.length || 0
    })

    if (issueError) {
      console.error('issue error:', issueError)
    }

    return NextResponse.json({
      success: true,
      issue_id: issueId,
      test_results: {
        direct_selections: {
          count: selections?.length || 0,
          error: selectionsError?.message || null,
          data: selections
        },
        selections_with_apps: {
          count: selectionsWithApps?.length || 0,
          error: joinError?.message || null,
          data: selectionsWithApps
        },
        full_issue: {
          found: !!issue,
          ai_apps_count: issue?.issue_ai_app_selections?.length || 0,
          error: issueError?.message || null,
          ai_apps: issue?.issue_ai_app_selections
        }
      }
    })

  } catch (error) {
    console.error('Check issue data error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
