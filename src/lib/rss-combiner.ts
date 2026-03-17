import { Feed } from 'feed'
import { supabaseAdmin } from '@/lib/supabase'
import { XMLParser } from 'fast-xml-parser'

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
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

export interface IngestionResult {
  feedsFetched: number
  feedsFailed: number
  articlesStored: number
  articlesFiltered: number
  articlesSkippedDuplicate: number
}

// Module-level cache
let cachedXml: string | null = null
let cachedAt: number | null = null

/**
 * Fetch and parse an RSS feed using native fetch + fast-xml-parser.
 * More reliable than rss-parser for Google News feeds on serverless.
 */
async function fetchRssFeed(
  url: string,
  timeoutMs = 15_000
): Promise<{ title?: string; link?: string; items: any[] }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AIProDaily/1.0; +https://aiprodaily.com)',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    }

    const xml = await res.text()
    const parsed = xmlParser.parse(xml)

    const channel = parsed?.rss?.channel
    if (!channel) return { items: [] }

    // Normalize items to always be an array
    const rawItems = channel.item
    const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : []

    return {
      title: channel.title,
      link: channel.link,
      items,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Extract the publisher/source name from a parsed RSS item.
 * Google News RSS includes <source>Publisher Name</source>.
 */
function extractSourceName(item: any): string {
  if (item.source) {
    if (typeof item.source === 'string') return item.source
    if (item.source['#text']) return item.source['#text']
  }
  const title = item.title || ''
  const dashIdx = title.lastIndexOf(' - ')
  if (dashIdx > 0) {
    return title.substring(dashIdx + 3).trim()
  }
  return ''
}

/**
 * Extract the source domain from a parsed RSS item.
 * Google News RSS includes <source url="https://domain.com">.
 * Falls back to extracting domain from the article link.
 */
function extractSourceDomain(item: any): string {
  if (item.source?.['@_url']) {
    try {
      return new URL(item.source['@_url']).hostname
    } catch {}
  }
  if (item.link) {
    try {
      return new URL(item.link).hostname
    } catch {}
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

  // "Over X" -> X + 1
  const overMatch = cleaned.match(/over\s+([\d.]+)/i)
  if (overMatch) {
    return (parseFloat(overMatch[1]) || 0) + 1
  }

  // Range "X - Y" -> take Y (upper bound)
  const rangeMatch = cleaned.match(/([\d.]+)\s*-\s*([\d.]+)/)
  if (rangeMatch) {
    return parseFloat(rangeMatch[2]) || 0
  }

  // Exact amount
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

/**
 * Fetch all rows from a Supabase table using pagination.
 * Supabase defaults to 1,000 rows per request.
 */
async function fetchAllRows<T>(
  table: string,
  columns: string,
  options?: {
    order?: { column: string; ascending: boolean }
    filters?: Array<{ column: string; op: 'eq' | 'neq'; value: any }>
  }
): Promise<T[]> {
  const PAGE_SIZE = 1000
  const allRows: T[] = []
  let offset = 0

  while (true) {
    let query = supabaseAdmin
      .from(table)
      .select(columns)
      .range(offset, offset + PAGE_SIZE - 1)

    if (options?.order) {
      query = query.order(options.order.column, { ascending: options.order.ascending })
    }

    if (options?.filters) {
      for (const f of options.filters) {
        query = query.eq(f.column, f.value)
      }
    }

    const { data, error } = await query

    if (error) {
      console.error(`[RSS-Combiner] Failed to fetch ${table}:`, error.message)
      break
    }

    if (!data || data.length === 0) break

    allRows.push(...(data as T[]))

    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return allRows
}

/**
 * Get top trades: deduplicate by ticker (keep largest trade_size_parsed),
 * exclude tickers in combined_feed_excluded_companies, sort by size DESC, limit N.
 */
export async function getTopTrades(maxTrades: number): Promise<CongressTrade[]> {
  // Get excluded tickers (small table, no pagination needed)
  const { data: excludedRows } = await supabaseAdmin
    .from('combined_feed_excluded_companies')
    .select('ticker')

  const excludedTickers = new Set(
    (excludedRows || []).map((r) => r.ticker.toUpperCase())
  )

  // Fetch all trades with pagination, ordered by size desc
  const trades = await fetchAllRows<CongressTrade>(
    'congress_trades',
    'id, ticker, ticker_type, company, traded, filed, transaction, trade_size_usd, trade_size_parsed, name, party, district, chamber, state',
    { order: { column: 'trade_size_parsed', ascending: false } }
  )

  // Deduplicate by ticker (first occurrence = largest trade since sorted by size desc)
  // Skip "Over $50,000,000" trades — these are outliers that often fail to fetch
  const seen = new Set<string>()
  const deduped: CongressTrade[] = []

  for (const trade of trades) {
    const upperTicker = trade.ticker.toUpperCase()
    if (excludedTickers.has(upperTicker)) continue
    if (trade.trade_size_usd?.toLowerCase().startsWith('over')) continue
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
 * Get total trade count and unique ticker count using pagination-safe methods.
 */
export async function getTradeStats(): Promise<{ totalTrades: number; uniqueTickers: number }> {
  // Use count query for total (no pagination issue)
  const { count: totalTrades } = await supabaseAdmin
    .from('congress_trades')
    .select('id', { count: 'exact', head: true })

  // Fetch all tickers with pagination for accurate unique count
  const allTickers = await fetchAllRows<{ ticker: string }>(
    'congress_trades',
    'ticker'
  )

  const uniqueTickers = new Set(
    allTickers.map((r) => r.ticker.toUpperCase())
  ).size

  return { totalTrades: totalTrades ?? 0, uniqueTickers }
}

/**
 * Generate RSS search URLs from trades using transaction-specific URL templates.
 * Sale trades (Sale, Sale (Partial), Sale (Full)) use saleTemplate.
 * Purchase trades use purchaseTemplate.
 * Trades that are neither sale nor purchase are skipped.
 */
function generateFeedUrls(
  trades: TradeWithCompanyName[],
  saleTemplate: string,
  purchaseTemplate: string
): { trade: TradeWithCompanyName; url: string }[] {
  const entries: { trade: TradeWithCompanyName; url: string }[] = []

  for (const trade of trades) {
    const txn = trade.transaction?.toLowerCase() ?? ''
    let template = ''
    if (txn.startsWith('sale') && saleTemplate) {
      template = saleTemplate
    } else if (txn === 'purchase' && purchaseTemplate) {
      template = purchaseTemplate
    } else {
      continue // skip trades that aren't sale or purchase
    }
    entries.push({
      trade,
      url: template.replace(
        '{company_name}',
        encodeURIComponent(trade.company_name)
      ),
    })
  }

  return entries
}

/**
 * Fetch feeds, filter, enrich with trade metadata, deduplicate by article URL.
 * Retained for testing/manual use; no longer called by getCombinedFeed.
 */
async function fetchAndEnrichFeeds(
  feedEntries: { trade: TradeWithCompanyName; url: string }[],
  maxAgeDays: number,
  excludedSources: Set<string>,
  excludedKeywords: string[],
  maxArticlesPerTrade: number
): Promise<NormalizedItem[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - maxAgeDays)

  const excludedSourcesLower = new Set(
    Array.from(excludedSources).map((s) => s.toLowerCase())
  )
  const keywordsLower = excludedKeywords.map((k) => k.toLowerCase())

  // Fetch sequentially with delay to avoid Google rate-limiting
  const DELAY_MS = 500
  const allItems: NormalizedItem[] = []
  let succeeded = 0
  let failed = 0

  for (let i = 0; i < feedEntries.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, DELAY_MS))

    const { trade, url } = feedEntries[i]
    let lastError = ''

    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 2000))
      try {
        const feed = await fetchRssFeed(url)
        const items = feed.items.slice(0, maxArticlesPerTrade).map((item: any) => ({
          title: item.title || 'Untitled',
          link: item.link || '',
          description: item.description || '',
          pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
          author: item['dc:creator'] || '',
          sourceLabel: trade.company_name,
          sourceName: extractSourceName(item),
          guid: item.guid?.['#text'] || item.guid || item.link || `${url}#${item.title}`,
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
        allItems.push(...items)
        succeeded++
        console.log(`[RSS-Combiner] ${trade.ticker} (${trade.company_name}): ${items.length} articles${attempt > 0 ? ' (retry)' : ''}`)
        lastError = ''
        break
      } catch (err: any) {
        lastError = err.message
      }
    }

    if (lastError) {
      failed++
      console.error(`[RSS-Combiner] ${trade.ticker} (${trade.company_name}) failed after 2 attempts: ${lastError}`)
    }
  }

  console.log(`[RSS-Combiner] Fetched ${succeeded}/${succeeded + failed} feeds, ${allItems.length} articles total`)

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

/**
 * Ingest articles from Google News RSS feeds into the congress_feed_articles table.
 * Fetches feeds sequentially, filters by approved sources and excluded keywords,
 * and upserts each article by article_url.
 */
export async function runIngestion(): Promise<IngestionResult> {
  // 1. Load settings
  const { data: settings } = await supabaseAdmin
    .from('combined_feed_settings')
    .select('max_trades, sale_url_template, purchase_url_template, max_age_days')
    .limit(1)
    .single()

  const maxTrades = settings?.max_trades ?? 21
  const saleTemplate = settings?.sale_url_template || ''
  const purchaseTemplate = settings?.purchase_url_template || ''
  const maxAgeDays = settings?.max_age_days ?? 7

  // 2. Load approved source domains
  const { data: approvedRows } = await supabaseAdmin
    .from('congress_approved_sources')
    .select('source_domain')
    .eq('is_active', true)

  const approvedDomains = new Set(
    (approvedRows || []).map((r: { source_domain: string }) => r.source_domain.toLowerCase())
  )

  // 3. Load excluded keywords
  const { data: excludedKeywordRows } = await supabaseAdmin
    .from('combined_feed_excluded_keywords')
    .select('keyword')

  const excludedKeywords = (excludedKeywordRows || []).map((r: { keyword: string }) => r.keyword.toLowerCase())

  // 4. Get top trades and resolve names
  const trades = await getTopTrades(maxTrades)
  const tradesWithNames = await resolveTickerNames(trades)
  const feedEntries = generateFeedUrls(tradesWithNames, saleTemplate, purchaseTemplate)

  // 5. Calculate age cutoff
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - maxAgeDays)

  // 6. Fetch feeds sequentially and upsert articles
  const DELAY_MS = 500
  let feedsFetched = 0
  let feedsFailed = 0
  let articlesStored = 0
  let articlesFiltered = 0
  let articlesSkippedDuplicate = 0

  for (let i = 0; i < feedEntries.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, DELAY_MS))

    const { trade, url } = feedEntries[i]
    let lastError = ''

    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 2000))
      try {
        const feed = await fetchRssFeed(url)
        const items = feed.items
        let storedForTrade = 0

        for (const item of items) {
          const sourceName = extractSourceName(item)
          const sourceDomain = extractSourceDomain(item)
          const title = item.title || 'Untitled'
          const link = item.link || ''
          const pubDate = item.pubDate ? new Date(item.pubDate) : new Date()

          // Filter: approved sources only
          if (!sourceDomain || !approvedDomains.has(sourceDomain.toLowerCase())) {
            articlesFiltered++
            continue
          }

          // Filter: excluded keywords
          const titleLower = title.toLowerCase()
          if (excludedKeywords.some((kw) => titleLower.includes(kw))) {
            articlesFiltered++
            continue
          }

          // Filter: max age
          if (pubDate < cutoff) {
            articlesFiltered++
            continue
          }

          // Skip if no link
          if (!link) {
            articlesFiltered++
            continue
          }

          // Upsert into congress_feed_articles
          const { error } = await supabaseAdmin
            .from('congress_feed_articles')
            .upsert(
              {
                ticker: trade.ticker,
                company_name: trade.company_name,
                transaction_type: trade.transaction,
                article_title: title,
                article_url: link,
                article_description: item.description || null,
                source_name: sourceName || null,
                source_domain: sourceDomain || null,
                published_at: pubDate.toISOString(),
                trade_meta: {
                  member: trade.name,
                  party: trade.party,
                  chamber: trade.chamber,
                  state: trade.state,
                  district: trade.district,
                  traded: trade.traded,
                },
                ingested_at: new Date().toISOString(),
              },
              { onConflict: 'article_url' }
            )

          if (error) {
            if (error.code === '23505') {
              articlesSkippedDuplicate++
            } else {
              console.error(`[RSS-Combiner] Upsert failed for ${link}:`, error.message)
            }
          } else {
            storedForTrade++
            articlesStored++
          }
        }

        feedsFetched++
        console.log(`[RSS-Combiner] Ingested ${trade.ticker} (${trade.company_name}): ${storedForTrade} stored, ${items.length - storedForTrade} filtered/skipped${attempt > 0 ? ' (retry)' : ''}`)
        lastError = ''
        break
      } catch (err: any) {
        lastError = err.message
      }
    }

    if (lastError) {
      feedsFailed++
      console.error(`[RSS-Combiner] ${trade.ticker} (${trade.company_name}) failed after 2 attempts: ${lastError}`)
    }
  }

  // 7. Update last_ingestion_at
  await supabaseAdmin
    .from('combined_feed_settings')
    .update({ last_ingestion_at: new Date().toISOString() })
    .not('id', 'is', null)

  console.log(`[RSS-Combiner] Ingestion complete: ${feedsFetched}/${feedsFetched + feedsFailed} feeds, ${articlesStored} stored, ${articlesFiltered} filtered, ${articlesSkippedDuplicate} duplicates`)

  return { feedsFetched, feedsFailed, articlesStored, articlesFiltered, articlesSkippedDuplicate }
}

