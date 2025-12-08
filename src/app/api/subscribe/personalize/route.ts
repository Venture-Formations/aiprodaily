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

    console.log(`[Personalize] Received request for ${email}`, { name, last_name, job_type, yearly_clients })

    if (!email || !email.includes('@')) {
      return NextResponse.json({
        error: 'Valid email address is required'
      }, { status: 400 })
    }

    if (!process.env.MAILERLITE_API_KEY) {
      console.error('[Personalize] MAILERLITE_API_KEY not configured')
      return NextResponse.json({
        error: 'Service not configured'
      }, { status: 500 })
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

    // Prepare fields to update
    const fields: Record<string, string> = {}

    if (name) fields.name = name
    if (last_name) fields.last_name = last_name
    if (job_type) fields.job_type = job_type
    if (yearly_clients) fields.yearly_clients = yearly_clients

    console.log(`[Personalize] Updating subscriber ${email} with fields:`, fields)

    // Update subscriber directly by email - MailerLite accepts email as identifier
    // Using PUT to /subscribers/{email} to update or create
    const response = await mailerliteClient.put(`/subscribers/${encodeURIComponent(email)}`, {
      fields
    })

    console.log(`[Personalize] Successfully updated subscriber ${email}`, response.status)

    return NextResponse.json({
      success: true,
      message: 'Personalization saved successfully!'
    })

  } catch (error: any) {
    console.error('[Personalize] Failed to update subscriber:', error.message)

    if (error.response) {
      console.error('[Personalize] MailerLite API error:', {
        status: error.response.status,
        data: error.response.data
      })

      // If subscriber not found, return a more helpful error
      if (error.response.status === 404) {
        return NextResponse.json({
          error: 'Subscriber not found. Please subscribe first.'
        }, { status: 404 })
      }
    }

    return NextResponse.json({
      error: 'Failed to save personalization',
      message: error.response?.data?.message || error.message || 'Unknown error'
    }, { status: 500 })
  }
}
