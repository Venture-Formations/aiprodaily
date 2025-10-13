import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'

// GET /api/polls/[id]/respond - Handle poll response from email link
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const option = searchParams.get('option')
    const email = searchParams.get('email')
    const campaignId = searchParams.get('campaign_id')

    if (!option || !email) {
      return NextResponse.redirect(
        new URL('/poll/error?message=Missing required parameters', request.url)
      )
    }

    // Record the poll response (upsert to handle duplicate responses)
    const { error: responseError } = await supabaseAdmin
      .from('poll_responses')
      .upsert({
        poll_id: id,
        subscriber_email: email,
        selected_option: option,
        campaign_id: campaignId || null
      }, {
        onConflict: 'poll_id,subscriber_email'
      })

    if (responseError) {
      console.error('Error recording poll response:', responseError)
      return NextResponse.redirect(
        new URL('/poll/error?message=Failed to record response', request.url)
      )
    }

    // Get count of unique polls this subscriber has responded to
    const { data: uniquePolls, error: countError } = await supabaseAdmin
      .from('poll_responses')
      .select('poll_id')
      .eq('subscriber_email', email)

    if (countError) {
      console.error('Error counting unique polls:', countError)
    }

    const uniquePollCount = uniquePolls ? new Set(uniquePolls.map(r => r.poll_id)).size : 0

    // Sync to MailerLite - update subscriber's "Poll Responses" field with uniquePollCount
    try {
      const mailerlite = new MailerLiteService()
      const syncResult = await mailerlite.updateSubscriberField(
        email,
        'poll_responses',
        uniquePollCount
      )

      if (syncResult.success) {
        console.log(`Successfully synced poll count to MailerLite for ${email}`)
      } else {
        console.error(`Failed to sync to MailerLite:`, syncResult.error)
        // Don't fail the whole request if MailerLite sync fails
      }
    } catch (mailerliteError) {
      console.error('Error syncing to MailerLite:', mailerliteError)
      // Don't fail the whole request if MailerLite sync fails
    }

    console.log(`Poll response recorded: ${email} responded to poll ${id} with option "${option}"`)
    console.log(`Subscriber has responded to ${uniquePollCount} unique polls`)

    // Redirect to thank you page
    return NextResponse.redirect(
      new URL('/poll/thank-you', request.url)
    )
  } catch (error) {
    console.error('Error in GET /api/polls/[id]/respond:', error)
    return NextResponse.redirect(
      new URL('/poll/error?message=An unexpected error occurred', request.url)
    )
  }
}
