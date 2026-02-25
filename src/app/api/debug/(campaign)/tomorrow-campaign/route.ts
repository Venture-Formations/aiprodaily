import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(campaign)/tomorrow-campaign' },
  async () => {
    // Get tomorrow's date
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const issueDate = tomorrow.toISOString().split('T')[0]

    console.log('Checking for issue on date:', issueDate)

    // Check if issue exists for tomorrow
    const { data: issue, error } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        *,
        articles:articles(
          id,
          headline,
          is_active,
          rss_post:rss_posts(
            post_rating:post_ratings(total_score)
          )
        )
      `)
      .eq('date', issueDate)
      .single()

    if (error) {
      return NextResponse.json({
        debug: 'Tomorrow issue Check',
        issueDate,
        exists: false,
        error: error.message,
        recommendation: 'RSS processing needs to run to create tomorrow\'s issue'
      })
    }

    const activeArticles = issue.articles?.filter((article: any) => article.is_active) || []

    return NextResponse.json({
      debug: 'Tomorrow issue Check',
      issueDate,
      exists: true,
      issue: {
        id: issue.id,
        status: issue.status,
        subject_line: issue.subject_line,
        created_at: issue.created_at,
        total_articles: issue.articles?.length || 0,
        active_articles: activeArticles.length,
        review_sent_at: issue.review_sent_at
      },
      activeArticles: activeArticles.map((article: any) => ({
        id: article.id,
        headline: article.headline,
        ai_score: article.rss_post?.post_rating?.[0]?.total_score || 0
      })),
      issues: {
        no_subject_line: !issue.subject_line || issue.subject_line.trim() === '',
        no_active_articles: activeArticles.length === 0,
        wrong_status: issue.status !== 'draft',
        already_sent_review: !!issue.review_sent_at
      },
      recommendation: issue.status !== 'draft' ?
        `issue status is ${issue.status}, should be 'draft' for creation` :
        (!issue.subject_line || issue.subject_line.trim() === '') ?
        'No subject line - run subject line generation' :
        activeArticles.length === 0 ?
        'No active articles found' :
        'issue appears ready for creation'
    })
  }
)
