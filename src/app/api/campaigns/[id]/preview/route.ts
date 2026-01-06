import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { generateFullNewsletterHtml } from '@/lib/newsletter-templates'

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    console.log('Preview API called')
    const { id } = await props.params
    console.log('issue ID:', id)

    const session = await getServerSession(authOptions)
    console.log('Session check:', !!session?.user?.email)

    if (!session?.user?.email) {
      console.log('Authorization failed - no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Fetching issue with ID:', id)
    // Fetch issue with active articles and events
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        *,
        articles(
          id,
          headline,
          content,
          word_count,
          fact_check_score,
          is_active,
          rank,
          rss_post:rss_posts(
            source_url,
            image_url,
            author,
            rss_feed:rss_feeds(name)
          )
        ),
        issue_events(
          id,
          event_date,
          is_selected,
          is_featured,
          display_order,
          event:events(
            id,
            title,
            description,
            event_summary,
            start_date,
            end_date,
            venue,
            address,
            url,
            image_url,
            cropped_image_url
          )
        )
      `)
      .eq('id', id)
      .single()

    console.log('issue query result:', { issue: !!issue, error: issueError })

    if (issueError) {
      console.error('issue fetch error:', issueError)
      return NextResponse.json({ error: `issue fetch failed: ${issueError.message}` }, { status: 404 })
    }

    if (!issue) {
      console.log('No issue found')
      return NextResponse.json({ error: 'issue not found' }, { status: 404 })
    }

    console.log('issue found, articles count:', issue.articles?.length || 0)
    console.log('issue events count:', issue.issue_events?.length || 0)

    // Filter to only active articles (max 5)
    if (issue.articles) {
      const beforeFilter = issue.articles.length
      issue.articles = issue.articles
        .filter((article: any) => article.is_active)
        .sort((a: any, b: any) => (b.rss_post?.post_rating?.[0]?.total_score || 0) - (a.rss_post?.post_rating?.[0]?.total_score || 0))
        .slice(0, 5) // Limit to 5 articles maximum
      console.log('Active articles after filter:', issue.articles.length, 'from', beforeFilter, '(max 5)')
    }

    // Filter to only selected events and group by date
    const eventsData = (issue.issue_events || [])
      .filter((ce: any) => ce.is_selected && ce.event)
      .sort((a: any, b: any) => (a.display_order ?? 999) - (b.display_order ?? 999))
    console.log('Selected events after filter:', eventsData.length)

    console.log('Generating HTML newsletter using shared template')
    // Generate HTML newsletter using the shared function (single source of truth)
    const newsletterHtml = await generateFullNewsletterHtml(issue, { isReview: false })
    console.log('HTML generated, length:', newsletterHtml.length)

    return NextResponse.json({
      success: true,
      issue,
      html: newsletterHtml
    })

  } catch (error) {
    console.error('Preview generation error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: `Failed to generate newsletter preview: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}