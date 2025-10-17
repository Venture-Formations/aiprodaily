import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get latest campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'No campaign found' }, { status: 404 })
    }

    // Check AI app selections
    const { data: aiApps, error: appsError } = await supabaseAdmin
      .from('campaign_ai_app_selections')
      .select('*, app:ai_applications(*)')
      .eq('campaign_id', campaign.id)

    // Check prompt selections
    const { data: prompts, error: promptsError } = await supabaseAdmin
      .from('campaign_prompt_selections')
      .select('*, prompt:prompt_ideas(*)')
      .eq('campaign_id', campaign.id)

    // Check email metrics for MailerLite campaign ID
    const { data: metrics, error: metricsError } = await supabaseAdmin
      .from('email_metrics')
      .select('*')
      .eq('campaign_id', campaign.id)

    // Get system logs for this campaign
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('system_logs')
      .select('*')
      .eq('context->>campaignId', campaign.id)
      .order('timestamp', { ascending: false })
      .limit(20)

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        date: campaign.date,
        status: campaign.status,
        subject_line: campaign.subject_line,
        review_sent_at: campaign.review_sent_at,
        created_at: campaign.created_at
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
        mailerlite_campaign_id: metrics?.[0]?.mailerlite_campaign_id || null,
        error: metricsError?.message || null
      },
      recent_logs: logs || []
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
