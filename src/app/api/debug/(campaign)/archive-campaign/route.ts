import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { newsletterArchiver } from '@/lib/newsletter-archiver'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')
    const campaignDate = searchParams.get('date')

    if (!campaignId && !campaignDate) {
      return NextResponse.json({
        error: 'Missing required parameter: campaignId or date',
        usage: 'Call with ?campaignId=XXX or ?date=YYYY-MM-DD'
      }, { status: 400 })
    }

    console.log('[ARCHIVE] Manual archive request:', { campaignId, campaignDate })

    // Fetch campaign
    let query = supabaseAdmin
      .from('newsletter_campaigns')
      .select('*')

    if (campaignId) {
      query = query.eq('id', campaignId)
    } else if (campaignDate) {
      query = query.eq('date', campaignDate)
    }

    const { data: campaign, error: campaignError } = await query.single()

    if (campaignError || !campaign) {
      return NextResponse.json({
        error: 'Campaign not found',
        details: campaignError?.message,
        campaignId,
        campaignDate
      }, { status: 404 })
    }

    console.log('[ARCHIVE] Found campaign:', {
      id: campaign.id,
      date: campaign.date,
      status: campaign.status,
      subject_line: campaign.subject_line
    })

    // Check if already archived
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('archived_newsletters')
      .select('id, campaign_date')
      .eq('campaign_id', campaign.id)
      .single()

    if (existing && !existingError) {
      return NextResponse.json({
        success: false,
        message: 'Campaign already archived',
        archive_id: existing.id,
        campaign_date: existing.campaign_date,
        note: 'Delete the existing archive first if you want to re-archive'
      })
    }

    // Archive the newsletter
    const result = await newsletterArchiver.archiveNewsletter({
      campaignId: campaign.id,
      campaignDate: campaign.date,
      subjectLine: campaign.subject_line || 'Newsletter',
      recipientCount: 0 // We don't have this data for past campaigns
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to archive newsletter',
        details: result.error
      }, { status: 500 })
    }

    // Verify archive was created
    const { data: archived, error: verifyError } = await supabaseAdmin
      .from('archived_newsletters')
      .select('id, campaign_date, subject_line')
      .eq('campaign_id', campaign.id)
      .single()

    if (verifyError || !archived) {
      return NextResponse.json({
        success: false,
        error: 'Archive created but verification failed',
        details: verifyError?.message
      }, { status: 500 })
    }

    console.log('[ARCHIVE] Successfully archived:', archived)

    return NextResponse.json({
      success: true,
      message: 'Newsletter archived successfully',
      campaign: {
        id: campaign.id,
        date: campaign.date,
        subject_line: campaign.subject_line,
        status: campaign.status
      },
      archive: {
        id: archived.id,
        campaign_date: archived.campaign_date,
        subject_line: archived.subject_line
      },
      note: 'Newsletter should now appear at /website/newsletters'
    })

  } catch (error: any) {
    console.error('[ARCHIVE] Error:', error)
    return NextResponse.json({
      error: 'Failed to archive campaign',
      details: error.message
    }, { status: 500 })
  }
}
