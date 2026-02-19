import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'
import { authOptions } from '@/lib/auth'
import { getPublicationSetting } from '@/lib/publication-settings'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Fetch issue with articles, manual articles, and events
    const { data: issue, error } = await supabaseAdmin
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
        manual_articles:manual_articles(*),
        issue_events(
          id,
          event_date,
          is_selected,
          is_featured,
          display_order,
          event:events(
            id,
            title,
            description,
            start_date,
            end_date,
            venue,
            address,
            url,
            image_url
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error || !issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    // Get the email provider setting
    const emailProvider = await getPublicationSetting(issue.publication_id, 'email_provider') || 'mailerlite'

    if (emailProvider === 'mailerlite') {
      // Get test group ID from publication settings
      const testGroupId = await getPublicationSetting(issue.publication_id, 'mailerlite_test_group_id')

      if (!testGroupId) {
        return NextResponse.json({
          error: 'Test Group ID not configured. Go to Settings > Email and set the MailerLite Test Group ID.'
        }, { status: 400 })
      }

      const mailerliteService = new MailerLiteService()
      const result = await mailerliteService.createTestIssue(issue, testGroupId)

      return NextResponse.json({
        success: true,
        message: 'Test email scheduled! Check your inbox in ~2 minutes.',
        campaignId: result.campaignId
      })
    } else {
      // SendGrid test send
      const testListId = await getPublicationSetting(issue.publication_id, 'sendgrid_test_list_id')

      if (!testListId) {
        return NextResponse.json({
          error: 'Test List ID not configured. Go to Settings > Email and set the SendGrid Test List ID.'
        }, { status: 400 })
      }

      // TODO: Implement SendGrid test send when needed
      return NextResponse.json({
        error: 'SendGrid test send not yet implemented'
      }, { status: 501 })
    }

  } catch (error) {
    console.error('Failed to send test email:', error)
    return NextResponse.json({
      error: 'Failed to send test email',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
