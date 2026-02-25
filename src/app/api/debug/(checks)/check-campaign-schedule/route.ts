import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { ScheduleChecker } from '@/lib/schedule-checker'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-campaign-schedule' },
  async ({ request, logger }) => {
    console.log('=== issue SCHEDULE DEBUG ===')

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

    // Get current time info
    const nowUTC = new Date()
    const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate = new Date(nowCentral)

    // Calculate tomorrow's date
    const tomorrow = new Date(centralDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowDate = tomorrow.toISOString().split('T')[0]

    // Check schedule settings
    const shouldRunReviewSend = await ScheduleChecker.shouldRunReviewSend(activeNewsletter.id)
    const shouldRunissueCreation = await ScheduleChecker.shouldRunissueCreation(activeNewsletter.id)

    // Get email settings from database
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .or('key.eq.email_scheduledSendTime,key.eq.email_issueCreationTime,key.eq.email_reviewScheduleEnabled')

    const emailSettings: Record<string, string> = {}
    settings?.forEach(s => {
      emailSettings[s.key.replace('email_', '')] = s.value
    })

    // Find tomorrow's issue
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        id,
        date,
        status,
        subject_line,
        review_sent_at,
        articles:articles(id, is_active)
      `)
      .eq('date', tomorrowDate)
      .single()

    const activeArticles = issue?.articles?.filter((a: any) => a.is_active) || []

    return NextResponse.json({
      success: true,
      currentTime: {
        utc: nowUTC.toISOString(),
        central: nowCentral,
        centralHour: centralDate.getHours(),
        centralMinute: centralDate.getMinutes()
      },
      tomorrowDate,
      scheduleChecks: {
        shouldRunReviewSend,
        shouldRunissueCreation
      },
      emailSettings,
      issue: issue ? {
        id: issue.id,
        date: issue.date,
        status: issue.status,
        hasSubjectLine: !!issue.subject_line,
        subjectLine: issue.subject_line,
        reviewSentAt: issue.review_sent_at,
        totalArticles: issue.articles?.length || 0,
        activeArticles: activeArticles.length,
        readyForReview: issue.status === 'draft' && !!issue.subject_line && activeArticles.length > 0
      } : null,
      issueError: issueError?.message
    })
  }
)
