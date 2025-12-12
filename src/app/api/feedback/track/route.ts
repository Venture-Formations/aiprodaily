import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SendGridService } from '@/lib/sendgrid'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const choice = searchParams.get('choice')
    const email = searchParams.get('email')

    console.log('Feedback tracking request:', { date, choice, email })

    // Validate required parameters
    if (!date || !choice || !email) {
      console.error('Missing required parameters:', { date, choice, email })
      return NextResponse.redirect(new URL('/feedback/error?reason=missing-params', request.url))
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      console.error('Invalid date format:', date)
      return NextResponse.redirect(new URL('/feedback/error?reason=invalid-date', request.url))
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      console.error('Invalid email format:', email)
      return NextResponse.redirect(new URL('/feedback/error?reason=invalid-email', request.url))
    }

    // Valid section choices
    const validChoices = [
      'Weather',
      'The Local Scoop',
      'Local Events',
      'Dining Deals',
      'Yesterdays Wordle',
      'Road Work',
      'Minnesota Getaways'
    ]

    if (!validChoices.includes(choice)) {
      console.error('Invalid section choice:', choice)
      return NextResponse.redirect(new URL('/feedback/error?reason=invalid-choice', request.url))
    }

    // Store feedback in database
    console.log('Storing feedback in database...')
    const { data: feedback, error: dbError } = await supabaseAdmin
      .from('feedback_responses')
      .upsert({
        issue_date: date,
        subscriber_email: email,
        section_choice: choice,
        mailerlite_updated: false, // Legacy field name, still tracks sync status
        created_at: new Date().toISOString()
      }, {
        onConflict: 'issue_date,subscriber_email'
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error storing feedback:', dbError)
      // Continue anyway - we'll try to update SendGrid
    } else {
      console.log('Feedback stored successfully:', feedback?.id)
    }

    // Update SendGrid subscriber custom field
    let providerUpdated = false
    try {
      console.log('Updating SendGrid subscriber custom field...')
      const sendgrid = new SendGridService()
      const updateResult = await sendgrid.updateContactFields(email, {
        section_choice: choice
      })

      if (updateResult.success) {
        console.log('SendGrid update successful for:', email)
        providerUpdated = true
      } else {
        console.warn('SendGrid update failed:', updateResult.error)
      }
    } catch (sgError: any) {
      console.error('SendGrid API error:', {
        message: sgError.message
      })
    }

    // Update the feedback record with sync status
    if (feedback?.id) {
      await supabaseAdmin
        .from('feedback_responses')
        .update({ mailerlite_updated: providerUpdated }) // Legacy field name
        .eq('id', feedback.id)
    }

    // Redirect to thank you page with section choice
    const thankYouUrl = new URL('/feedback/thank-you', request.url)
    thankYouUrl.searchParams.set('choice', choice)

    console.log('Feedback processing complete, redirecting to thank you page')
    return NextResponse.redirect(thankYouUrl)

  } catch (error) {
    console.error('Feedback tracking error:', error)
    return NextResponse.redirect(new URL('/feedback/error?reason=server-error', request.url))
  }
}
