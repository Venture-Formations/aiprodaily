import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'
import { authOptions } from '@/lib/auth'

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
    const body = await request.json().catch(() => ({}))
    const forcedSubjectLine = body.force_subject_line

    console.log('=== SEND REVIEW REQUEST ===')
    console.log('Forced subject line from frontend:', forcedSubjectLine)

    // Fetch campaign with articles and events
    const { data: campaign, error } = await supabaseAdmin
      .from('newsletter_campaigns')
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
        campaign_events(
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

    if (error || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status !== 'draft' && campaign.status !== 'in_review' && campaign.status !== 'changes_made') {
      return NextResponse.json({
        error: 'Campaign cannot be sent for review in current status'
      }, { status: 400 })
    }

    console.log('=== SEND FOR REVIEW DEBUG ===')
    console.log('Campaign object received:', {
      id: campaign.id,
      date: campaign.date,
      subject_line: campaign.subject_line,
      subject_line_type: typeof campaign.subject_line,
      subject_line_length: campaign.subject_line?.length || 0,
      active_articles_count: campaign.articles?.filter((a: any) => a.is_active).length || 0
    })

    // IMPORTANT: Log article positions FIRST, before MailerLite service call
    // This ensures position logging happens even if MailerLite call fails or times out
    console.log('=== LOGGING ARTICLE POSITIONS FOR REVIEW SEND ===')

    // Get active articles sorted by rank (same logic as MailerLite service)
    const activeArticles = campaign.articles
      .filter((article: any) => article.is_active)
      .sort((a: any, b: any) => (a.rank || 999) - (b.rank || 999))
      .slice(0, 5) // Only log positions 1-5

    const activeManualArticles = campaign.manual_articles
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
        console.error(`❌ Failed to update review position for article ${activeArticles[i].id}:`, updateError)
        positionErrors.push(`Article ${activeArticles[i].id}: ${updateError.message}`)
      } else {
        console.log(`✅ Set review position ${position} for article: ${activeArticles[i].headline}`)
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
        console.error(`❌ Failed to update review position for manual article ${activeManualArticles[i].id}:`, updateError)
        positionErrors.push(`Manual Article ${activeManualArticles[i].id}: ${updateError.message}`)
      } else {
        console.log(`✅ Set review position ${position} for manual article: ${activeManualArticles[i].title}`)
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

    // Now proceed with MailerLite service call
    console.log('Creating MailerLite service...')
    console.log('Environment check:', {
      hasApiKey: !!process.env.MAILERLITE_API_KEY,
      hasReviewGroupId: !!process.env.MAILERLITE_REVIEW_GROUP_ID,
      apiKeyPrefix: process.env.MAILERLITE_API_KEY?.substring(0, 8) + '...',
      reviewGroupId: process.env.MAILERLITE_REVIEW_GROUP_ID
    })

    const mailerLiteService = new MailerLiteService()
    console.log('Calling createReviewCampaign with campaign subject_line:', campaign.subject_line)
    console.log('Using forced subject line:', forcedSubjectLine)

    // Use forced subject line if provided, otherwise fall back to campaign subject line
    const finalSubjectLine = forcedSubjectLine || campaign.subject_line
    console.log('Final subject line for MailerLite:', finalSubjectLine)

    const result = await mailerLiteService.createReviewCampaign(campaign, finalSubjectLine)
    console.log('MailerLite result:', result)

    // Update campaign status to in_review and log review sent timestamp
    await supabaseAdmin
      .from('newsletter_campaigns')
      .update({
        status: 'in_review',
        review_sent_at: new Date().toISOString()
      })
      .eq('id', id)

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
            campaign_id: id,
            action: 'review_campaign_sent',
            details: { mailerlite_campaign_id: result.campaignId }
          }])
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Review campaign sent successfully',
      mailerlite_campaign_id: result.campaignId
    })

  } catch (error) {
    console.error('Failed to send review campaign:', error)
    return NextResponse.json({
      error: 'Failed to send review campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}