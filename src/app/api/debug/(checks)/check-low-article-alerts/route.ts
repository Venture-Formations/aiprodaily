import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get last 10 days of campaigns
    const tenDaysAgo = new Date()
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)

    const { data: campaigns, error: issuesError } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, status, created_at')
      .gte('created_at', tenDaysAgo.toISOString())
      .order('created_at', { ascending: false })

    if (issuesError) throw issuesError

    // Get article counts for each issue
    const campaignsWithCounts = await Promise.all(
      (campaigns || []).map(async (issue) => {
        const { data: articles, error: articlesError } = await supabaseAdmin
          .from('articles')
          .select('id, is_active')
          .eq('issue_id', issue.id)

        const activeCount = articles?.filter(a => a.is_active).length || 0
        const totalCount = articles?.length || 0

        // Check system logs for low article count alerts
        const { data: lowCountLogs } = await supabaseAdmin
          .from('system_logs')
          .select('created_at, message, context')
          .eq('source', 'slack_service')
          .ilike('message', '%Low Article Count%')
          .eq('context->>issueId', issue.id)
          .order('created_at', { ascending: false })
          .limit(1)

        // Check for RSS processing complete logs
        const { data: rssLogs } = await supabaseAdmin
          .from('system_logs')
          .select('created_at, message, context')
          .eq('source', 'slack_service')
          .ilike('message', '%RSS Processing%')
          .or(`context->>issueId.eq.${issue.id}`)
          .order('created_at', { ascending: false })
          .limit(5)

        return {
          issue_id: issue.id,
          date: issue.date,
          status: issue.status,
          created_at: issue.created_at,
          active_articles: activeCount,
          total_articles: totalCount,
          low_count_alert_sent: lowCountLogs && lowCountLogs.length > 0,
          low_count_alert_time: lowCountLogs?.[0]?.created_at || null,
          rss_logs_found: rssLogs?.length || 0,
          should_have_triggered_alert: activeCount <= 6 && activeCount > 0
        }
      })
    )

    // Identify campaigns that should have triggered alerts but didn't
    const missedAlerts = campaignsWithCounts.filter(c =>
      c.should_have_triggered_alert && !c.low_count_alert_sent
    )

    // Check app settings for notification enabled status
    const { data: notificationSetting } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .eq('key', 'slack_low_article_count_enabled')
      .single()

    const { data: rssProcessingSetting } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .eq('key', 'slack_rss_processing_updates_enabled')
      .single()

    return NextResponse.json({
      success: true,
      summary: {
        total_issues: campaigns?.length || 0,
        campaigns_with_low_article_count: campaignsWithCounts.filter(c => c.active_articles <= 6).length,
        alerts_sent: campaignsWithCounts.filter(c => c.low_count_alert_sent).length,
        missed_alerts: missedAlerts.length
      },
      notification_settings: {
        low_article_count_enabled: notificationSetting?.value === 'true' || !notificationSetting,
        rss_processing_updates_enabled: rssProcessingSetting?.value === 'true' || !rssProcessingSetting,
        low_article_count_setting_exists: !!notificationSetting,
        rss_processing_setting_exists: !!rssProcessingSetting
      },
      issues: campaignsWithCounts,
      missed_alerts: missedAlerts
    })
  } catch (error) {
    console.error('Error checking low article alerts:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
