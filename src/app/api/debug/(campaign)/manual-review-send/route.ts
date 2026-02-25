import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(campaign)/manual-review-send' },
  async () => {
    console.log('=== MANUAL REVIEW SEND ===')

    // Get tomorrow's issue
    const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate = new Date(nowCentral)
    const tomorrow = new Date(centralDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const issueDate = tomorrow.toISOString().split('T')[0]

    console.log('Sending review for issue date:', issueDate)

    // Find tomorrow's issue with articles
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
      .eq('date', issueDate)
      .eq('status', 'draft')
      .single()

    if (issueError || !issue) {
      return NextResponse.json({
        success: false,
        error: 'No draft issue found for tomorrow',
        issueDate: issueDate,
        errorDetails: issueError
      }, { status: 404 })
    }

    console.log('Found issue:', issue.id, 'Status:', issue.status)

    // Check if issue has active articles
    const activeArticles = issue.articles.filter((article: any) => article.is_active)
    if (activeArticles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active articles found for review sending',
        issueId: issue.id
      }, { status: 400 })
    }

    console.log(`issue has ${activeArticles.length} active articles`)

    // Check if subject line exists
    if (!issue.subject_line || issue.subject_line.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'No subject line found for issue',
        issueId: issue.id
      }, { status: 400 })
    }

    console.log('Using subject line:', issue.subject_line)

    // Create MailerLite review campaign
    const mailerLiteService = new MailerLiteService()
    const result = await mailerLiteService.createReviewissue(issue)

    console.log('MailerLite issue created:', result.issueId)

    // Update issue status to in_review
    const { error: updateError } = await supabaseAdmin
      .from('publication_issues')
      .update({
        status: 'in_review',
        review_sent_at: new Date().toISOString()
      })
      .eq('id', issue.id)

    if (updateError) {
      console.error('Failed to update issue status:', updateError)
      // Continue anyway since MailerLite issue was created
    }

    console.log('=== MANUAL REVIEW SEND COMPLETED ===')

    return NextResponse.json({
      success: true,
      message: 'Review issue sent to MailerLite successfully',
      issueId: issue.id,
      issueDate: issueDate,
      mailerliteissueId: result.issueId,
      subjectLine: issue.subject_line,
      activeArticlesCount: activeArticles.length,
      timestamp: new Date().toISOString()
    })
  }
)
