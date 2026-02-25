import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-latest-campaign' },
  async ({ logger }) => {
    // Get latest issue
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (issueError || !issue) {
      return NextResponse.json({ error: 'No issue found' }, { status: 404 })
    }

    // Check AI app selections
    const { data: aiApps, error: appsError } = await supabaseAdmin
      .from('issue_ai_app_selections')
      .select('*, app:ai_applications(*)')
      .eq('issue_id', issue.id)

    // Check prompt selections
    const { data: prompts, error: promptsError } = await supabaseAdmin
      .from('issue_prompt_selections')
      .select('*, prompt:prompt_ideas(*)')
      .eq('issue_id', issue.id)

    // Check email metrics for MailerLite issue ID
    const { data: metrics, error: metricsError } = await supabaseAdmin
      .from('email_metrics')
      .select('*')
      .eq('issue_id', issue.id)

    // Get system logs for this issue
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('system_logs')
      .select('*')
      .eq('context->>issueId', issue.id)
      .order('timestamp', { ascending: false })
      .limit(20)

    return NextResponse.json({
      success: true,
      issue: {
        id: issue.id,
        date: issue.date,
        status: issue.status,
        subject_line: issue.subject_line,
        review_sent_at: issue.review_sent_at,
        created_at: issue.created_at
      },
      ai_apps: {
        count: aiApps?.length || 0,
        error: appsError?.message || null,
        apps: aiApps?.map(s => ({
          app_name: s.app?.app_name,
          selection_order: s.selection_order
        })) || []
      },
      prompts: {
        count: prompts?.length || 0,
        error: promptsError?.message || null,
        prompts: prompts?.map(p => ({
          title: p.prompt?.title,
          selection_order: p.selection_order
        })) || []
      },
      email_metrics: {
        found: !!metrics,
        mailerlite_issue_id: metrics?.[0]?.mailerlite_issue_id || null,
        error: metricsError?.message || null
      },
      recent_logs: logs || []
    })
  }
)
