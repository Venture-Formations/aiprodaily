import { describe, it, expect, vi, beforeEach } from 'vitest'

const fromMock = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => fromMock(...args) },
}))

const getPublicationSettingMock = vi.fn()
const getEmailProviderSettingsMock = vi.fn()
vi.mock('@/lib/publication-settings', () => ({
  getPublicationSetting: (...args: unknown[]) => getPublicationSettingMock(...args),
  getEmailProviderSettings: (...args: unknown[]) => getEmailProviderSettingsMock(...args),
}))

const getBeehiivSubscriberStatsMock = vi.fn()
vi.mock('@/lib/beehiiv', () => ({
  getBeehiivSubscriberStats: (...args: unknown[]) => getBeehiivSubscriberStatsMock(...args),
}))

const fireMakeWebhookMock = vi.fn()
const markFiredMock = vi.fn()
const markExpiredMock = vi.fn()
const recordPollAttemptMock = vi.fn()
vi.mock('@/lib/sparkloop-client', () => ({
  fireMakeWebhook: (...args: unknown[]) => fireMakeWebhookMock(...args),
  markMakeWebhookFired: (...args: unknown[]) => markFiredMock(...args),
  markMakeWebhookExpired: (...args: unknown[]) => markExpiredMock(...args),
  recordPollAttempt: (...args: unknown[]) => recordPollAttemptMock(...args),
}))

vi.mock('@/lib/api-handler', () => ({
  withApiHandler: (_opts: unknown, fn: any) => async (req: any) =>
    fn({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }, request: req }),
}))

import { GET } from '../route'

/**
 * Build a Supabase query chain that matches the make_webhook_fires query in route.ts:
 *   .select(cols).eq(publication_id).eq(status).order(last_polled_at).order(created_at).limit(N)
 * The chain resolves at .limit() with the given rows.
 */
function buildSelectChain(rows: any[]) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => Promise.resolve({ data: rows, error: null }),
  }
  return chain
}

describe('check-pending-webhooks cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fromMock.mockImplementation((table: string) => {
      if (table === 'publications') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ id: 'pub-1' }], error: null }),
          }),
        }
      }
      if (table === 'make_webhook_fires') {
        return buildSelectChain([
          {
            id: 'row-1',
            subscriber_email: 'opener@example.com',
            subscriber_id: 'sub_1',
            source: 'sparkloop',
            poll_attempts: 0,
          },
          {
            id: 'row-2',
            subscriber_email: 'unsubscribed@example.com',
            subscriber_id: 'sub_2',
            source: 'sparkloop',
            poll_attempts: 0,
          },
          {
            id: 'row-3',
            subscriber_email: 'noopen@example.com',
            subscriber_id: 'sub_3',
            source: 'sparkloop',
            poll_attempts: 5,
          },
        ])
      }
      return {}
    })

    getPublicationSettingMock.mockImplementation(async (_pub: string, key: string) => {
      if (key === 'make_webhook_require_first_open') return 'true'
      if (key === 'sparkloop_webhook_url') return 'https://hook.example.com/abc'
      return null
    })
    getEmailProviderSettingsMock.mockResolvedValue({
      provider: 'beehiiv',
      beehiivPublicationId: 'pub_b',
      beehiivApiKey: 'key',
    })

    getBeehiivSubscriberStatsMock.mockImplementation(async (email: string) => {
      if (email === 'opener@example.com')
        return { found: true, status: 'active', uniqueOpens: 2, emailsReceived: 5, subscriptionId: 's1' }
      if (email === 'unsubscribed@example.com')
        return { found: true, status: 'unsubscribed', uniqueOpens: 0, emailsReceived: 3, subscriptionId: 's2' }
      if (email === 'noopen@example.com')
        return { found: true, status: 'active', uniqueOpens: 0, emailsReceived: 2, subscriptionId: 's3' }
      return { found: false }
    })

    // markMakeWebhookFired returns Promise<boolean>. True = success → webhook fires.
    markFiredMock.mockResolvedValue(true)
    fireMakeWebhookMock.mockResolvedValue(true)
  })

  it('fires for opener, expires for unsubscribed, polls again for no-open', async () => {
    const response = await GET(
      new Request('http://localhost/api/cron/check-pending-webhooks') as any,
      { params: Promise.resolve({}) }
    )
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.summaries[0].checked).toBe(3)
    expect(body.summaries[0].fired).toBe(1)
    expect(body.summaries[0].expired).toBe(1)

    expect(markFiredMock).toHaveBeenCalledWith('row-1')
    expect(fireMakeWebhookMock).toHaveBeenCalledTimes(1)
    expect(markExpiredMock).toHaveBeenCalledWith('row-2', 'unsubscribed')
    expect(recordPollAttemptMock).toHaveBeenCalledWith('row-3', 5)
  })
})
