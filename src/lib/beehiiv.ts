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

export interface BeehiivSubscriberStats {
  found: boolean
  status?: string
  uniqueOpens?: number
  emailsReceived?: number
  subscriptionId?: string
  rateLimited?: boolean
  error?: string
}

/**
 * Fetch a Beehiiv subscriber by email with stats expanded. Used by the
 * check-pending-webhooks cron to detect a subscriber's first open before
 * firing the Make.com webhook.
 *
 * Returns { found: false } on 404, { rateLimited: true } on 429, and
 * { error } on other failures. Never throws.
 */
export async function getBeehiivSubscriberStats(
  email: string,
  beehiivPublicationId: string,
  beehiivApiKey: string
): Promise<BeehiivSubscriberStats> {
  const url = `${BEEHIIV_API_BASE}/publications/${beehiivPublicationId}/subscriptions/by_email/${encodeURIComponent(email)}?expand=stats`
  const headers = {
    Authorization: `Bearer ${beehiivApiKey}`,
    'Content-Type': 'application/json',
  }

  try {
    const resp = await axios.get(url, { headers })
    const data = resp.data?.data
    if (!data) {
      return { found: false }
    }
    const stats = data.stats || {}
    const uniqueOpens =
      typeof stats.unique_opens === 'number'
        ? stats.unique_opens
        : typeof stats.opens === 'number'
        ? stats.opens
        : 0
    return {
      found: true,
      status: typeof data.status === 'string' ? data.status : undefined,
      uniqueOpens,
      emailsReceived: typeof stats.emails_received === 'number' ? stats.emails_received : 0,
      subscriptionId: typeof data.id === 'string' ? data.id : undefined,
    }
  } catch (error: any) {
    if (error.response?.status === 404) {
      return { found: false }
    }
    if (error.response?.status === 429) {
      return { found: false, rateLimited: true }
    }
    const msg = error.response?.data?.message || error.message || 'Unknown error'
    return { found: false, error: msg }
  }
}
