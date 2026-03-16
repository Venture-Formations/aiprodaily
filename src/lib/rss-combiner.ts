import Parser from 'rss-parser'
import { Feed } from 'feed'
import { supabaseAdmin } from '@/lib/supabase'

const parser = new Parser({
  customFields: {
    item: ['media:content', 'enclosure', 'source'],
  },
})

interface CongressTrade {
  id: string
  ticker: string
  ticker_type: string | null
  company: string | null
  traded: string
  filed: string | null
  transaction: string | null
  trade_size_usd: string | null
  trade_size_parsed: number
  name: string | null
  party: string | null
  district: string | null
  chamber: string | null
  state: string | null
}

interface TradeWithCompanyName extends CongressTrade {
  company_name: string
}

interface NormalizedItem {
  title: string
  link: string
  description: string
  pubDate: Date
  author: string
  sourceLabel: string
  sourceName: string
  guid: string
  tradeMeta?: {
    ticker: string
    company_name: string
    traded: string
    transaction: string | null
    name: string | null
    party: string | null
    district: string | null
    chamber: string | null
    state: string | null
  }
}

// Module-level cache
let cachedXml: string | null = null
let cachedAt: number | null = null

/**
 * Extract the publisher/source name from an RSS item.
 * Google News RSS includes <source>Publisher Name</source>.
 */
function extractSourceName(item: any): string {
  if (item.source && typeof item.source === 'string') {
    return item.source
  }
  if (item.source?._) {
    return item.source._
  }
  const title = item.title || ''
  const dashIdx = title.lastIndexOf(' - ')
  if (dashIdx > 0) {
    return title.substring(dashIdx + 3).trim()
  }
  return ''
}

/**
 * Parse the Trade_Size_USD field into a numeric upper bound for sorting.
 * Formats: "$1,001 - $15,000", "$1,000.00", "Over $50,000,000"
 */
