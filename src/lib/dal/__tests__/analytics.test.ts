import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — declared before imports that use them
// ---------------------------------------------------------------------------
const mockSingle = vi.fn()
const mockChain: Record<string, any> = {
  select: vi.fn(function () { return mockChain }),
  eq: vi.fn(function () { return mockChain }),
  is: vi.fn(function () { return mockChain }),
  in: vi.fn(function () { return mockChain }),
  not: vi.fn(function () { return mockChain }),
  single: mockSingle,
  maybeSingle: vi.fn(),
  order: vi.fn(function () { return mockChain }),
  limit: vi.fn(function () { return mockChain }),
}

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => mockChain),
    rpc: vi.fn(() => mockChain),
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

vi.mock('@/lib/analytics/bot-policy', () => ({
  loadExcludedIps: vi.fn(async () => ({
    has: () => false,
    matchesCidr: () => false,
  })),
  isClickCountable: vi.fn(() => true),
  ExcludedIpSet: class {
    has() { return false }
    matchesCidr() { return false }
  },
}))

import { supabaseAdmin } from '@/lib/supabase'
import {
  getDeliveryCounts,
  getUniqueClickers,
  getIssueEngagement,
  getModuleEngagement,
} from '../analytics'

const PUB_ID = 'pub-test-123'
const ISSUE_ID = 'issue-test-456'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getDeliveryCounts', () => {
  it('returns delivery counts when the row exists and ownership matches', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        issue_id: ISSUE_ID,
        sent_count: 1000,
        delivered_count: 980,
        opened_count: 500,
        clicked_count: 50,
        bounced_count: 20,
        unsubscribed_count: 5,
        open_rate: 0.51,
        click_rate: 0.051,
        last_synced_at: '2026-04-23T10:00:00Z',
        imported_at: '2026-04-23T09:00:00Z',
        publication_issues: { publication_id: PUB_ID },
      },
      error: null,
    })

    const result = await getDeliveryCounts({ issueId: ISSUE_ID, publicationId: PUB_ID })

    expect(result).not.toBeNull()
    expect(result!.deliveredCount).toBe(980)
    expect(result!.sentCount).toBe(1000)
    expect(result!.espClickRate).toBe(0.051)
    expect(result!.lastSyncedAt).toBe('2026-04-23T10:00:00Z')
  })

  it('returns null when ownership does not match (no row)', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await getDeliveryCounts({ issueId: ISSUE_ID, publicationId: 'other-pub' })

    expect(result).toBeNull()
  })

  it('returns null on DB error', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    const result = await getDeliveryCounts({ issueId: ISSUE_ID, publicationId: PUB_ID })

    expect(result).toBeNull()
  })
})

describe('getUniqueClickers', () => {
  it('counts unique subscriber_email across countable clicks', async () => {
    const rows = [
      { id: '1', publication_id: PUB_ID, issue_id: ISSUE_ID, subscriber_email: 'a@x.com', link_url: 'u', link_section: 's', ip_address: '1.1.1.1', is_bot_ua: false },
      { id: '2', publication_id: PUB_ID, issue_id: ISSUE_ID, subscriber_email: 'b@x.com', link_url: 'u', link_section: 's', ip_address: '1.1.1.2', is_bot_ua: false },
      { id: '3', publication_id: PUB_ID, issue_id: ISSUE_ID, subscriber_email: 'a@x.com', link_url: 'u', link_section: 's', ip_address: '1.1.1.1', is_bot_ua: false },
    ]
    ;(mockChain.eq as any).mockImplementation(function () { return mockChain })
    ;(mockChain.is as any).mockImplementation(function () { return mockChain })
    ;(mockChain.is as any).mockReturnValueOnce(Promise.resolve({ data: rows, error: null }))

    const count = await getUniqueClickers({
      issueId: ISSUE_ID,
      publicationId: PUB_ID,
      excludeBots: true,
    })

    expect(count).toBe(2)
  })

  it('returns 0 on DB error', async () => {
    ;(mockChain.is as any).mockReturnValueOnce(
      Promise.resolve({ data: null, error: { message: 'oops' } })
    )

    const count = await getUniqueClickers({
      issueId: ISSUE_ID,
      publicationId: PUB_ID,
      excludeBots: true,
    })

    expect(count).toBe(0)
  })

  it('returns 0 when no rows', async () => {
    ;(mockChain.is as any).mockReturnValueOnce(
      Promise.resolve({ data: [], error: null })
    )

    const count = await getUniqueClickers({
      issueId: ISSUE_ID,
      publicationId: PUB_ID,
      excludeBots: true,
    })

    expect(count).toBe(0)
  })
})

