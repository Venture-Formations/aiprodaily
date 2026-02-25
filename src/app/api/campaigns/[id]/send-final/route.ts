import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SendGridService } from '@/lib/sendgrid'
import { newsletterArchiver } from '@/lib/newsletter-archiver'
import { withApiHandler } from '@/lib/api-handler'

export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]/send-final' },
  async ({ params, session }) => {
    const id = params.id

    // Fetch issue with articles
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
        manual_articles:manual_articles(*)
      `)
      .eq('id', id)
      .single()

    if (error || !issue) {
      return NextResponse.json({ error: 'issue not found' }, { status: 404 })
    }

    if (issue.status !== 'approved' && issue.status !== 'in_review') {
      return NextResponse.json({
        error: 'issue must be approved before sending final version'
      }, { status: 400 })
    }

    // Check if we have active articles
    const activeArticles = issue.articles.filter((article: any) => article.is_active)
    if (activeArticles.length === 0) {
      return NextResponse.json({
        error: 'Cannot send issue with no active articles'
      }, { status: 400 })
    }

    const sendGridService = new SendGridService()

    const result = await sendGridService.createFinalCampaign(issue)

    if (!result.success) {
      throw new Error(result.error || 'Failed to create SendGrid campaign')
    }

    console.log('SendGrid campaign created:', result.campaignId)

    // Record advertisement usage and advance rotation
    try {
      const { data: adAssignment } = await supabaseAdmin
        .from('issue_advertisements')
        .select('advertisement_id')
        .eq('issue_id', id)
        .maybeSingle()

      if (adAssignment) {
        const { AdScheduler } = await import('@/lib/ad-scheduler')
        await AdScheduler.recordAdUsage(id, adAssignment.advertisement_id, issue.date, issue.publication_id)
        console.log('[Send Final] Advertisement usage recorded and rotation advanced')
      }
    } catch (adError) {
      console.error('[Send Final] Failed to record ad usage (non-critical):', adError)
      // Don't fail the send if ad tracking fails
    }

    // Archive the newsletter for website display
    try {
      const archiveResult = await newsletterArchiver.archiveNewsletter({
        issueId: issue.id,
        issueDate: issue.date,
        subjectLine: issue.subject_line || 'Newsletter',
        recipientCount: 0 // Will be updated with actual stats later
      })

      if (!archiveResult.success) {
        console.error('Failed to archive newsletter:', archiveResult.error)
        // Don't fail the send if archiving fails
      } else {
        console.log('Newsletter archived successfully for', issue.date)
      }
    } catch (archiveError) {
      console.error('Error archiving newsletter:', archiveError)
      // Don't fail the send if archiving fails
    }

    // Log user activity
    if (session.user?.email) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

      if (user) {
        await supabaseAdmin
          .from('user_activities')
          .insert([{
            user_id: user.id,
            issue_id: id,
            action: 'final_issue_sent',
            details: { sendgrid_campaign_id: result.campaignId }
          }])
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Final campaign scheduled successfully via SendGrid',
      sendgrid_campaign_id: result.campaignId
    })
  }
)