export function parseTradeSize(raw: string | null | undefined): number {
  if (!raw || typeof raw !== 'string') return 0
  const cleaned = raw.replace(/[$,]/g, '').trim()

  // "Over X" → X + 1
  const overMatch = cleaned.match(/over\s+([\d.]+)/i)
  if (overMatch) {
    return (parseFloat(overMatch[1]) || 0) + 1
  }

  // Range "X - Y" → take Y (upper bound)
  const rangeMatch = cleaned.match(/([\d.]+)\s*-\s*([\d.]+)/)
  if (rangeMatch) {
    return parseFloat(rangeMatch[2]) || 0
  }

  // Exact amount
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

/**
 * Get top trades: deduplicate by ticker (keep largest trade_size_parsed),
 * exclude tickers in combined_feed_excluded_companies, sort by size DESC, limit N.
 */
export async function getTopTrades(maxTrades: number): Promise<CongressTrade[]> {
  // Get excluded tickers
  const { data: excludedRows } = await supabaseAdmin
    .from('combined_feed_excluded_companies')
    .select('ticker')

  const excludedTickers = new Set(
    (excludedRows || []).map((r) => r.ticker.toUpperCase())
  )

  // Get all trades, ordered by size desc
  const { data: trades, error } = await supabaseAdmin
    .from('congress_trades')
    .select('id, ticker, ticker_type, company, traded, filed, transaction, trade_size_usd, trade_size_parsed, name, party, district, chamber, state')
    .order('trade_size_parsed', { ascending: false })

  if (error || !trades) {
    console.error('[RSS-Combiner] Failed to fetch trades:', error?.message)
    return []
  }

  // Deduplicate by ticker (first occurrence = largest trade since sorted by size desc)
  const seen = new Set<string>()
  const deduped: CongressTrade[] = []

  for (const trade of trades) {
    const upperTicker = trade.ticker.toUpperCase()
    if (excludedTickers.has(upperTicker)) continue
    if (seen.has(upperTicker)) continue
    seen.add(upperTicker)
    deduped.push(trade)
    if (deduped.length >= maxTrades) break
  }

  return deduped
}

/**
 * Batch resolve tickers to clean company names.
 * Falls back to the raw company field from the trade.
 */
export async function resolveTickerNames(
  trades: CongressTrade[]
): Promise<TradeWithCompanyName[]> {
  const tickers = trades.map((t) => t.ticker.toUpperCase())

  const { data: mappings } = await supabaseAdmin
    .from('ticker_company_names')
    .select('ticker, company_name')
    .in('ticker', tickers)

  const tickerMap = new Map(
    (mappings || []).map((m) => [m.ticker.toUpperCase(), m.company_name])
  )

  return trades.map((trade) => ({
    ...trade,
    company_name:
      tickerMap.get(trade.ticker.toUpperCase()) ||
      trade.company ||
      trade.ticker,
  }))
}

/**
 * Generate RSS search URLs from trades using transaction-specific URL templates.
 * Sale trades (Sale, Sale (Partial), Sale (Full)) use saleTemplate.
 * Purchase trades use purchaseTemplate.
 */
function generateFeedUrls(
  trades: TradeWithCompanyName[],
  saleTemplate: string,
  purchaseTemplate: string
): { trade: TradeWithCompanyName; url: string }[] {
  return trades.map((trade) => {
    const isSale = trade.transaction?.toLowerCase().startsWith('sale')
    const template = isSale ? saleTemplate : purchaseTemplate
    return {
      trade,
      url: template.replace(
        '{company_name}',
        encodeURIComponent(trade.company_name)
      ),
    }
  })
}

/**
 * Fetch feeds, filter, enrich with trade metadata, deduplicate by article URL.
 */
async function fetchAndEnrichFeeds(
  feedEntries: { trade: TradeWithCompanyName; url: string }[],
  maxAgeDays: number,
  excludedSources: Set<string>,
  excludedKeywords: string[]
): Promise<NormalizedItem[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - maxAgeDays)

  const excludedSourcesLower = new Set(
    Array.from(excludedSources).map((s) => s.toLowerCase())
  )
  const keywordsLower = excludedKeywords.map((k) => k.toLowerCase())

  const results = await Promise.allSettled(
    feedEntries.map(async ({ trade, url }) => {
      const feed = await parser.parseURL(url)
      return feed.items.map((item) => ({
        title: item.title || 'Untitled',
        link: item.link || '',
        description: item.contentSnippet || item.content || '',
        pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
        author: item.creator || (item as any).author || '',
        sourceLabel: trade.company_name,
        sourceName: extractSourceName(item),
        guid: item.guid || item.link || `${url}#${item.title}`,
        tradeMeta: {
          ticker: trade.ticker,
          company_name: trade.company_name,
          traded: trade.traded,
          transaction: trade.transaction,
          name: trade.name,
          party: trade.party,
          district: trade.district,
          chamber: trade.chamber,
          state: trade.state,
        },
      }))
    })
  )

  const allItems: NormalizedItem[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value)
    } else {
      console.error(
        '[RSS-Combiner] Feed fetch failed:',
        result.reason?.message || result.reason
      )
    }
  }

  // Deduplicate by article URL (keep first occurrence)
  const seenUrls = new Set<string>()
  const deduped: NormalizedItem[] = []

  for (const item of allItems) {
    if (seenUrls.has(item.link)) continue
    seenUrls.add(item.link)
    deduped.push(item)
  }

  return deduped
    .filter((item) => item.pubDate >= cutoff)
    .filter(
      (item) =>
        !item.sourceName ||
        !excludedSourcesLower.has(item.sourceName.toLowerCase())
    )
    .filter((item) => {
      const titleLower = item.title.toLowerCase()
      return !keywordsLower.some((kw) => titleLower.includes(kw))
    })
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
}

