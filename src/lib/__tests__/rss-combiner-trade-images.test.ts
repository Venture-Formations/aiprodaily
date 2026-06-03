import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Regression test for the trade-card mis-assignment bug: a GOOGL article for
 * one member (Elizabeth Fletcher / Sale) was served another member's card
 * (Nancy Pelosi / BUY) because image generation only ever produced ONE card
 * per ticker. generateMissingFeedTradeImages must now generate a card for every
 * distinct (ticker, member, transaction) tuple in the feed window.
 */

type SupaResponse = { data: any; error: any }
const supabase = vi.hoisted(() => ({
  responseQueue: [] as SupaResponse[],
  fromTables: [] as string[],
}))

function makeChain(response: SupaResponse): any {
  const chain: any = {}
  const passthrough = () => chain
  chain.select = vi.fn(passthrough)
  chain.eq = vi.fn(passthrough)
  chain.not = vi.fn(passthrough)
  chain.gte = vi.fn(passthrough)
  chain.in = vi.fn(passthrough)
  chain.order = vi.fn(passthrough)
  chain.limit = vi.fn(passthrough)
  chain.range = vi.fn(passthrough) // fetchAllPaginated terminal — chain is thenable
  chain.single = vi.fn(() => Promise.resolve(response))
  chain.maybeSingle = vi.fn(() => Promise.resolve(response))
  // Queries that are awaited directly (no terminal method) are thenable.
  chain.then = (resolve: any, reject: any) => Promise.resolve(response).then(resolve, reject)
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      const response = supabase.responseQueue.shift()
      if (!response) {
        throw new Error(`[test] Unexpected supabaseAdmin.from('${table}') — queue empty`)
      }
      supabase.fromTables.push(table)
      return makeChain(response)
    }),
  },
}))

const generateAndUploadTradeImage = vi.hoisted(() => vi.fn())
vi.mock('@/lib/trade-image-generator', () => ({ generateAndUploadTradeImage }))

import { generateMissingFeedTradeImages } from '@/lib/rss-combiner'

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  supabase.responseQueue.length = 0
  supabase.fromTables.length = 0
  generateAndUploadTradeImage.mockReset()
  generateAndUploadTradeImage.mockResolvedValue('https://img.example/card.png')
})

afterEach(() => {
  expect(supabase.responseQueue).toHaveLength(0)
  vi.restoreAllMocks()
})

const FEED_ARTICLES = [
  { ticker: 'GOOGL', transaction_type: 'Sale', trade_meta: { member: 'Elizabeth Fletcher' } },
  { ticker: 'GOOGL', transaction_type: 'Purchase', trade_meta: { member: 'Nancy Pelosi' } },
]

function queue(...responses: SupaResponse[]) {
  for (const r of responses) supabase.responseQueue.push(r)
}

describe('generateMissingFeedTradeImages', () => {
  it('generates a card for EACH (ticker, member, transaction) tuple, not one per ticker', async () => {
    queue(
      { data: { feed_article_age_days: 14 }, error: null }, // combined_feed_settings
      { data: FEED_ARTICLES, error: null }, // congress_feed_articles
      {
        data: [
          { id: 'fletcher-sale', ticker: 'GOOGL', name: 'Elizabeth Fletcher', chamber: 'House', state: 'TX', transaction: 'Sale', company: 'Alphabet', trade_size_parsed: '15000', image_url: null },
          { id: 'pelosi-buy', ticker: 'GOOGL', name: 'Nancy Pelosi', chamber: 'House', state: 'CA', transaction: 'Purchase', company: 'Alphabet', trade_size_parsed: '1000000', image_url: null },
        ],
        error: null,
      }, // congress_trades
      { data: [], error: null }, // ticker_company_names
    )

    const generated = await generateMissingFeedTradeImages()

    expect(generated).toBe(2)
    expect(generateAndUploadTradeImage).toHaveBeenCalledTimes(2)
    const ids = generateAndUploadTradeImage.mock.calls.map((c) => c[0].id).sort()
    expect(ids).toEqual(['fletcher-sale', 'pelosi-buy'])
    // Each card carries that member's own buy/sell side — never the other's.
    const byId = Object.fromEntries(generateAndUploadTradeImage.mock.calls.map((c) => [c[0].id, c[0]]))
    expect(byId['fletcher-sale'].transaction).toBe('Sale')
    expect(byId['pelosi-buy'].transaction).toBe('Purchase')
  })

  it('skips tuples that already have an image', async () => {
    queue(
      { data: { feed_article_age_days: 14 }, error: null },
      { data: FEED_ARTICLES, error: null },
      {
        data: [
          { id: 'fletcher-sale', ticker: 'GOOGL', name: 'Elizabeth Fletcher', chamber: 'House', state: 'TX', transaction: 'Sale', company: 'Alphabet', trade_size_parsed: '15000', image_url: null },
          { id: 'pelosi-buy', ticker: 'GOOGL', name: 'Nancy Pelosi', chamber: 'House', state: 'CA', transaction: 'Purchase', company: 'Alphabet', trade_size_parsed: '1000000', image_url: 'https://img.example/pelosi.png' },
        ],
        error: null,
      },
      { data: [], error: null },
    )

    const generated = await generateMissingFeedTradeImages()

    expect(generated).toBe(1)
    expect(generateAndUploadTradeImage).toHaveBeenCalledTimes(1)
    expect(generateAndUploadTradeImage.mock.calls[0][0].id).toBe('fletcher-sale')
  })

  it('does nothing when the feed window has no trades', async () => {
    queue(
      { data: { feed_article_age_days: 14 }, error: null },
      { data: [], error: null }, // congress_feed_articles
    )

    const generated = await generateMissingFeedTradeImages()

    expect(generated).toBe(0)
    expect(generateAndUploadTradeImage).not.toHaveBeenCalled()
  })
})
