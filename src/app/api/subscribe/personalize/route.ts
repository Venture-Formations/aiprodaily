import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const MAILERLITE_API_BASE = 'https://connect.mailerlite.com/api'

/**
 * Update subscriber personalization fields in MailerLite
 * Called after subscriber completes the personalization form
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, name, last_name, job_type, yearly_clients } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json({
        error: 'Valid email address is required'
      }, { status: 400 })
    }

    // MailerLite API client
    const mailerliteClient = axios.create({
      baseURL: MAILERLITE_API_BASE,
      headers: {
        'Authorization': `Bearer ${process.env.MAILERLITE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    console.log(`[Personalize] Updating subscriber ${email} with personalization data`)

    // Search for subscriber by email
    const searchResponse = await mailerliteClient.get('/subscribers', {
      params: { 'filter[email]': email }
    })

    if (!searchResponse.data?.data || searchResponse.data.data.length === 0) {
      console.error(`[Personalize] Subscriber ${email} not found`)
      return NextResponse.json({
        error: 'Subscriber not found. Please subscribe first.'
      }, { status: 404 })
    }

    const subscriberId = searchResponse.data.data[0].id

    // Prepare fields to update
    const fields: Record<string, string> = {}

    if (name) fields.name = name
    if (last_name) fields.last_name = last_name
    if (job_type) fields.job_type = job_type
    if (yearly_clients) fields.yearly_clients = yearly_clients

    // Update subscriber with personalization fields
    await mailerliteClient.put(`/subscribers/${subscriberId}`, {
      fields
    })

    console.log(`[Personalize] Successfully updated subscriber ${email}`)

    return NextResponse.json({
      success: true,
      message: 'Personalization saved successfully!'
    })

  } catch (error: any) {
    console.error('[Personalize] Failed to update subscriber:', error)

    if (error.response) {
      console.error('[Personalize] MailerLite API error:', {
        status: error.response.status,
        data: error.response.data
      })
    }

    return NextResponse.json({
      error: 'Failed to save personalization',
      message: error.response?.data?.message || error.message || 'Unknown error'
    }, { status: 500 })
  }
}
