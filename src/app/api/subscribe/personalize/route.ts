import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import axios from 'axios'
import { getPublicationByDomain, getEmailProviderSettings } from '@/lib/publication-settings'
import { SendGridService } from '@/lib/sendgrid'

// MailerLite API client
const MAILERLITE_API_BASE = 'https://connect.mailerlite.com/api'

const mailerliteClient = axios.create({
  baseURL: MAILERLITE_API_BASE,
  headers: {
    'Authorization': `Bearer ${process.env.MAILERLITE_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

/**
 * Update subscriber personalization fields
 * Called after subscriber completes the personalization form
 * Supports email correction if original_email is provided
 * Dynamically selects email provider (MailerLite or SendGrid)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, original_email, name, last_name, job_type, yearly_clients } = body

    console.log(`[Personalize] Received request for ${email}`, {
      original_email,
      name,
      last_name,
      job_type,
      yearly_clients
    })

    if (!email || !email.includes('@')) {
      return NextResponse.json({
        error: 'Valid email address is required'
      }, { status: 400 })
    }

    // Get domain from headers to determine publication
    const headersList = await headers()
    const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'aiaccountingdaily.com'

    // Get publication ID from domain
    const publicationId = await getPublicationByDomain(host) || 'accounting'

    // Get email provider settings (dynamic selection)
    const providerSettings = await getEmailProviderSettings(publicationId)
    console.log(`[Personalize] Using email provider: ${providerSettings.provider}`)

    if (providerSettings.provider === 'sendgrid') {
      // Use SendGrid
      const sendgrid = new SendGridService()

      // Prepare fields to update
      const fields: Record<string, any> = {}

      if (name) fields.first_name = name
      if (last_name) fields.last_name = last_name
      if (job_type) fields.job_type = job_type
      if (yearly_clients) fields.yearly_clients = yearly_clients

      // If email was corrected, we need to handle it differently
      // SendGrid doesn't support changing email directly - would need to delete old and create new
      if (original_email && original_email !== email) {
        console.log(`[Personalize] Email correction requested from ${original_email} to ${email}`)
        console.log(`[Personalize] Note: Email changes require manual intervention in SendGrid`)

        // Update the new email with fields (subscriber should have been added with new email already)
        const result = await sendgrid.updateContactFields(email, fields)

        if (!result.success) {
          // Try upserting the contact
          const upsertResult = await sendgrid.upsertContact(email, {
            firstName: name,
            lastName: last_name,
            customFields: { job_type, yearly_clients }
          })

          if (!upsertResult.success) {
            throw new Error(upsertResult.error || 'Failed to update subscriber')
          }
        }

        console.log(`[Personalize] Successfully updated/created subscriber ${email}`)
      } else {
        // No email change, just update fields
        console.log(`[Personalize] Updating subscriber ${email} with fields:`, fields)

        const result = await sendgrid.updateContactFields(email, fields)

        if (!result.success) {
          // If update fails, try upserting
          const upsertResult = await sendgrid.upsertContact(email, {
            firstName: name,
            lastName: last_name,
            customFields: { job_type, yearly_clients }
          })

          if (!upsertResult.success) {
            throw new Error(upsertResult.error || 'Failed to update subscriber')
          }
        }

        console.log(`[Personalize] Successfully updated subscriber ${email}`)
      }
    } else {
      // Use MailerLite (default)
      // Prepare fields to update
      const fields: Record<string, any> = {}

      if (name) fields.name = name
      if (last_name) fields.last_name = last_name
      if (job_type) fields.job_type = job_type
      if (yearly_clients) fields.yearly_clients = yearly_clients

      console.log(`[Personalize] Updating MailerLite subscriber ${email} with fields:`, fields)

      try {
        // MailerLite uses PUT to /subscribers with email to update
        const response = await mailerliteClient.put(`/subscribers/${encodeURIComponent(email)}`, {
          fields
        })

        if (response.status === 200 || response.status === 201) {
          console.log(`[Personalize] Successfully updated subscriber ${email} in MailerLite`)
        } else {
          console.error('[Personalize] MailerLite API unexpected status:', response.status)
          throw new Error('Failed to update subscriber')
        }
      } catch (mlError: any) {
        // If subscriber not found, try to create them
        if (mlError.response?.status === 404) {
          console.log(`[Personalize] Subscriber ${email} not found in MailerLite, creating...`)
          try {
            const createResponse = await mailerliteClient.post('/subscribers', {
              email,
              fields
            })
            if (createResponse.status === 200 || createResponse.status === 201) {
              console.log(`[Personalize] Successfully created subscriber ${email} in MailerLite`)
            } else {
              throw new Error('Failed to create subscriber')
            }
          } catch (createError: any) {
            console.error('[Personalize] Failed to create subscriber:', createError.response?.data || createError.message)
            throw new Error('Failed to update subscriber')
          }
        } else {
          console.error('[Personalize] MailerLite API error:', mlError.response?.data || mlError.message)
          throw new Error(mlError.response?.data?.message || 'Failed to update subscriber')
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Personalization saved successfully!'
    })

  } catch (error: any) {
    console.error('[Personalize] Failed to update subscriber:', error.message)

    return NextResponse.json({
      error: 'Failed to save personalization',
      message: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
