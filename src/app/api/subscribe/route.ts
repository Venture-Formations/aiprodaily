import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import axios from 'axios'

const MAILERLITE_API_BASE = 'https://connect.mailerlite.com/api'

/**
 * Subscribe email to MailerLite and add to group
 * Used by website homepage subscribe form
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json({
        error: 'Valid email address is required'
      }, { status: 400 })
    }

    // Get MailerLite Group ID from settings
    const { data: groupIdSetting } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'mailerlite_group_id')
      .single()

    if (!groupIdSetting?.value) {
      console.error('MailerLite Group ID not configured in database')
      return NextResponse.json({
        error: 'Subscription service not configured'
      }, { status: 500 })
    }

    const groupId = groupIdSetting.value

    // MailerLite API client
    const mailerliteClient = axios.create({
      baseURL: MAILERLITE_API_BASE,
      headers: {
        'Authorization': `Bearer ${process.env.MAILERLITE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    console.log(`Subscribing ${email} to MailerLite group ${groupId}`)

    // Try to add/update subscriber and add to group in one request
    try {
      const response = await mailerliteClient.post('/subscribers', {
        email: email,
        groups: [groupId],
        status: 'active'
      })

      console.log('MailerLite API response:', {
        status: response.status,
        data: response.data
      })

      return NextResponse.json({
        success: true,
        message: 'Successfully subscribed!'
      })

    } catch (apiError: any) {
      // Check if subscriber already exists
      if (apiError.response?.status === 422 || apiError.response?.data?.message?.includes('already exists')) {
        console.log(`Subscriber ${email} already exists, adding to group...`)

        // Search for subscriber by email
        const searchResponse = await mailerliteClient.get(`/subscribers`, {
          params: { 'filter[email]': email }
        })

        if (searchResponse.data?.data && searchResponse.data.data.length > 0) {
          const subscriberId = searchResponse.data.data[0].id

          // Add subscriber to group
          await mailerliteClient.post(`/subscribers/${subscriberId}/groups/${groupId}`)

          console.log(`Added existing subscriber ${email} to group ${groupId}`)

          return NextResponse.json({
            success: true,
            message: 'Successfully subscribed!'
          })
        } else {
          throw new Error('Subscriber not found after creation error')
        }
      } else {
        // Re-throw other errors
        throw apiError
      }
    }

  } catch (error: any) {
    console.error('Subscription failed:', error)

    // Log detailed error info
    if (error.response) {
      console.error('MailerLite API error:', {
        status: error.response.status,
        data: error.response.data
      })
    }

    return NextResponse.json({
      error: 'Subscription failed',
      message: error.response?.data?.message || error.message || 'Unknown error'
    }, { status: 500 })
  }
}
