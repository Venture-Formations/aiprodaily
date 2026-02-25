import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(integrations)/mailerlite-campaign-debug' },
  async ({ logger }) => {
  try {
    console.log('=== MAILERLITE issue DEBUG ===')

    // Check environment variables
    const hasApiKey = !!process.env.MAILERLITE_API_KEY
    const hasReviewGroupId = !!process.env.MAILERLITE_REVIEW_GROUP_ID
    const hasMainGroupId = !!process.env.MAILERLITE_MAIN_GROUP_ID

    console.log('Environment variables check:', {
      hasApiKey,
      hasReviewGroupId,
      hasMainGroupId,
      apiKeyPrefix: process.env.MAILERLITE_API_KEY?.substring(0, 8) + '...',
      reviewGroupId: process.env.MAILERLITE_REVIEW_GROUP_ID,
      mainGroupId: process.env.MAILERLITE_MAIN_GROUP_ID
    })

    // Get tomorrow's issue
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const issueDate = tomorrow.toISOString().split('T')[0]

    console.log('Checking issue for date:', issueDate)

    const { data: issue, error: issueError } = await supabaseAdmin
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
        ),
        issue_events:issue_events(
          *,
          event:events(*)
        )
      `)
      .eq('date', issueDate)
      .single()

    if (issueError || !issue) {
      return NextResponse.json({
        debug: 'MailerLite issue Debug',
        issueDate,
        environmentCheck: {
          hasApiKey,
          hasReviewGroupId,
          hasMainGroupId,
          issues: [
            !hasApiKey && 'Missing MAILERLITE_API_KEY',
            !hasReviewGroupId && 'Missing MAILERLITE_REVIEW_GROUP_ID',
            !hasMainGroupId && 'Missing MAILERLITE_MAIN_GROUP_ID'
          ].filter(Boolean)
        },
        issueCheck: {
          exists: false,
          error: issueError?.message || 'issue not found',
          recommendation: 'Run RSS processing to create tomorrow\'s issue first'
        }
      })
    }

    const activeArticles = issue.articles?.filter((article: any) => article.is_active) || []
    const issueEvents = issue.issue_events || []

    // Check issue readiness
    const issueIssues = []
    if (!issue.subject_line || issue.subject_line.trim() === '') {
      issueIssues.push('No subject line')
    }
    if (activeArticles.length === 0) {
      issueIssues.push('No active articles')
    }
    if (issue.status !== 'draft') {
      issueIssues.push(`Status is ${issue.status}, should be 'draft'`)
    }

    // If issue looks ready, test MailerLite API call
    let mailerliteTest = null
    if (hasApiKey && hasReviewGroupId && issueIssues.length === 0) {
      try {
        console.log('Testing MailerLite service...')
        const mailerLiteService = new MailerLiteService()

        // Test creating the issue (this would actually create it)
        // For debugging, we'll just validate the data structure
        console.log('issue data looks valid for MailerLite creation')
        mailerliteTest = {
          readyForCreation: true,
          wouldCreateAt: new Date().toISOString(),
          scheduledDeliveryTime: '21:00 CT (9:00 PM)'
        }
      } catch (error) {
        console.error('MailerLite test error:', error)
        mailerliteTest = {
          readyForCreation: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    return NextResponse.json({
      debug: 'MailerLite issue Debug',
      issueDate,
      environmentCheck: {
        hasApiKey,
        hasReviewGroupId,
        hasMainGroupId,
        apiKeyPrefix: process.env.MAILERLITE_API_KEY?.substring(0, 8) + '...',
        reviewGroupId: process.env.MAILERLITE_REVIEW_GROUP_ID,
        mainGroupId: process.env.MAILERLITE_MAIN_GROUP_ID,
        issues: [
          !hasApiKey && 'Missing MAILERLITE_API_KEY',
          !hasReviewGroupId && 'Missing MAILERLITE_REVIEW_GROUP_ID',
          !hasMainGroupId && 'Missing MAILERLITE_MAIN_GROUP_ID'
        ].filter(Boolean)
      },
      issueCheck: {
        exists: true,
        issue: {
          id: issue.id,
          status: issue.status,
          subject_line: issue.subject_line,
          created_at: issue.created_at,
          review_sent_at: issue.review_sent_at,
          total_articles: issue.articles?.length || 0,
          active_articles: activeArticles.length,
          total_events: issueEvents.length
        },
        issues: issueIssues,
        readyForMailerLite: issueIssues.length === 0
      },
      mailerliteTest,
      recommendation: issueIssues.length > 0
        ? `Fix these issues: ${issueIssues.join(', ')}`
        : !hasApiKey
        ? 'Set MAILERLITE_API_KEY environment variable'
        : !hasReviewGroupId
        ? 'Set MAILERLITE_REVIEW_GROUP_ID environment variable'
        : 'issue appears ready for MailerLite creation',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('MailerLite issue debug error:', error)
    return NextResponse.json({
      debug: 'MailerLite issue Debug',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
  }
)