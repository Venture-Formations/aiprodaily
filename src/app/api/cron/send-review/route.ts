import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'
import { ScheduleChecker } from '@/lib/schedule-checker'

export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: This legacy route should be deprecated in favor of trigger-workflow
    // Get first active newsletter for backward compatibility
    const { data: activeNewsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!activeNewsletter) {
      return NextResponse.json({
        success: false,
        error: 'No active newsletter found'
      }, { status: 404 })
    }

    console.log('=== AUTOMATED REVIEW SEND CHECK ===')
    console.log('Time:', new Date().toISOString())

    // Check if it's time to run review sending based on database settings
    const shouldRun = await ScheduleChecker.shouldRunReviewSend(activeNewsletter.id)

    if (!shouldRun) {
      return NextResponse.json({
        success: true,
        message: 'Not time to run review send or already ran today',
        skipped: true,
        timestamp: new Date().toISOString()
      })
    }

    console.log('=== REVIEW SEND STARTED (Time Matched) ===')
    console.log('Central Time:', new Date().toLocaleString("en-US", {timeZone: "America/Chicago"}))

    // Get tomorrow's issue that's in draft status and ready for review
    // Use Central Time for consistent date calculations
    const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate = new Date(nowCentral)
    const tomorrow = new Date(centralDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const issueDate = tomorrow.toISOString().split('T')[0]

    console.log('Sending review for tomorrow\'s issue date:', issueDate)

    // Get accounting newsletter ID
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('slug', 'accounting')
      .single()

    if (!newsletter) {
      return NextResponse.json({
        success: false,
        error: 'Accounting newsletter not found'
      }, { status: 404 })
    }

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
      .eq('publication_id', newsletter.id)
      .eq('date', issueDate)
      .eq('status', 'draft')
      .single()

    if (issueError || !issue) {
      return NextResponse.json({
        success: false,
        error: 'No draft issue found for tomorrow',
        issueDate: issueDate
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
        error: 'No subject line found for issue. Run subject line generation first.',
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

    console.log('=== REVIEW SEND COMPLETED ===')

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

  } catch (error) {
    console.error('=== REVIEW SEND FAILED ===')
    console.error('Error:', error)

    return NextResponse.json({
      success: false,
      error: 'Review send failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Handle GET requests from Vercel cron (no auth header, uses URL secret)
export async function GET(request: NextRequest) {
  try {
    // For Vercel cron: check secret in URL params, for manual: require secret param
    const searchParams = new URL(request.url).searchParams
    const secret = searchParams.get('secret')

    // Allow both manual testing (with secret param) and Vercel cron (no auth needed)
    const isVercelCron = !secret && !searchParams.has('secret')
    const isManualTest = secret === process.env.CRON_SECRET

    if (!isVercelCron && !isManualTest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: This legacy route should be deprecated in favor of trigger-workflow
    // Get first active newsletter for backward compatibility
    const { data: activeNewsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!activeNewsletter) {
      return NextResponse.json({
        success: false,
        error: 'No active newsletter found'
      }, { status: 404 })
    }

    console.log('=== AUTOMATED REVIEW SEND CHECK (GET) ===')
    console.log('Time:', new Date().toISOString())
    console.log('Request type:', isVercelCron ? 'Vercel Cron' : 'Manual Test')

    // Check if it's time to run review sending based on database settings
    const shouldRun = await ScheduleChecker.shouldRunReviewSend(activeNewsletter.id)

    if (!shouldRun) {
      return NextResponse.json({
        success: true,
        message: 'Not time to run review send or already ran today',
        skipped: true,
        timestamp: new Date().toISOString()
      })
    }

    console.log('=== REVIEW SEND STARTED (Time Matched) ===')
    console.log('Central Time:', new Date().toLocaleString("en-US", {timeZone: "America/Chicago"}))

    // Get tomorrow's issue that's in draft status and ready for review
    // Use Central Time for consistent date calculations
    const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate = new Date(nowCentral)
    const tomorrow = new Date(centralDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const issueDate = tomorrow.toISOString().split('T')[0]

    console.log('Sending review for tomorrow\'s issue date:', issueDate)

    // Get accounting newsletter ID
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('slug', 'accounting')
      .single()

    if (!newsletter) {
      return NextResponse.json({
        success: false,
        error: 'Accounting newsletter not found'
      }, { status: 404 })
    }

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
      .eq('publication_id', newsletter.id)
      .eq('date', issueDate)
      .eq('status', 'draft')
      .single()

    if (issueError || !issue) {
      return NextResponse.json({
        success: false,
        error: 'No draft issue found for tomorrow',
        issueDate: issueDate
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
        error: 'No subject line found for issue. Run subject line generation first.',
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

    console.log('=== REVIEW SEND COMPLETED ===')

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

  } catch (error) {
    console.error('=== REVIEW SEND FAILED ===')
    console.error('Error:', error)

    return NextResponse.json({
      success: false,
      error: 'Review send failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}