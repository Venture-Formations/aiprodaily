import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing MailerLite integration...')

    // Get the latest issue that's in draft status
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        *,
        articles:articles(
          *,
          rss_post:rss_posts(
            *,
            rss_feed:rss_feeds(*)
          )
        ),
        manual_articles:manual_articles(*)
      `)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (issueError || !issue) {
      // Try to get the latest in_review issue instead
      const { data: reviewissue, error: reviewError } = await supabaseAdmin
        .from('publication_issues')
        .select(`
          *,
          articles:articles(
            *,
            rss_post:rss_posts(
              *,
              rss_feed:rss_feeds(*)
            )
          ),
          manual_articles:manual_articles(*)
        `)
        .eq('status', 'in_review')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (reviewError || !reviewissue) {
        return NextResponse.json({
          success: false,
          error: 'No draft or in_review issues found for testing',
          drafttError: issueError?.message,
          reviewError: reviewError?.message
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        message: 'Found in_review issue (already processed)',
        issue: {
          id: reviewissue.id,
          date: reviewissue.date,
          status: reviewissue.status,
          subject_line: reviewissue.subject_line,
          review_sent_at: reviewissue.review_sent_at,
          active_articles: reviewissue.articles.filter((a: any) => a.is_active).length
        },
        note: 'This issue was already sent to MailerLite (status is in_review)'
      })
    }

    // Check if issue has required data
    const activeArticles = issue.articles.filter((article: any) => article.is_active)
    if (activeArticles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active articles found in issue',
        issueId: issue.id
      }, { status: 400 })
    }

    if (!issue.subject_line || issue.subject_line.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'No subject line found in issue',
        issueId: issue.id
      }, { status: 400 })
    }

    console.log(`Testing with issue ${issue.id} (${issue.date})`)
    console.log(`Active articles: ${activeArticles.length}`)
    console.log(`Subject line: ${issue.subject_line}`)

    // Test MailerLite service
    const mailerLiteService = new MailerLiteService()
    const result = await mailerLiteService.createReviewissue(issue)

    return NextResponse.json({
      success: true,
      message: 'MailerLite issue created successfully',
      result,
      issue: {
        id: issue.id,
        date: issue.date,
        subject_line: issue.subject_line,
        active_articles: activeArticles.length
      }
    })

  } catch (error) {
    console.error('MailerLite test failed:', error)
    return NextResponse.json({
      success: false,
      error: 'MailerLite test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}