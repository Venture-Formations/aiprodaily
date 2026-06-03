import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * resolveIssueTradeimages is the backfill/recheck engine. It must match each
 * article strictly by (ticker, member, transaction) — clearing a wrong image
 * rather than falling back to a ticker-level card.
 */

type SupaResponse = { data: any; error: any }
const supabase = vi.hoisted(() => ({
  responseQueue: [] as SupaResponse[],
  storageList: [] as SupaResponse[],
  updates: [] as Array<{ table: string; payload: any }>,
}))

function makeChain(table: string, response: SupaResponse): any {
  const chain: any = {}
  const passthrough = () => chain
  chain.select = vi.fn(passthrough)
  chain.eq = vi.fn(passthrough)
  chain.in = vi.fn(passthrough)
  chain.not = vi.fn(passthrough)
  chain.order = vi.fn(passthrough)
  chain.range = vi.fn(passthrough) // fetchAllPaginated terminal — chain is thenable
  chain.single = vi.fn(() => Promise.resolve(response))
  chain.maybeSingle = vi.fn(() => Promise.resolve(response))
  chain.update = vi.fn((payload: any) => {
    supabase.updates.push({ table, payload })
    return chain
  })
  chain.then = (resolve: any, reject: any) => Promise.resolve(response).then(resolve, reject)
  return chain
}

vi.mock('../../supabase', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      const response = supabase.responseQueue.shift()
      if (!response) throw new Error(`[test] Unexpected from('${table}') — queue empty`)
      return makeChain(table, response)
    }),
    storage: {
      from: vi.fn(() => ({
        list: vi.fn(() => Promise.resolve(supabase.storageList.shift() || { data: [], error: null })),
      })),
    },
  },
}))

import { resolveIssueTradeImages } from '../resolve-issue-trade-images'

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  supabase.responseQueue.length = 0
  supabase.storageList.length = 0
  supabase.updates.length = 0
})

afterEach(() => {
  expect(supabase.responseQueue).toHaveLength(0)
  vi.restoreAllMocks()
})

const ISSUE = { data: { id: 'iss1', publication_id: 'pub1' }, error: null }

function article(overrides: Record<string, any> = {}) {
  return {
    id: 'art1',
    article_module_id: 'mod1',
    trade_image_url: 'https://img.example/pelosi.png', // the WRONG (ticker-level) card
    trade_image_alt: 'GOOGL',
    ticker: 'GOOGL',
    member_name: 'Elizabeth Fletcher',
    transaction_type: 'Sale',
    rss_post: null,
    ...overrides,
  }
}

describe('resolveIssueTradeImages', () => {
  it('replaces a wrong image with the article\'s own (ticker, member, transaction) card', async () => {
    supabase.responseQueue.push(
      ISSUE,
      { data: [article()], error: null }, // module_articles
      {
        data: [
          { id: 'fletcher-1', ticker: 'GOOGL', image_url: 'https://img.example/fletcher.png', name: 'Elizabeth Fletcher', transaction: 'Sale', quiver_upload_time: '2026-04-30' },
          { id: 'pelosi-1', ticker: 'GOOGL', image_url: 'https://img.example/pelosi.png', name: 'Nancy Pelosi', transaction: 'Purchase', quiver_upload_time: '2026-01-25' },
        ],
        error: null,
      }, // congress_trades
      { data: null, error: null }, // module_articles update
    )
    supabase.storageList.push({ data: [{ name: 'fletcher-1.png' }, { name: 'pelosi-1.png' }], error: null })

    const result = await resolveIssueTradeImages('iss1')

    expect(result.ok).toBe(true)
    expect(result.results[0]).toMatchObject({ matched: 1, cleared: 0, unchanged: 0 })
    expect(supabase.updates).toHaveLength(1)
    expect(supabase.updates[0].payload.trade_image_url).toBe('https://img.example/fletcher.png')
  })

  it('clears the image (null) when no exact tuple card exists — no ticker fallback', async () => {
    supabase.responseQueue.push(
      ISSUE,
      { data: [article()], error: null },
      {
        data: [
          // Only Pelosi has a card; Fletcher/Sale has none → must NOT be used.
          { id: 'pelosi-1', ticker: 'GOOGL', image_url: 'https://img.example/pelosi.png', name: 'Nancy Pelosi', transaction: 'Purchase', quiver_upload_time: '2026-01-25' },
        ],
        error: null,
      },
      { data: null, error: null }, // update
    )
    supabase.storageList.push({ data: [{ name: 'pelosi-1.png' }], error: null })

    const result = await resolveIssueTradeImages('iss1')

    expect(result.ok).toBe(true)
    expect(result.results[0]).toMatchObject({ matched: 0, cleared: 1, unchanged: 0 })
    expect(supabase.updates[0].payload.trade_image_url).toBeNull()
    expect(supabase.updates[0].payload.trade_image_alt).toBeNull()
  })

  it('returns 404 when the issue does not exist', async () => {
    supabase.responseQueue.push({ data: null, error: { message: 'not found' } })

    const result = await resolveIssueTradeImages('missing')

    expect(result.ok).toBe(false)
    expect(result.status).toBe(404)
  })
})
