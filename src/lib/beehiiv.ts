// Beehiiv API utilities for subscriber field management
import axios from 'axios'

const BEEHIIV_API_BASE = 'https://api.beehiiv.com/v2'

/**
 * Update a subscriber's custom field in Beehiiv.
 * Looks up subscriber by email, then updates via subscription ID.
 * If subscriber not found, returns { success: false, error: 'Subscriber not found' }.
 */
export async function updateBeehiivSubscriberField(
  email: string,
  fieldName: string,
  fieldValue: string,
  beehiivPublicationId: string,
  beehiivApiKey: string
): Promise<{ success: boolean; error?: string; rateLimited?: boolean }> {
  const headers = {
    'Authorization': `Bearer ${beehiivApiKey}`,
    'Content-Type': 'application/json',
  }

  try {
    // Step 1: Look up subscriber by email
    const lookupResp = await axios.get(
      `${BEEHIIV_API_BASE}/publications/${beehiivPublicationId}/subscriptions/by_email/${encodeURIComponent(email)}`,
      { headers }
    )
    const subscriptionId = lookupResp.data?.data?.id
    if (!subscriptionId) {
      return { success: false, error: 'Subscriber not found' }
    }

    // Step 2: Update custom field
    await axios.put(
      `${BEEHIIV_API_BASE}/publications/${beehiivPublicationId}/subscriptions/${subscriptionId}`,
      { custom_fields: [{ name: fieldName, value: fieldValue }] },
      { headers }
    )

    console.log(`[Beehiiv] Updated ${fieldName}=${fieldValue} for ${email}`)
    return { success: true }
  } catch (error: any) {
    if (error.response?.status === 404) {
      return { success: false, error: 'Subscriber not found' }
    }
    if (error.response?.status === 429) {
      return { success: false, error: 'Rate limited', rateLimited: true }
    }
    const msg = error.response?.data?.message || error.message || 'Unknown error'
    console.error(`[Beehiiv] Failed to update ${fieldName} for ${email}:`, msg)
    return { success: false, error: msg }
  }
}