export function generateCombinedFeedXml(
  items: NormalizedItem[],
  feedTitle: string
): string {
  const feed = new Feed({
    title: feedTitle,
    description: 'Congressional trading RSS feed with trade metadata',
    id: 'combined-rss-feed',
    link: 'https://aiprodaily.com',
    copyright: '',
    updated: items.length > 0 ? items[0].pubDate : new Date(),
    generator: 'AIProDaily RSS Combiner',
  })

  for (const item of items) {
    const categories: { name: string }[] = []

    if (item.sourceLabel) categories.push({ name: item.sourceLabel })
    if (item.sourceName) categories.push({ name: `source:${item.sourceName}` })

    // Build custom XML extensions for trade metadata
    const extensions: { name: string; objects: Record<string, unknown> }[] = []
    if (item.tradeMeta) {
      const m = item.tradeMeta
      extensions.push({ name: 'ticker', objects: { _text: m.ticker } })
      extensions.push({ name: 'company', objects: { _text: m.company_name } })
      if (m.traded) extensions.push({ name: 'traded', objects: { _text: m.traded } })
      if (m.transaction) extensions.push({ name: 'transaction', objects: { _text: m.transaction } })
      if (m.name) extensions.push({ name: 'member', objects: { _text: m.name } })
      if (m.party) extensions.push({ name: 'party', objects: { _text: m.party } })
      if (m.district) extensions.push({ name: 'district', objects: { _text: m.district } })
      if (m.chamber) extensions.push({ name: 'chamber', objects: { _text: m.chamber } })
      if (m.state) extensions.push({ name: 'state', objects: { _text: m.state } })
    }

    feed.addItem({
      title: item.title,
      id: item.guid,
      link: item.link,
      description: item.description,
      date: item.pubDate,
      author: item.author ? [{ name: item.author }] : undefined,
      category: categories,
      extensions,
    })
  }

  return feed.rss2()
}

export async function getCombinedFeed(forceRefresh = false): Promise<string> {
  // Load settings
  const { data: settings } = await supabaseAdmin
    .from('combined_feed_settings')
    .select('max_age_days, cache_ttl_minutes, feed_title, url_template, sale_url_template, purchase_url_template, max_trades')
    .limit(1)
    .single()

  const cacheTtlMs = (settings?.cache_ttl_minutes ?? 15) * 60 * 1000

  // Return cached if fresh
  if (
    !forceRefresh &&
    cachedXml &&
    cachedAt &&
    Date.now() - cachedAt < cacheTtlMs
  ) {
    return cachedXml
  }

  const maxTrades = settings?.max_trades ?? 21
  const defaultTemplate =
    settings?.url_template ??
    'https://news.google.com/rss/search?q={company_name}+stock&hl=en-US&gl=US&ceid=US:en'
  const saleTemplate = settings?.sale_url_template || defaultTemplate
  const purchaseTemplate = settings?.purchase_url_template || defaultTemplate

  // Get top trades and resolve company names
  const trades = await getTopTrades(maxTrades)
  const tradesWithNames = await resolveTickerNames(trades)
  const feedEntries = generateFeedUrls(tradesWithNames, saleTemplate, purchaseTemplate)

  // Load excluded sources (publisher names)
  const { data: excludedSourceRows } = await supabaseAdmin
    .from('combined_feed_excluded_sources')
    .select('source_name')

  const excludedSources = new Set(
    (excludedSourceRows || []).map((r) => r.source_name)
  )

  // Load excluded keywords
  const { data: excludedKeywordRows } = await supabaseAdmin
    .from('combined_feed_excluded_keywords')
    .select('keyword')

  const excludedKeywords = (excludedKeywordRows || []).map((r) => r.keyword)

  if (feedEntries.length === 0) {
    const emptyFeed = generateCombinedFeedXml(
      [],
      settings?.feed_title ?? 'Combined RSS Feed'
    )
    cachedXml = emptyFeed
    cachedAt = Date.now()
    return emptyFeed
  }

  const items = await fetchAndEnrichFeeds(
    feedEntries,
    settings?.max_age_days ?? 7,
    excludedSources,
    excludedKeywords
  )

  const xml = generateCombinedFeedXml(
    items,
    settings?.feed_title ?? 'Combined RSS Feed'
  )

  cachedXml = xml
  cachedAt = Date.now()

  return xml
}

export function invalidateCache(): void {
  cachedXml = null
  cachedAt = null
}