/**
 * Serve the combined RSS feed from stored articles in congress_feed_articles.
 * Uses module-level cache with configurable TTL from combined_feed_settings.
 */
export async function getCombinedFeed(forceRefresh = false): Promise<string> {
  // Load settings
  const { data: settings } = await supabaseAdmin
    .from('combined_feed_settings')
    .select('max_age_days, cache_ttl_minutes, feed_title')
    .limit(1)
    .single()

  const cacheTtlMs = (settings?.cache_ttl_minutes ?? 15) * 60 * 1000

  // Return cached if fresh
  if (!forceRefresh && cachedXml && cachedAt && Date.now() - cachedAt < cacheTtlMs) {
    return cachedXml
  }

  const maxAgeDays = settings?.max_age_days ?? 7
  const feedTitle = settings?.feed_title ?? 'Combined RSS Feed'

  // Query stored articles from DB
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays)

  const { data: articles, error } = await supabaseAdmin
    .from('congress_feed_articles')
    .select('article_title, article_url, article_description, source_name, source_domain, published_at, ticker, company_name, transaction_type, trade_meta')
    .gte('published_at', cutoffDate.toISOString())
    .order('published_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[RSS-Combiner] Failed to query articles:', error.message)
    throw new Error('Failed to query stored articles')
  }

  // Convert DB rows to NormalizedItem format
  const items: NormalizedItem[] = (articles || []).map((row) => ({
    title: row.article_title,
    link: row.article_url,
    description: row.article_description || '',
    pubDate: new Date(row.published_at),
    author: '',
    sourceLabel: row.company_name,
    sourceName: row.source_name || '',
    guid: row.article_url,
    tradeMeta: {
      ticker: row.ticker,
      company_name: row.company_name,
      traded: row.trade_meta?.traded || '',
      transaction: row.transaction_type,
      name: row.trade_meta?.member || null,
      party: row.trade_meta?.party || null,
      district: row.trade_meta?.district || null,
      chamber: row.trade_meta?.chamber || null,
      state: row.trade_meta?.state || null,
    },
  }))

  const xml = generateCombinedFeedXml(items, feedTitle)
  cachedXml = xml
  cachedAt = Date.now()

  return xml
}

export function invalidateCache(): void {
  cachedXml = null
  cachedAt = null
}
