import { NextRequest, NextResponse } from 'next/server'
import { SendGridService } from '@/lib/sendgrid'

/**
 * Update subscriber personalization fields in SendGrid
 * Called after subscriber completes the personalization form
 * Supports email correction if original_email is provided
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
