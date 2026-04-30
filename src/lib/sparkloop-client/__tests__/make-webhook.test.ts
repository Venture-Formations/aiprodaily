import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertMock = vi.fn()
const selectMock = vi.fn()
const maybeSingleMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: (payload: unknown) => {
        insertMock(payload)
        return {
          select: () => {
            selectMock()
            return { maybeSingle: maybeSingleMock }
          },
        }
      },
    })),
  },
}))

import { claimMakeWebhookFire } from '../make-webhook'

describe('claimMakeWebhookFire', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts row with status="fired" and fired_at when status defaults', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { id: 'row-1' }, error: null })

    const ok = await claimMakeWebhookFire({
      publicationId: 'pub-1',
      subscriberEmail: 'User@Example.COM',
      source: 'sparkloop',
      subscriberId: 'sub_abc',
    })

    expect(ok).toBe(true)
    const inserted = insertMock.mock.calls[0][0]
    expect(inserted.status).toBe('fired')
    expect(typeof inserted.fired_at).toBe('string')
    expect(inserted.subscriber_email).toBe('user@example.com') // lowercased
  })

  it('inserts row with status="pending" and fired_at=null when status="pending"', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { id: 'row-2' }, error: null })

    const ok = await claimMakeWebhookFire({
      publicationId: 'pub-1',
      subscriberEmail: 'user@example.com',
      source: 'sparkloop',
      subscriberId: 'sub_abc',
      status: 'pending',
    })

    expect(ok).toBe(true)
    const inserted = insertMock.mock.calls[0][0]
    expect(inserted.status).toBe('pending')
    expect(inserted.fired_at).toBeNull()
  })

  it('returns false on 23505 unique violation', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate' } })
    const ok = await claimMakeWebhookFire({
      publicationId: 'pub-1',
      subscriberEmail: 'user@example.com',
      source: 'sparkloop',
      subscriberId: 'sub_abc',
    })
    expect(ok).toBe(false)
  })
})
