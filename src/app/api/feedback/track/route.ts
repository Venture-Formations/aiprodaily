import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import axios from 'axios'

const MAILERLITE_API_BASE = 'https://connect.mailerlite.com/api'

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
        campaign_date: date,
        subscriber_email: email,
        section_choice: choice,
        mailerlite_updated: false,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'campaign_date,subscriber_email'
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error storing feedback:', dbError)
      // Continue anyway - we'll try to update MailerLite
    } else {
      console.log('Feedback stored successfully:', feedback?.id)
    }

    // Update MailerLite subscriber custom field
    let mailerLiteUpdated = false
    try {
      console.log('Updating MailerLite subscriber custom field...')
      const apiKey = process.env.MAILERLITE_API_KEY

      if (!apiKey) {
        console.error('MAILERLITE_API_KEY not configured')
      } else {
        // First, find the subscriber by email
        const searchResponse = await axios.get(
          `${MAILERLITE_API_BASE}/subscribers`,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            params: {
              filter: {
                email: email
              }
            }
          }
        )

        console.log('MailerLite search response:', {
          found: searchResponse.data?.data?.length || 0,
          email
        })

        if (searchResponse.data?.data && searchResponse.data.data.length > 0) {
          const subscriber = searchResponse.data.data[0]
          console.log('Found subscriber:', subscriber.id)

          // Update the subscriber's custom field
          const updateResponse = await axios.put(
            `${MAILERLITE_API_BASE}/subscribers/${subscriber.id}`,
            {
              fields: {
                section_choice: choice
              }
            },
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              }
            }
          )

          console.log('MailerLite update successful:', updateResponse.data)
          mailerLiteUpdated = true
        } else {
          console.warn('Subscriber not found in MailerLite:', email)
        }
      }
    } catch (mlError: any) {
      console.error('MailerLite API error:', {
        message: mlError.message,
        response: mlError.response?.data,
        status: mlError.response?.status
      })
    }

    // Update the feedback record with MailerLite status
    if (feedback?.id) {
      await supabaseAdmin
        .from('feedback_responses')
        .update({ mailerlite_updated: mailerLiteUpdated })
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
