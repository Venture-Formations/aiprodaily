import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'
import { newsletterArchiver } from '@/lib/newsletter-archiver'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

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

    const mailerLiteService = new MailerLiteService()

    // Get main group ID from environment (for now - later can be from settings)
    const mainGroupId = process.env.MAILERLITE_MAIN_GROUP_ID

    if (!mainGroupId) {
      return NextResponse.json({
        error: 'Main group ID not configured'
      }, { status: 500 })
    }

    const result = await mailerLiteService.createFinalissue(issue, mainGroupId)

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
        console.log('✓ Newsletter archived successfully for', issue.date)
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
            details: { mailerlite_issue_id: result.issueId }
          }])
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Final issue scheduled successfully',
      mailerlite_issue_id: result.issueId
    })

  } catch (error) {
    console.error('Failed to send final issue:', error)
    return NextResponse.json({
      error: 'Failed to send final issue',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}