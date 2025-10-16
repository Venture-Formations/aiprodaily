import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ScheduleChecker } from '@/lib/schedule-checker'

export async function GET(request: NextRequest) {
  try {
    console.log('=== CAMPAIGN SCHEDULE DEBUG ===')

    // Get current time info
    const nowUTC = new Date()
    const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
    const centralDate = new Date(nowCentral)

    // Calculate tomorrow's date
    const tomorrow = new Date(centralDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowDate = tomorrow.toISOString().split('T')[0]

    // Check schedule settings
    const shouldRunReviewSend = await ScheduleChecker.shouldRunReviewSend()
    const shouldRunCampaignCreation = await ScheduleChecker.shouldRunCampaignCreation()

    // Get email settings from database
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .or('key.eq.email_scheduledSendTime,key.eq.email_campaignCreationTime,key.eq.email_reviewScheduleEnabled')

    const emailSettings: Record<string, string> = {}
    settings?.forEach(s => {
      emailSettings[s.key.replace('email_', '')] = s.value
    })

    // Find tomorrow's campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
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

    const activeArticles = campaign?.articles?.filter((a: any) => a.is_active) || []

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
        shouldRunCampaignCreation
      },
      emailSettings,
      campaign: campaign ? {
        id: campaign.id,
        date: campaign.date,
        status: campaign.status,
        hasSubjectLine: !!campaign.subject_line,
        subjectLine: campaign.subject_line,
        reviewSentAt: campaign.review_sent_at,
        totalArticles: campaign.articles?.length || 0,
        activeArticles: activeArticles.length,
        readyForReview: campaign.status === 'draft' && !!campaign.subject_line && activeArticles.length > 0
      } : null,
      campaignError: campaignError?.message
    })
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
