import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'

export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('=== AUTOMATED FINAL NEWSLETTER SEND STARTED ===')
    console.log('Time:', new Date().toISOString())

    // Get tomorrow's issue (review should have been scheduled by create-issue cron)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const issueDate = tomorrow.toISOString().split('T')[0]

    console.log('Sending final newsletter for tomorrow\'s issue date:', issueDate)

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
      .single()

    if (issueError || !issue) {
      return NextResponse.json({
        success: false,
        error: 'No issue found for tomorrow',
        issueDate: issueDate
      }, { status: 404 })
    }

    console.log('Found issue:', issue.id, 'Status:', issue.status)

    // Only send if issue is in_review or changes_made status
    if (issue.status !== 'in_review' && issue.status !== 'changes_made') {
      return NextResponse.json({
        success: true,
        message: `issue status is ${issue.status}, skipping newsletter send`,
        issueId: issue.id,
        skipped: true
      })
    }

    // Check if already sent
    if (issue.final_sent_at) {
      return NextResponse.json({
        success: true,
        message: 'Newsletter already sent',
        issueId: issue.id,
        sentAt: issue.final_sent_at,
        skipped: true
      })
    }

    // Check if issue has active articles
    const activeArticles = issue.articles.filter((article: any) => article.is_active)
    if (activeArticles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active articles found for newsletter send',
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

    // Send final newsletter via MailerLite
    const mailerLiteService = new MailerLiteService()

    // Get main group ID from settings
    const { data: settingsRows } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .eq('key', 'email_mainGroupId')
      .single()

    const mainGroupId = settingsRows?.value || process.env.MAILERLITE_MAIN_GROUP_ID

    if (!mainGroupId) {
      throw new Error('Main group ID not found in settings or environment')
    }

    // Create final issue for main audience
    const result = await mailerLiteService.createFinalissue(issue, mainGroupId)

    console.log('MailerLite final issue created:', result.issueId)

    // Update issue status to sent and capture the previous status
    const { error: updateError } = await supabaseAdmin
      .from('publication_issues')
      .update({
        status: 'sent',
        status_before_send: issue.status, // Capture the status before sending
        final_sent_at: new Date().toISOString(),
        metrics: {
          ...issue.metrics,
          mailerlite_issue_id: result.issueId,
          sent_timestamp: new Date().toISOString()
        }
      })
      .eq('id', issue.id)

    if (updateError) {
      console.error('Failed to update issue status:', updateError)
      // Continue anyway since MailerLite issue was created
    }

    console.log('=== FINAL NEWSLETTER SEND COMPLETED ===')

    return NextResponse.json({
      success: true,
      message: 'Final newsletter sent successfully to main group',
      issueId: issue.id,
      issueDate: issueDate,
      mailerliteissueId: result.issueId,
      subjectLine: issue.subject_line,
      activeArticlesCount: activeArticles.length,
      mainGroupId: mainGroupId,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('=== NEWSLETTER SEND FAILED ===')
    console.error('Error:', error)

    // Update issue status to failed if we can identify the issue
    const today = new Date()
    const issueDate = today.toISOString().split('T')[0]

    try {
      await supabaseAdmin
        .from('publication_issues')
        .update({ status: 'failed' })
        .eq('date', issueDate)
    } catch (updateError) {
      console.error('Failed to update issue status to failed:', updateError)
    }

    return NextResponse.json({
      success: false,
      error: 'Newsletter send failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Also allow GET for manual testing
export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams
  const secret = searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Create a fake POST request for processing
  const fakeRequest = new Request(request.url, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${process.env.CRON_SECRET}`
    }
  })

  return POST(fakeRequest as NextRequest)
}