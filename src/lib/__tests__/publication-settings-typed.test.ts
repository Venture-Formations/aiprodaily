import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted runs before the hoisted vi.mock factory, so symbols declared
// here are available at mock-construction time.
const mocks = vi.hoisted(() => {
  let chainResult: { data: any; error: any } = { data: null, error: null }
  const mockChain: any = {}
  mockChain.select = (..._args: any[]) => mockChain
  mockChain.eq = (..._args: any[]) => mockChain
  mockChain.in = (..._args: any[]) => mockChain
  mockChain.then = (onFulfilled: any) => Promise.resolve(chainResult).then(onFulfilled)

  return {
    setResult(r: { data: any; error: any }) { chainResult = r },
    reset() { chainResult = { data: null, error: null } },
    mockChain,
    mockFrom: vi.fn(() => mockChain),
  }
})

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.mockFrom },
}))

vi.mock('../env-guard', () => ({
  shouldApplySendGuards: vi.fn().mockReturnValue(false),
}))

import { getAIAppSettings, getDirectorySettings, getSlackSettings } from '../publication-settings'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.reset()
})

// ---------------------------------------------------------------------------
describe('getAIAppSettings', () => {
  it('returns parsed numeric values from publication_settings', async () => {
    mocks.setResult({
      data: [
        { key: 'ai_apps_per_newsletter', value: '8' },
        { key: 'ai_apps_max_per_category', value: '4' },
        { key: 'affiliate_cooldown_days', value: '14' },
      ],
      error: null,
    })
    const result = await getAIAppSettings('pub-1')
    expect(result).toEqual({
      totalApps: 8,
      maxPerCategory: 4,
      affiliateCooldownDays: 14,
    })
  })

  it('returns hardcoded defaults when settings are missing', async () => {
    mocks.setResult({ data: [], error: null })
    const result = await getAIAppSettings('pub-1')
    expect(result).toEqual({
      totalApps: 6,
      maxPerCategory: 3,
      affiliateCooldownDays: 7,
    })
  })
})

// ---------------------------------------------------------------------------
describe('getDirectorySettings', () => {
  it('returns parsed numeric values from publication_settings', async () => {
    mocks.setResult({
      data: [
        { key: 'directory_paid_placement_price', value: '49.99' },
        { key: 'directory_featured_price', value: '99.50' },
        { key: 'directory_yearly_discount_months', value: '3' },
      ],
      error: null,
    })
    const result = await getDirectorySettings('pub-1')
    expect(result).toEqual({
      paidPlacementPrice: 49.99,
      featuredPrice: 99.5,
      yearlyDiscountMonths: 3,
    })
  })

  it('returns hardcoded defaults matching the prior DEFAULT_PRICING', async () => {
    mocks.setResult({ data: [], error: null })
    const result = await getDirectorySettings('pub-1')
    expect(result).toEqual({
      paidPlacementPrice: 30,
      featuredPrice: 60,
      yearlyDiscountMonths: 2,
    })
  })
})

// ---------------------------------------------------------------------------
describe('getSlackSettings null-publication path', () => {
  it('skips publication_settings query when publicationId is null', async () => {
    mocks.setResult({
      data: [
        { key: 'slack_webhook_url', value: 'https://hooks.example.com/abc' },
        { key: 'slack_low_article_count_enabled', value: 'true' },
        { key: 'slack_rss_processing_updates_enabled', value: 'false' },
      ],
      error: null,
    })
    const result = await getSlackSettings(null)
    expect(result.webhook_url).toBe('https://hooks.example.com/abc')
    expect(result.low_article_count_enabled).toBe(true)
    expect(result.rss_processing_updates_enabled).toBe(false)

    expect(mocks.mockFrom.mock.calls.some((c: any[]) => c[0] === 'publication_settings')).toBe(false)
    expect(mocks.mockFrom.mock.calls.some((c: any[]) => c[0] === 'app_settings')).toBe(true)
  })

  it('uses publication→app fallback when a publicationId is provided', async () => {
    mocks.setResult({
      data: [{ key: 'slack_webhook_url', value: 'https://pub.example.com/xyz' }],
      error: null,
    })
    const result = await getSlackSettings('pub-1')
    expect(result.webhook_url).toBe('https://pub.example.com/xyz')

    expect(mocks.mockFrom.mock.calls.some((c: any[]) => c[0] === 'publication_settings')).toBe(true)
  })
})
