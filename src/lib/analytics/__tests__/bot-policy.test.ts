import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports that use them
// ---------------------------------------------------------------------------
const mockChain: Record<string, any> = {
  select: vi.fn(function (this: any) { return mockChain }),
  eq: vi.fn(function () { return mockChain }),
}

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => mockChain),
  },
}))

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    correlationId: 'test-id',
  })),
}))

import { ExcludedIpSet, isClickCountable, loadExcludedIps } from '../bot-policy'
import type { LinkClickRow } from '../types'

beforeEach(() => {
  vi.clearAllMocks()
  mockChain.select.mockReturnValue(mockChain)
  mockChain.eq.mockReturnValue(mockChain)
})

describe('ExcludedIpSet', () => {
  it('matches exact IPs', () => {
    const set = new ExcludedIpSet([
      { ip_address: '1.2.3.4', is_range: false, cidr_prefix: null },
    ])
    expect(set.has('1.2.3.4')).toBe(true)
    expect(set.has('1.2.3.5')).toBe(false)
  })

  it('matches IPv4 CIDR ranges', () => {
    const set = new ExcludedIpSet([
      { ip_address: '10.0.0.0', is_range: true, cidr_prefix: 8 },
    ])
    expect(set.matchesCidr('10.1.2.3')).toBe(true)
    expect(set.matchesCidr('11.1.2.3')).toBe(false)
  })

  it('handles null IP lookup gracefully', () => {
    const set = new ExcludedIpSet([
      { ip_address: '1.2.3.4', is_range: false, cidr_prefix: null },
    ])
    expect(set.has(null)).toBe(false)
    expect(set.matchesCidr(null)).toBe(false)
  })

  it('is case-insensitive to IP casing (IPv6 safety)', () => {
    const set = new ExcludedIpSet([
      { ip_address: '2001:DB8::1', is_range: false, cidr_prefix: null },
    ])
    expect(set.has('2001:db8::1')).toBe(true)
  })
})

describe('isClickCountable', () => {
  const emptySet = new ExcludedIpSet([])

  function row(overrides: Partial<LinkClickRow>): LinkClickRow {
    return {
      id: 'id-1',
      publication_id: 'pub-1',
      issue_id: 'issue-1',
      subscriber_email: 'a@b.com',
      link_url: 'https://example.com',
      link_section: 'Articles',
      ip_address: '1.1.1.1',
      is_bot_ua: false,
      ...overrides,
    }
  }

  it('returns true for a normal human click', () => {
    expect(isClickCountable(row({}), emptySet)).toBe(true)
  })

  it('returns false when is_bot_ua is true', () => {
    expect(isClickCountable(row({ is_bot_ua: true }), emptySet)).toBe(false)
  })

  it('returns false when IP is in excluded set (exact match)', () => {
    const set = new ExcludedIpSet([
      { ip_address: '1.1.1.1', is_range: false, cidr_prefix: null },
    ])
    expect(isClickCountable(row({}), set)).toBe(false)
  })

  it('returns false when IP matches an excluded CIDR range', () => {
    const set = new ExcludedIpSet([
      { ip_address: '1.1.0.0', is_range: true, cidr_prefix: 16 },
    ])
    expect(isClickCountable(row({ ip_address: '1.1.5.200' }), set)).toBe(false)
  })

  it('treats null is_bot_ua as not-a-bot (historical rows)', () => {
    expect(isClickCountable(row({ is_bot_ua: null }), emptySet)).toBe(true)
  })
})

describe('loadExcludedIps', () => {
  it('queries excluded_ips for the given publication and returns a populated set', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase')
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            { ip_address: '1.2.3.4', is_range: false, cidr_prefix: null },
            { ip_address: '10.0.0.0', is_range: true, cidr_prefix: 8 },
          ],
          error: null,
        }),
      }),
    } as any)

    const set = await loadExcludedIps('pub-1')

    expect(set.has('1.2.3.4')).toBe(true)
    expect(set.matchesCidr('10.5.5.5')).toBe(true)
  })

  it('returns empty set on DB error', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase')
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'oops' } }),
      }),
    } as any)

    const set = await loadExcludedIps('pub-1')

    expect(set.has('1.2.3.4')).toBe(false)
  })
})