describe('getIssueEngagement', () => {
  it('returns null when delivery counts cannot be loaded', async () => {
    // First call (delivery): returns no row
    mockSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await getIssueEngagement({
      issueId: ISSUE_ID,
      publicationId: PUB_ID,
      excludeBots: true,
    })

    expect(result).toBeNull()
  })

  it('returns composed engagement with delivery + totals + uniques', async () => {
    // Delivery counts call
    mockSingle.mockResolvedValueOnce({
      data: {
        issue_id: ISSUE_ID,
        sent_count: 1000,
        delivered_count: 980,
        opened_count: 500,
        clicked_count: 50,
        bounced_count: 20,
        unsubscribed_count: 5,
        open_rate: 0.51,
        click_rate: 0.051,
        last_synced_at: '2026-04-23T10:00:00Z',
        imported_at: '2026-04-23T10:00:00Z',
        publication_issues: { publication_id: PUB_ID },
      },
      error: null,
    })

    // Single fluent-chain resolution for link_clicks query.
    const rows = [
      { id: '1', publication_id: PUB_ID, issue_id: ISSUE_ID, subscriber_email: 'a@x.com', link_url: 'u', link_section: 's', ip_address: '1.1.1.1', is_bot_ua: false },
      { id: '2', publication_id: PUB_ID, issue_id: ISSUE_ID, subscriber_email: 'a@x.com', link_url: 'u', link_section: 's', ip_address: '1.1.1.1', is_bot_ua: false },
      { id: '3', publication_id: PUB_ID, issue_id: ISSUE_ID, subscriber_email: 'b@x.com', link_url: 'u', link_section: 's', ip_address: '1.1.1.2', is_bot_ua: false },
    ]
    ;(mockChain.is as any)
      .mockReturnValueOnce(Promise.resolve({ data: rows, error: null }))

    const result = await getIssueEngagement({
      issueId: ISSUE_ID,
      publicationId: PUB_ID,
      excludeBots: true,
    })

    expect(result).not.toBeNull()
    expect(result!.totalClicks).toBe(3)
    expect(result!.uniqueClickers).toBe(2)
    expect(result!.delivery.deliveredCount).toBe(980)
  })
})

describe('getModuleEngagement', () => {
  it('returns module engagement with defaults to deliveredCount when moduleRecipients not provided', async () => {
    // Delivery counts call
    mockSingle.mockResolvedValueOnce({
      data: {
        issue_id: ISSUE_ID,
        sent_count: 1000,
        delivered_count: 980,
        opened_count: 500,
        clicked_count: 50,
        bounced_count: 20,
        unsubscribed_count: 5,
        open_rate: 0.51,
        click_rate: 0.051,
        last_synced_at: '2026-04-23T10:00:00Z',
        imported_at: '2026-04-23T10:00:00Z',
        publication_issues: { publication_id: PUB_ID },
      },
      error: null,
    })

    const rows = [
      { id: '1', publication_id: PUB_ID, issue_id: ISSUE_ID, subscriber_email: 'a@x.com', link_url: 'u', link_section: 'Ads', ip_address: '1.1.1.1', is_bot_ua: false },
      { id: '2', publication_id: PUB_ID, issue_id: ISSUE_ID, subscriber_email: 'b@x.com', link_url: 'u', link_section: 'Ads', ip_address: '1.1.1.2', is_bot_ua: false },
    ]
    ;(mockChain.is as any).mockReturnValueOnce(Promise.resolve({ data: rows, error: null }))

    const result = await getModuleEngagement({
      moduleId: 'module-1',
      issueId: ISSUE_ID,
      publicationId: PUB_ID,
      linkSection: 'Ads',
      excludeBots: true,
    })

    expect(result).not.toBeNull()
    expect(result!.uniqueClickers).toBe(2)
    expect(result!.totalClicks).toBe(2)
    expect(result!.moduleRecipients).toBe(980) // default = deliveredCount
  })

  it('uses explicit moduleRecipients when provided (segmented module)', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        issue_id: ISSUE_ID,
        sent_count: 1000,
        delivered_count: 980,
        opened_count: 500,
        clicked_count: 10,
        bounced_count: 20,
        unsubscribed_count: 5,
        open_rate: 0.51,
        click_rate: 0.01,
        last_synced_at: '2026-04-23T10:00:00Z',
        imported_at: '2026-04-23T10:00:00Z',
        publication_issues: { publication_id: PUB_ID },
      },
      error: null,
    })

    ;(mockChain.is as any).mockReturnValueOnce(Promise.resolve({ data: [], error: null }))

    const result = await getModuleEngagement({
      moduleId: 'module-1',
      issueId: ISSUE_ID,
      publicationId: PUB_ID,
      linkSection: 'Ads',
      moduleRecipients: 500, // segmented: only 500 of 980 saw this module
      excludeBots: true,
    })

    expect(result).not.toBeNull()
    expect(result!.moduleRecipients).toBe(500)
  })

  it('returns null when delivery cannot be loaded', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await getModuleEngagement({
      moduleId: 'module-1',
      issueId: ISSUE_ID,
      publicationId: 'wrong-pub',
      linkSection: 'Ads',
    })

    expect(result).toBeNull()
  })
})
