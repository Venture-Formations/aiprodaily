import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')

    if (!campaignId) {
      return NextResponse.json({ error: 'campaign_id parameter required' }, { status: 400 })
    }

    console.log('Testing MailerLite events generation for campaign:', campaignId)

    // Get campaign with all related data like the send-review route does
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
      .eq('id', campaignId)
      .single()

    if (error || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    console.log('Campaign found:', campaign.date, 'Status:', campaign.status)
    console.log('Campaign events count:', campaign.campaign_events?.length || 0)

    // Test the MailerLite service generateEmailHTML method
    const mailerLiteService = new MailerLiteService()

    // Generate the email HTML - this will trigger our enhanced logging
    console.log('=== STARTING EMAIL HTML GENERATION TEST ===')
    const emailHTML = await mailerLiteService['generateEmailHTML'](campaign, true) // Access private method for testing

    console.log('=== EMAIL HTML GENERATION COMPLETE ===')
    console.log('Generated HTML length:', emailHTML.length)

    // Return summary of what was found
    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        date: campaign.date,
        status: campaign.status
      },
      campaignEvents: campaign.campaign_events?.length || 0,
      htmlGenerated: emailHTML.length > 0,
      htmlLength: emailHTML.length,
      hasLocalEventsSection: emailHTML.includes('Local Events') || emailHTML.includes('Events'),
      // Return first 500 chars of HTML for debugging
      htmlPreview: emailHTML.substring(0, 500) + (emailHTML.length > 500 ? '...' : ''),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('MailerLite events test error:', error)
    return NextResponse.json({
      error: 'Failed to test MailerLite events generation',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}