import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { emailMetricsService } from '@/lib/email-metrics'
import { withApiHandler } from '@/lib/api-handler'

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'analytics/[campaign]' },
  async ({ params }) => {
    const issueId = params.campaign

    // Fetch issue metrics
    const { data: metrics, error } = await supabaseAdmin
      .from('email_metrics')
      .select('*')
      .eq('issue_id', issueId)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Metrics not found' }, { status: 404 })
    }

    return NextResponse.json({ metrics })
  }
)

export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'analytics/[campaign]' },
  async ({ params }) => {
    const issueId = params.campaign

    console.log(`[Analytics Refresh] Starting manual refresh for issue ${issueId}`)

    // Import fresh metrics using hybrid service (SendGrid or MailerLite based on campaign type)
    const metrics = await emailMetricsService.importMetrics(issueId)

    // Check if metrics is a skip indicator
    const isSkipped = metrics && typeof metrics === 'object' && 'skipped' in metrics
    console.log(`[Analytics Refresh] Completed for issue ${issueId}:`, {
      skipped: isSkipped,
      reason: isSkipped ? (metrics as any).reason : null
    })

    return NextResponse.json({
      success: true,
      message: 'Metrics imported successfully',
      metrics
    })
  }
)
