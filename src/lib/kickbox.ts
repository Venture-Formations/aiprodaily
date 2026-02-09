/**
 * Kickbox Email Verification
 *
 * Verifies email addresses before adding to mailing list.
 * Fail-open: if Kickbox is unavailable, emails are allowed through.
 */

const KICKBOX_API_URL = 'https://api.kickbox.com/v2/verify'
const KICKBOX_TIMEOUT_MS = 6000

export interface KickboxResult {
  result: 'deliverable' | 'undeliverable' | 'risky' | 'unknown'
  reason: string
  role: boolean
  free: boolean
  disposable: boolean
  accept_all: boolean
  did_you_mean: string | null
  sendex: number
  email: string
  user: string
  domain: string
  success: boolean
}

export interface VerifyEmailResponse {
  success: boolean
  data: KickboxResult | null
  error?: string
}

export async function verifyEmail(email: string): Promise<VerifyEmailResponse> {
  const apiKey = process.env.KICKBOX_API_KEY
  if (!apiKey) {
    console.log('[Kickbox] No API key configured, skipping verification')
    return { success: false, data: null, error: 'No API key configured' }
  }

  try {
    const url = `${KICKBOX_API_URL}?email=${encodeURIComponent(email)}&apikey=${encodeURIComponent(apiKey)}&timeout=${KICKBOX_TIMEOUT_MS}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), KICKBOX_TIMEOUT_MS + 2000)

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(`[Kickbox] API returned ${response.status} for ${email}`)
      return { success: false, data: null, error: `API error: ${response.status}` }
    }

    const data: KickboxResult = await response.json()
    console.log(`[Kickbox] ${email}: result=${data.result}, reason=${data.reason}, sendex=${data.sendex}`)

    return { success: true, data }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error(`[Kickbox] Timeout verifying ${email}`)
    } else {
      console.error(`[Kickbox] Error verifying ${email}:`, err.message)
    }
    return { success: false, data: null, error: err.message }
  }
}

/**
 * Build MailerLite custom fields from Kickbox verification result
 */
export function buildKickboxFields(data: KickboxResult): Record<string, string> {
  return {
    kb_status: data.result,
    kb_reason: data.reason,
    kb_sendex: String(data.sendex),
    kb_free_email: String(data.free),
    kb_disposable: String(data.disposable),
    kb_role: String(data.role),
    kb_validation_timestamp: new Date().toISOString().split('T')[0],
  }
}
