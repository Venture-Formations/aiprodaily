import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'
import { SlackNotificationService } from '@/lib/slack'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action } = await request.json()

    if (!action || action !== 'changes_made') {
      return NextResponse.json({
        error: 'Invalid action. Must be "changes_made"'
      }, { status: 400 })
    }

    const { id: campaignId } = await params

    // Get current campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({
        error: 'Campaign not found'
      }, { status: 404 })
    }

    // Update campaign status to changes_made and record the action
    const { error: updateError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .update({
        status: 'changes_made',
        last_action: action,
        last_action_at: new Date().toISOString(),
        last_action_by: session.user?.email || 'unknown'
      })
      .eq('id', campaignId)

    if (updateError) {
      console.error('Failed to update campaign status:', updateError)
      return NextResponse.json({
        error: 'Failed to update campaign status',
        details: updateError.message || 'Unknown database error',
        code: updateError.code || 'UNKNOWN'
      }, { status: 500 })
    }

    // Send Slack notification for changes made
    {
      try {
        const slack = new SlackNotificationService()
        const userName = session.user?.name || session.user?.email || 'Unknown User'

        // Format date like the dashboard: "Wednesday, September 17, 2025"
        // Parse date as local date to avoid timezone offset issues
        const [year, month, day] = campaign.date.split('-').map(Number)
        const date = new Date(year, month - 1, day) // month is 0-indexed
        const formattedDate = date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })

        await slack.sendAlert(
          `Campaign marked as "Changes Made" for ${formattedDate} by ${userName}`,
          'warn',
          'campaign_status_updates'
        )
      } catch (slackError) {
        console.error('Failed to send Slack notification:', slackError)
        // Don't fail the request if Slack fails
      }
    }

    // Log the action
    try {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', session.user?.email)
        .single()

      if (user) {
        await supabaseAdmin
          .from('user_activities')
          .insert([{
            user_id: user.id,
            action: `campaign_${action}`,
            details: {
              campaign_id: campaignId,
              campaign_date: campaign.date,
              action: action,
              previous_status: campaign.status
            }
          }])
      }
    } catch (logError) {
      console.error('Failed to log user activity:', logError)
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Campaign marked as having changes made',
      campaign: {
        id: campaignId,
        status: 'changes_made',
        last_action: action,
        last_action_at: new Date().toISOString(),
        last_action_by: session.user?.email
      }
    })

  } catch (error) {
    console.error('Campaign status update failed:', error)
    return NextResponse.json({
      error: 'Failed to update campaign status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}