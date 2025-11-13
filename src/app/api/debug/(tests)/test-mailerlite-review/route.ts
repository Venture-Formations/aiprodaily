import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing MailerLite review issue creation...')

    // Get the latest issue
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        *,
        articles:articles!inner(
          *,
          rss_post:rss_posts!inner(
            *,
            post_rating:post_ratings!inner(*),
            rss_feed:rss_feeds!inner(*)
          )
        ),
        manual_articles:manual_articles(*),
        issue_events:issue_events(
          *,
          event:events(*)
        )
      `)
      .eq('articles.is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (issueError || !issue) {
      return NextResponse.json({
        success: false,
        error: 'No issue found',
        details: issueError?.message
      }, { status: 404 })
    }

    console.log(`Testing MailerLite integration for issue ${issue.id} (${issue.date})`)

    // Test MailerLite API connection
    const mailerLiteService = new MailerLiteService()

    try {
      console.log('Testing MailerLite review issue creation...')
      const result = await mailerLiteService.createReviewissue(issue)

      return NextResponse.json({
        success: true,
        message: 'MailerLite review issue created successfully',
        issueId: issue.id,
        issueDate: issue.date,
        mailerliteissueId: result.issueId,
        subjectLine: issue.subject_line,
        result: result
      })

    } catch (mailerLiteError) {
      console.error('MailerLite API error:', mailerLiteError)

      return NextResponse.json({
        success: false,
        error: 'MailerLite API failed',
        details: mailerLiteError instanceof Error ? mailerLiteError.message : 'Unknown MailerLite error',
        issueId: issue.id,
        issueDate: issue.date,
        hasSubjectLine: !!issue.subject_line,
        activeArticlesCount: issue.articles?.length || 0
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Debug test failed:', error)

    return NextResponse.json({
      success: false,
      error: 'Debug test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}