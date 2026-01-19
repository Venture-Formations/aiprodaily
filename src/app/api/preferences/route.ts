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

type Preference = 'daily' | 'weekly' | 'unsubscribe'

/**
 * Find a MailerLite subscriber by email
 */
async function findMailerLiteSubscriber(email: string): Promise<{ id: string; groups: { id: string }[] } | null> {
  try {
    // Use direct lookup by email - MailerLite accepts email as identifier
    const response = await mailerliteClient.get(`/subscribers/${encodeURIComponent(email)}`)
    const subscriber = response.data?.data
    if (subscriber) {
      return {
        id: subscriber.id,
        groups: subscriber.groups || []
      }
    }
    return null
  } catch (error: any) {
    // 404 means subscriber not found
    if (error.response?.status === 404) {
      console.log('[Preferences] Subscriber not found in MailerLite:', email)
      return null
    }
    console.error('[Preferences] Error finding MailerLite subscriber:', error.response?.data || error.message)
    return null
  }
}

/**
 * Add subscriber to a MailerLite group
 */
async function addToMailerLiteGroup(email: string, groupId: string): Promise<boolean> {
  try {
    await mailerliteClient.post('/subscribers', {
      email,
      groups: [groupId]
    })
    return true
  } catch (error: any) {
    // 422 means subscriber already exists - still try to add to group
    if (error.response?.status === 422) {
      // Subscriber exists, need to add them to the group via different endpoint
      const subscriber = await findMailerLiteSubscriber(email)
      if (subscriber) {
        try {
          await mailerliteClient.post(`/subscribers/${subscriber.id}/groups/${groupId}`)
          return true
        } catch (addError: any) {
          console.error('[Preferences] Error adding existing subscriber to group:', addError.response?.data || addError.message)
          return false
        }
      }
    }
    console.error('[Preferences] Error adding to MailerLite group:', error.response?.data || error.message)
    return false
  }
}

/**
 * Remove subscriber from a MailerLite group
 */
async function removeFromMailerLiteGroup(subscriberId: string, groupId: string): Promise<boolean> {
  try {
    await mailerliteClient.delete(`/subscribers/${subscriberId}/groups/${groupId}`)
    return true
  } catch (error: any) {
    // 404 means subscriber not in group, which is fine
    if (error.response?.status === 404) {
      return true
    }
    console.error('[Preferences] Error removing from MailerLite group:', error.response?.data || error.message)
    return false
  }
}

/**
 * Update subscriber preferences (MailerLite or SendGrid based on settings)
 * POST /api/preferences
 * Body: { email: string, preference: 'daily' | 'weekly' | 'unsubscribe' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, preference } = body as { email: string; preference: Preference }

    // Validate email
    if (!email || !email.includes('@')) {
      return NextResponse.json({
        error: 'Valid email address is required'
      }, { status: 400 })
    }

    // Validate preference
    if (!['daily', 'weekly', 'unsubscribe'].includes(preference)) {
      return NextResponse.json({
        error: 'Invalid preference. Must be daily, weekly, or unsubscribe'
      }, { status: 400 })
    }

    // Get domain from headers
    const headersList = await headers()
    const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'aiaccountingdaily.com'

    // Get publication ID from domain
    const publicationId = await getPublicationByDomain(host) || 'accounting'

    // Get email provider settings
    const providerSettings = await getEmailProviderSettings(publicationId)
    console.log(`[Preferences] Using email provider: ${providerSettings.provider} for ${email} -> ${preference}`)

    const { mainGroupId, secondaryGroupId } = providerSettings

    if (providerSettings.provider === 'sendgrid') {
      // Handle SendGrid
      const sendgridService = new SendGridService()

      // Search for contact by email
      const searchResult = await sendgridService.searchContactsByEmail([email])
      const contact = searchResult?.result?.[email]?.contact

      if (!contact) {
        console.log(`[Preferences] SendGrid contact not found for ${email}`)
        return NextResponse.json({
          error: 'Email not found',
          message: 'We could not find that email in our system.'
        }, { status: 404 })
      }

      const contactId = contact.id

      switch (preference) {
        case 'daily':
          // Add to main list, remove from secondary
          if (mainGroupId) {
            await sendgridService.upsertContact(email, { listIds: [mainGroupId] })
          }
          if (secondaryGroupId) {
            await sendgridService.removeContactFromList(contactId, secondaryGroupId)
          }
          break

        case 'weekly':
          // Add to secondary list, remove from main
          if (secondaryGroupId) {
            await sendgridService.upsertContact(email, { listIds: [secondaryGroupId] })
          }
          if (mainGroupId) {
            await sendgridService.removeContactFromList(contactId, mainGroupId)
          }
          break

        case 'unsubscribe':
          // Remove from both lists
          if (mainGroupId) {
            await sendgridService.removeContactFromList(contactId, mainGroupId)
          }
          if (secondaryGroupId) {
            await sendgridService.removeContactFromList(contactId, secondaryGroupId)
          }
          break
      }

      console.log(`[Preferences] Successfully updated SendGrid preferences for ${email} to ${preference}`)

    } else {
      // Handle MailerLite (default)
      const subscriber = await findMailerLiteSubscriber(email)

      if (!subscriber) {
        console.log(`[Preferences] MailerLite subscriber not found for ${email}`)
        return NextResponse.json({
          error: 'Email not found',
          message: 'We could not find that email in our system.'
        }, { status: 404 })
      }

      switch (preference) {
        case 'daily':
          // Add to main group, remove from secondary
          if (mainGroupId) {
            await addToMailerLiteGroup(email, mainGroupId)
          }
          if (secondaryGroupId) {
            await removeFromMailerLiteGroup(subscriber.id, secondaryGroupId)
          }
          break

        case 'weekly':
          // Add to secondary group, remove from main
          if (secondaryGroupId) {
            await addToMailerLiteGroup(email, secondaryGroupId)
          }
          if (mainGroupId) {
            await removeFromMailerLiteGroup(subscriber.id, mainGroupId)
          }
          break

        case 'unsubscribe':
          // Remove from both groups
          if (mainGroupId) {
            await removeFromMailerLiteGroup(subscriber.id, mainGroupId)
          }
          if (secondaryGroupId) {
            await removeFromMailerLiteGroup(subscriber.id, secondaryGroupId)
          }
          break
      }

      console.log(`[Preferences] Successfully updated MailerLite preferences for ${email} to ${preference}`)
    }

    // Return success with appropriate message
    const messages: Record<Preference, string> = {
      daily: "Your preferences have been updated. You'll continue receiving daily emails.",
      weekly: "Your preferences have been updated. You'll now receive our weekly digest instead of daily emails.",
      unsubscribe: "You've been unsubscribed from all our emails. We're sorry to see you go!"
    }

    return NextResponse.json({
      success: true,
      message: messages[preference]
    })

  } catch (error: any) {
    console.error('[Preferences] Error updating preferences:', error)

    return NextResponse.json({
      error: 'Failed to update preferences',
      message: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
