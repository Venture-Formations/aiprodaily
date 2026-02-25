import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SendGridService } from '@/lib/sendgrid'
import { withApiHandler } from '@/lib/api-handler'

export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]/send-review' },
  async ({ params, session, request }) => {
    const id = params.id
    const body = await request.json().catch(() => ({}))
    const forcedSubjectLine = body.force_subject_line

    console.log('=== SEND REVIEW REQUEST ===')
    console.log('Forced subject line from frontend:', forcedSubjectLine)

    // Fetch issue with articles and events
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
      return NextResponse.json({ error: 'issue not found' }, { status: 404 })
    }

    if (issue.status !== 'draft' && issue.status !== 'in_review' && issue.status !== 'changes_made') {
      return NextResponse.json({
        error: 'issue cannot be sent for review in current status'
      }, { status: 400 })
    }

    console.log('=== SEND FOR REVIEW DEBUG ===')
    console.log('issue object received:', {
      id: issue.id,
      date: issue.date,
      subject_line: issue.subject_line,
      subject_line_type: typeof issue.subject_line,
      subject_line_length: issue.subject_line?.length || 0,
      active_articles_count: issue.articles?.filter((a: any) => a.is_active).length || 0
    })

    // IMPORTANT: Log article positions FIRST, before MailerLite service call
    // This ensures position logging happens even if MailerLite call fails or times out
    console.log('=== LOGGING ARTICLE POSITIONS FOR REVIEW SEND ===')

    // Get active articles sorted by rank (same logic as MailerLite service)
    const activeArticles = issue.articles
      .filter((article: any) => article.is_active)
      .sort((a: any, b: any) => (a.rank || 999) - (b.rank || 999))
      .slice(0, 5) // Only log positions 1-5

    const activeManualArticles = issue.manual_articles
      .filter((article: any) => article.is_active)
      .sort((a: any, b: any) => (a.rank || 999) - (b.rank || 999))
      .slice(0, 5) // Only log positions 1-5

    console.log('Active articles for position logging:', activeArticles.map((a: any) => `ID: ${a.id}, Rank: ${a.rank}, Headline: ${a.headline}`))
    console.log('Active manual articles for position logging:', activeManualArticles.map((a: any) => `ID: ${a.id}, Rank: ${a.rank}, Title: ${a.title}`))

    let positionErrors = []

    // Update review positions for regular articles
    for (let i = 0; i < activeArticles.length; i++) {
      const position = i + 1
      const { error: updateError } = await supabaseAdmin
        .from('articles')
        .update({ review_position: position })
        .eq('id', activeArticles[i].id)

      if (updateError) {
        console.error(`Failed to update review position for article ${activeArticles[i].id}:`, updateError)
        positionErrors.push(`Article ${activeArticles[i].id}: ${updateError.message}`)
      } else {
        console.log(`Set review position ${position} for article: ${activeArticles[i].headline}`)
      }
    }

    // Update review positions for manual articles
    for (let i = 0; i < activeManualArticles.length; i++) {
      const position = i + 1
      const { error: updateError } = await supabaseAdmin
        .from('manual_articles')
        .update({ review_position: position })
        .eq('id', activeManualArticles[i].id)

      if (updateError) {
        console.error(`Failed to update review position for manual article ${activeManualArticles[i].id}:`, updateError)
        positionErrors.push(`Manual Article ${activeManualArticles[i].id}: ${updateError.message}`)
      } else {
        console.log(`Set review position ${position} for manual article: ${activeManualArticles[i].title}`)
      }
    }

    console.log('=== ARTICLE POSITION LOGGING COMPLETE ===')

    if (positionErrors.length > 0) {
      console.error('Position logging errors encountered:', positionErrors)
      return NextResponse.json({
        error: 'Failed to log article positions',
        details: positionErrors
      }, { status: 500 })
    }

    // Now proceed with SendGrid service call
    console.log('Creating SendGrid service...')
    console.log('Environment check:', {
      hasApiKey: !!process.env.SENDGRID_API_KEY
    })

    const sendGridService = new SendGridService()
    console.log('Calling createReviewCampaign with issue subject_line:', issue.subject_line)
    console.log('Using forced subject line:', forcedSubjectLine)

    // Use forced subject line if provided, otherwise fall back to issue subject line
    const finalSubjectLine = forcedSubjectLine || issue.subject_line
    console.log('Final subject line for SendGrid:', finalSubjectLine)

    const result = await sendGridService.createReviewCampaign(issue, finalSubjectLine)
    console.log('SendGrid result:', result)

    if (!result.success) {
      throw new Error(result.error || 'Failed to create SendGrid campaign')
    }

    // Note: SendGridService already updates issue status to in_review

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
            action: 'review_issue_sent',
            details: { sendgrid_campaign_id: result.campaignId }
          }])
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Review campaign sent successfully via SendGrid',
      sendgrid_campaign_id: result.campaignId
    })
  }
)
