import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateFullNewsletterHtml } from '@/lib/newsletter-templates'
import { withApiHandler } from '@/lib/api-handler'

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]/preview' },
  async ({ params }) => {
    const id = params.id

    console.log('Preview API called')
    console.log('issue ID:', id)

    console.log('Fetching issue with ID:', id)
    // Fetch issue with active module_articles and events
    // Uses broad select because generateFullNewsletterHtml needs many issue fields for template rendering
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        *,
        module_articles:module_articles(
          *,
          rss_post:rss_posts(
            source_url,
            image_url,
            author,
            rss_feed:rss_feeds(name)
          ),
          article_module:article_modules(name, display_order)
        ),
        manual_articles:manual_articles(*),
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

    console.log('issue found, module_articles count:', issue.module_articles?.length || 0)
    console.log('issue events count:', issue.issue_events?.length || 0)

    // Filter to only active module_articles (max 5)
    if (issue.module_articles) {
      const beforeFilter = issue.module_articles.length
      issue.module_articles = issue.module_articles
        .filter((article: any) => article.is_active)
        .sort((a: any, b: any) => (a.rank || 999) - (b.rank || 999))
        .slice(0, 5) // Limit to 5 articles maximum
      console.log('Active module_articles after filter:', issue.module_articles.length, 'from', beforeFilter, '(max 5)')
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
  }
)
