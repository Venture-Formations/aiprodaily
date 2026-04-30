import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertMock = vi.fn()
const selectMock = vi.fn()
const maybeSingleMock = vi.fn()

const fromMock = vi.fn((_table: string) => ({
  insert: (payload: unknown) => {
    insertMock(payload)
    return {
      select: () => {
        selectMock()
        return { maybeSingle: maybeSingleMock }
      },
    }
  },
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: (table: string) => fromMock(table),
  },
}))

const fireMock = vi.fn()
const getPublicationSettingMock = vi.fn()
const getEmailProviderSettingsMock = vi.fn()

vi.mock('@/lib/publication-settings', () => ({
  getPublicationSetting: (...args: unknown[]) => getPublicationSettingMock(...args),
  getEmailProviderSettings: (...args: unknown[]) => getEmailProviderSettingsMock(...args),
}))

vi.mock('../make-webhook', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../make-webhook')>()
  return {
    ...actual,
    fireMakeWebhook: (...args: unknown[]) => fireMock(...args),
  }
})

import { claimMakeWebhookFire } from '../make-webhook'
import { triggerMakeWebhook } from '../trigger-make-webhook'

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
    expect(fromMock).toHaveBeenCalledWith('make_webhook_fires')
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

describe('triggerMakeWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fireMock.mockReset()
    getPublicationSettingMock.mockReset()
    getEmailProviderSettingsMock.mockReset()
    // Default: webhook URL configured, gate off, provider mailerlite
    getPublicationSettingMock.mockImplementation(async (_pubId: string, key: string) => {
      if (key === 'sparkloop_webhook_url') return 'https://hook.example.com/abc'
      if (key === 'make_webhook_require_first_open') return 'false'
      return null
    })
    getEmailProviderSettingsMock.mockResolvedValue({ provider: 'mailerlite' })
  })

  it('fires immediately on legacy path (gate off, any provider)', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { id: 'r' }, error: null })
    fireMock.mockResolvedValueOnce(true)

    const result = await triggerMakeWebhook({
      publicationId: 'pub-1',
      subscriberEmail: 'user@example.com',
      source: 'sparkloop',
      subscriberId: 'sub_abc',
    })

    expect(result.claimed).toBe(true)
    expect(result.gated).toBe(false)
    expect(result.fired).toBe(true)
    const inserted = insertMock.mock.calls[0][0]
    expect(inserted.status).toBe('fired')
    expect(fireMock).toHaveBeenCalledTimes(1)
  })

  it('claims pending and does NOT fire when setting=on AND provider=beehiiv', async () => {
    getPublicationSettingMock.mockImplementation(async (_pubId: string, key: string) => {
      if (key === 'sparkloop_webhook_url') return 'https://hook.example.com/abc'
      if (key === 'make_webhook_require_first_open') return 'true'
      return null
    })
    getEmailProviderSettingsMock.mockResolvedValue({ provider: 'beehiiv' })
    maybeSingleMock.mockResolvedValueOnce({ data: { id: 'r' }, error: null })

    const result = await triggerMakeWebhook({
      publicationId: 'pub-1',
      subscriberEmail: 'user@example.com',
      source: 'sparkloop',
      subscriberId: 'sub_abc',
    })

    expect(result.claimed).toBe(true)
    expect(result.gated).toBe(true)
    expect(result.fired).toBe(false)
    const inserted = insertMock.mock.calls[0][0]
    expect(inserted.status).toBe('pending')
    expect(inserted.fired_at).toBeNull()
    expect(fireMock).not.toHaveBeenCalled()
  })

  it('falls back to immediate fire when setting=on but provider!=beehiiv (logs warn)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    getPublicationSettingMock.mockImplementation(async (_pubId: string, key: string) => {
      if (key === 'sparkloop_webhook_url') return 'https://hook.example.com/abc'
      if (key === 'make_webhook_require_first_open') return 'true'
      return null
    })
    getEmailProviderSettingsMock.mockResolvedValue({ provider: 'mailerlite' })
    maybeSingleMock.mockResolvedValueOnce({ data: { id: 'r' }, error: null })
    fireMock.mockResolvedValueOnce(true)

    const result = await triggerMakeWebhook({
      publicationId: 'pub-1',
      subscriberEmail: 'user@example.com',
      source: 'sparkloop',
      subscriberId: 'sub_abc',
    })

    expect(result.gated).toBe(false)
    expect(result.fired).toBe(true)
    const inserted = insertMock.mock.calls[0][0]
    expect(inserted.status).toBe('fired')
    expect(warnSpy).toHaveBeenCalled()
    expect(fireMock).toHaveBeenCalledTimes(1)
    warnSpy.mockRestore()
  })

  it('returns claimed:false when no webhook URL configured', async () => {
    getPublicationSettingMock.mockImplementation(async (_pubId: string, key: string) => {
      if (key === 'sparkloop_webhook_url') return ''
      if (key === 'make_webhook_require_first_open') return 'false'
      return null
    })

    const result = await triggerMakeWebhook({
      publicationId: 'pub-1',
      subscriberEmail: 'user@example.com',
      source: 'sparkloop',
      subscriberId: 'sub_abc',
    })

    expect(result.claimed).toBe(false)
    expect(result.fired).toBe(false)
    expect(result.gated).toBe(false)
    expect(insertMock).not.toHaveBeenCalled()
    expect(fireMock).not.toHaveBeenCalled()
  })
})
