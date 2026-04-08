import { Feed } from 'feed'
import { supabaseAdmin } from '@/lib/supabase'
import { XMLParser } from 'fast-xml-parser'
import { generateAndUploadTradeImage } from './trade-image-generator'

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
  quiver_upload_time: string | null
  image_url: string | null
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
  tradeImageUrl?: string | null
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

// Module-level cache for feed XML
let cachedXml: string | null = null
let cachedAt: number | null = null

// Module-level cache for trades (expensive computation, only changes on upload/settings change)
let cachedTradesResponse: { trades: any[]; stats: any } | null = null

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
  let hostname = ''
  if (item.source?.['@_url']) {
    try {
      hostname = new URL(item.source['@_url']).hostname
    } catch {}
  }
  if (!hostname && item.link) {
    try {
      hostname = new URL(item.link).hostname
    } catch {}
  }
  // Normalize: strip www. prefix for consistent matching
  return hostname.replace(/^www\./, '')
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
export async function getTopTrades(maxTrades: number, tradeFreshnessDays?: number, maxTradesPerMember?: number): Promise<CongressTrade[]> {
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
    'id, ticker, ticker_type, company, traded, filed, transaction, trade_size_usd, trade_size_parsed, name, party, district, chamber, state, quiver_upload_time, image_url',
    { order: { column: 'trade_size_parsed', ascending: false } }
  )

  // Helper: run dedup/exclusion/per-member logic on a set of trades
  const perMemberLimit = maxTradesPerMember ?? 0 // 0 = no limit
  const selectTrades = (pool: CongressTrade[]): CongressTrade[] => {
    const seen = new Set<string>()
    const memberCounts = new Map<string, number>()
    const result: CongressTrade[] = []

    for (const trade of pool) {
      const upperTicker = trade.ticker.toUpperCase()
      if (excludedTickers.has(upperTicker)) continue
      if (trade.trade_size_usd?.toLowerCase().startsWith('over')) continue
      if (seen.has(upperTicker)) continue

      if (perMemberLimit > 0 && trade.name) {
        const memberKey = trade.name.toLowerCase().trim()
        const count = memberCounts.get(memberKey) ?? 0
        if (count >= perMemberLimit) continue
        memberCounts.set(memberKey, count + 1)
      }

      seen.add(upperTicker)
      result.push(trade)
      if (result.length >= maxTrades) break
    }

    return result
  }

  // Apply freshness filter based on quiver_upload_time
  // Expands window by 5 days at a time until we have enough qualified trades (up to 90 days max)
  let deduped: CongressTrade[]
  if (tradeFreshnessDays && tradeFreshnessDays > 0) {
    const MAX_WINDOW = 90
    let windowDays = tradeFreshnessDays
    deduped = []

    while (windowDays <= MAX_WINDOW) {
      const freshnessDate = new Date()
      freshnessDate.setDate(freshnessDate.getDate() - windowDays)
      const freshnessStr = freshnessDate.toISOString().split('T')[0]
      const filtered = trades.filter(
        (t) => t.quiver_upload_time && t.quiver_upload_time >= freshnessStr
      )

      const selected = selectTrades(filtered)

      if (selected.length >= maxTrades || windowDays >= MAX_WINDOW) {
        deduped = selected
        console.log(`[RSS-Combiner] Freshness: ${windowDays}-day window → ${filtered.length} raw → ${selected.length} selected trades`)
        break
      }

      windowDays += 5
    }
  } else {
    deduped = selectTrades(trades)
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
 * Get total trade count and unique ticker count.
 * Uses exact count for total and a single bounded query for unique tickers.
 */
export async function getTradeStats(): Promise<{ totalTrades: number; uniqueTickers: number }> {
  const [{ count: totalTrades }, { data: tickerData }] = await Promise.all([
    supabaseAdmin
      .from('congress_trades')
      .select('id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('congress_trades')
      .select('ticker')
      .limit(10000),
  ])

  const uniqueTickers = tickerData
    ? new Set(tickerData.map((r) => r.ticker.toUpperCase())).size
    : 0

  return { totalTrades: totalTrades ?? 0, uniqueTickers }
}

/**
 * Generate RSS search URLs from trades using transaction-specific URL templates.
 * Sale trades (Sale, Sale (Partial), Sale (Full)) use saleTemplate.
 * Purchase trades use purchaseTemplate.
 * Trades that are neither sale nor purchase are skipped.
 * Injects after:/before: date params into the Google News q= parameter
 * to limit results to the max_age_days window.
 */
function generateFeedUrls(
  trades: TradeWithCompanyName[],
  saleTemplate: string,
  purchaseTemplate: string,
  maxAgeDays?: number
): { trade: TradeWithCompanyName; url: string }[] {
  // Build date filter string for Google News q= param
  let dateFilter = ''
  if (maxAgeDays && maxAgeDays > 0) {
    const now = new Date()
    const after = new Date(now)
    after.setDate(after.getDate() - maxAgeDays)
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const afterStr = after.toISOString().split('T')[0]
    const beforeStr = tomorrow.toISOString().split('T')[0]
    dateFilter = `+after:${afterStr}+before:${beforeStr}`
  }

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
    // Replace placeholders: {company_name} (quoted or unquoted) and {ticker}
    const url = template
      .replace(
        '%22{company_name}%22',
        '%22' + encodeURIComponent(trade.company_name) + '%22' + dateFilter
      )
      .replace('{company_name}', encodeURIComponent(trade.company_name) + dateFilter)
      .replace('{ticker}', encodeURIComponent(trade.ticker) + dateFilter)
    entries.push({ trade, url })
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
    if (item.tradeMeta?.ticker) categories.push({ name: `ticker:${item.tradeMeta.ticker}` })
    if (item.tradeMeta?.name) categories.push({ name: `member:${item.tradeMeta.name}` })
    if (item.tradeMeta?.transaction) categories.push({ name: `transaction:${item.tradeMeta.transaction}` })

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
      image: item.tradeImageUrl || undefined,
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
    .select('max_trades, sale_url_template, purchase_url_template, secondary_sale_url_template, secondary_purchase_url_template, min_posts_per_trade, secondary_templates_enabled, max_age_days, trade_freshness_days, max_trades_per_member')
    .limit(1)
    .single()

  const maxTrades = settings?.max_trades ?? 21
  const saleTemplate = settings?.sale_url_template || ''
  const purchaseTemplate = settings?.purchase_url_template || ''
  const secondarySaleTemplate = settings?.secondary_sale_url_template || ''
  const secondaryPurchaseTemplate = settings?.secondary_purchase_url_template || ''
  const minPostsPerTrade = settings?.min_posts_per_trade ?? 20
  const secondaryTemplatesEnabled = settings?.secondary_templates_enabled ?? true
  const maxAgeDays = settings?.max_age_days ?? 7
  const tradeFreshnessDays = settings?.trade_freshness_days ?? 7
  const maxTradesPerMember = settings?.max_trades_per_member ?? 5

  // 2. Load approved source domains
  const { data: approvedRows } = await supabaseAdmin
    .from('congress_approved_sources')
    .select('source_domain')
    .eq('is_active', true)

  const approvedDomains = new Set(
    (approvedRows || []).map((r: { source_domain: string }) => r.source_domain.toLowerCase().replace(/^www\./, ''))
  )

  // 3. Load excluded keywords
  const { data: excludedKeywordRows } = await supabaseAdmin
    .from('combined_feed_excluded_keywords')
    .select('keyword')

  const excludedKeywords = (excludedKeywordRows || []).map((r: { keyword: string }) => r.keyword.toLowerCase())

  // 4. Get top trades and resolve names (filtered by freshness + per-member limit)
  const trades = await getTopTrades(maxTrades, tradeFreshnessDays, maxTradesPerMember)

  const tradesWithNames = await resolveTickerNames(trades)

  // 4b. Generate trade card images for trades missing image_url
  // Uses resolved company names from ticker_company_names table
  const TRADE_IMAGE_DELAY_MS = 300
  let imagesGenerated = 0
  for (let i = 0; i < tradesWithNames.length; i++) {
    const trade = tradesWithNames[i]
    if (trade.image_url) continue // already generated

    if (i > 0 && imagesGenerated > 0) {
      await new Promise((r) => setTimeout(r, TRADE_IMAGE_DELAY_MS))
    }

    try {
      const imageUrl = await generateAndUploadTradeImage({
        ...trade,
        company: trade.company_name,
      })
      if (imageUrl) {
        trade.image_url = imageUrl
        imagesGenerated++
      }
    } catch (error) {
      console.error(`[RSS-Combiner] Failed to generate image for trade ${trade.id}:`, error)
    }
  }

  if (imagesGenerated > 0) {
    console.log(`[RSS-Combiner] Generated ${imagesGenerated} trade card images`)
  }
  const feedEntries = generateFeedUrls(tradesWithNames, saleTemplate, purchaseTemplate, maxAgeDays)

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

        // Log first item structure for debugging (once per ingestion run)
        if (i === 0 && items.length > 0) {
          const sample = items[0]
          console.log(`[RSS-Combiner] Sample item structure:`, JSON.stringify({
            source: sample.source,
            link: typeof sample.link === 'string' ? sample.link.substring(0, 80) : sample.link,
            title: typeof sample.title === 'string' ? sample.title.substring(0, 60) : sample.title,
          }))
        }

        for (const item of items) {
          const sourceName = extractSourceName(item)
          const sourceDomain = extractSourceDomain(item)
          const title = item.title || 'Untitled'
          const link = item.link || ''
          const pubDate = item.pubDate ? new Date(item.pubDate) : new Date()

          // Filter: approved sources only
          if (!sourceDomain || !approvedDomains.has(sourceDomain.toLowerCase())) {
            articlesFiltered++
            if (feedsFetched === 0 && articlesFiltered <= 3) {
              console.log(`[RSS-Combiner] Filtered: domain="${sourceDomain}" name="${sourceName}" title="${title.substring(0, 50)}"`)
            }
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

  // 7. Secondary fetch pass — for trades below min_posts_per_trade threshold
  const hasSecondaryTemplates = secondarySaleTemplate || secondaryPurchaseTemplate
  if (hasSecondaryTemplates && secondaryTemplatesEnabled && tradesWithNames.length > 0) {
    // Count existing approved articles per ticker
    const tradeTickers = Array.from(new Set(tradesWithNames.map(t => t.ticker)))
    const articlesPerTrade = new Map<string, number>()

    for (const ticker of tradeTickers) {
      const { count } = await supabaseAdmin
        .from('congress_feed_articles')
        .select('id', { count: 'exact', head: true })
        .eq('ticker', ticker)

      articlesPerTrade.set(ticker, count ?? 0)
    }

    // Find trades below threshold
    const tradesToRetry = tradesWithNames.filter(t => {
      const count = articlesPerTrade.get(t.ticker) ?? 0
      return count < minPostsPerTrade
    })

    if (tradesToRetry.length > 0) {
      console.log(`[RSS-Combiner] Secondary fetch: ${tradesToRetry.length} trades below threshold (min_posts_per_trade=${minPostsPerTrade})`)
      for (const t of tradesToRetry) {
        console.log(`[RSS-Combiner]   ${t.ticker} (${t.company_name}): ${articlesPerTrade.get(t.ticker) ?? 0} articles`)
      }

      const secondaryEntries = generateFeedUrls(tradesToRetry, secondarySaleTemplate, secondaryPurchaseTemplate, maxAgeDays)
      let secondaryStored = 0

      for (let i = 0; i < secondaryEntries.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, DELAY_MS))

        const { trade, url } = secondaryEntries[i]
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

              if (!sourceDomain || !approvedDomains.has(sourceDomain.toLowerCase())) {
                articlesFiltered++
                continue
              }
              const titleLower = title.toLowerCase()
              if (excludedKeywords.some((kw) => titleLower.includes(kw))) {
                articlesFiltered++
                continue
              }
              if (pubDate < cutoff) {
                articlesFiltered++
                continue
              }
              if (!link) {
                articlesFiltered++
                continue
              }

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
                  console.error(`[RSS-Combiner] Secondary upsert failed for ${link}:`, error.message)
                }
              } else {
                storedForTrade++
                secondaryStored++
                articlesStored++
              }
            }

            feedsFetched++
            console.log(`[RSS-Combiner] Secondary ${trade.ticker} (${trade.company_name}): ${storedForTrade} stored, ${items.length - storedForTrade} filtered/skipped`)
            lastError = ''
            break
          } catch (err: any) {
            lastError = err.message
          }
        }

        if (lastError) {
          feedsFailed++
          console.error(`[RSS-Combiner] Secondary ${trade.ticker} failed: ${lastError}`)
        }
      }

      console.log(`[RSS-Combiner] Secondary fetch complete: ${secondaryStored} additional articles stored`)
    } else {
      console.log(`[RSS-Combiner] All trades meet threshold (min_posts_per_trade=${minPostsPerTrade}), skipping secondary fetch`)
    }
  }

  // 8. Update last_ingestion_at
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
    .select('cache_ttl_minutes, feed_title, feed_article_age_days, min_articles_per_company')
    .limit(1)
    .single()

  const cacheTtlMs = (settings?.cache_ttl_minutes ?? 15) * 60 * 1000

  // Return cached if fresh
  if (!forceRefresh && cachedXml && cachedAt && Date.now() - cachedAt < cacheTtlMs) {
    return cachedXml
  }

  const feedArticleAgeDays = settings?.feed_article_age_days ?? 14
  const minArticlesPerCompany = settings?.min_articles_per_company ?? 2
  const feedTitle = settings?.feed_title ?? 'Combined RSS Feed'

  const ARTICLE_COLUMNS = 'article_title, article_url, article_description, source_name, source_domain, published_at, ticker, company_name, transaction_type, trade_meta'
  const MAX_WINDOW = 90

  // Load approved sources to filter output
  const { data: approvedRows } = await supabaseAdmin
    .from('congress_approved_sources')
    .select('source_domain')
    .eq('is_active', true)

  const approvedDomains = new Set(
    (approvedRows || []).map((r: { source_domain: string }) => r.source_domain.toLowerCase().replace(/^www\./, ''))
  )

  // Expand article age window by 5 days until each company has enough articles
  let windowDays = feedArticleAgeDays
  let articles: any[] = []

  while (windowDays <= MAX_WINDOW) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - windowDays)

    const { data, error } = await supabaseAdmin
      .from('congress_feed_articles')
      .select(ARTICLE_COLUMNS)
      .gte('published_at', cutoffDate.toISOString())
      .order('published_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('[RSS-Combiner] Failed to query articles:', error.message)
      throw new Error('Failed to query stored articles')
    }

    // Filter to only approved sources
    articles = (data || []).filter((row: any) => {
      const domain = (row.source_domain || '').toLowerCase().replace(/^www\./, '')
      return domain && approvedDomains.has(domain)
    })

    // Check if every company has at least minArticlesPerCompany
    if (minArticlesPerCompany > 0 && articles.length > 0) {
      const companyCounts = new Map<string, number>()
      for (const row of articles) {
        const key = (row.ticker || '').toUpperCase()
        companyCounts.set(key, (companyCounts.get(key) ?? 0) + 1)
      }

      let allMet = true
      companyCounts.forEach((count) => {
        if (count < minArticlesPerCompany) allMet = false
      })

      if (allMet || windowDays >= MAX_WINDOW) {
        console.log(`[RSS-Combiner] Feed articles: ${windowDays}-day window → ${articles.length} articles across ${companyCounts.size} companies`)
        break
      }
    } else {
      break
    }

    windowDays += 5
  }

  // Load trade image URLs keyed by ticker
  const articleTickers = Array.from(new Set(articles.map((r: any) => r.ticker).filter(Boolean)))
  const tradeImageMap = new Map<string, string>()

  if (articleTickers.length > 0) {
    const { data: tradeImages } = await supabaseAdmin
      .from('congress_trades')
      .select('ticker, image_url')
      .in('ticker', articleTickers)
      .not('image_url', 'is', null)

    for (const row of tradeImages || []) {
      if (row.image_url) {
        tradeImageMap.set(row.ticker.toUpperCase(), row.image_url)
      }
    }
  }

  // Convert DB rows to NormalizedItem format
  const items: NormalizedItem[] = articles.map((row) => ({
    title: row.article_title,
    link: row.article_url,
    description: row.article_description || '',
    pubDate: new Date(row.published_at),
    author: '',
    sourceLabel: row.company_name,
    sourceName: row.source_name || '',
    guid: row.article_url,
    tradeImageUrl: tradeImageMap.get((row.ticker || '').toUpperCase()) || null,
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

export interface ActivationResult {
  activated: boolean
  rowsCopied: number
  reason?: string
}

/**
 * Move staged trades to the live congress_trades table.
 * Steps: count staged → delete live → copy staged to live (paginated) → clear staged → update settings.
 */
export async function activateStagedUpload(): Promise<ActivationResult> {
  // Check if there's staged data
  const { count } = await supabaseAdmin
    .from('congress_trades_staged')
    .select('id', { count: 'exact', head: true })

  if (!count || count === 0) {
    return { activated: false, rowsCopied: 0, reason: 'no_staged_data' }
  }

  console.log(`[RSS-Combiner] Activating ${count} staged trades`)

  // Delete all live trades
  const { error: deleteError } = await supabaseAdmin
    .from('congress_trades')
    .delete()
    .gte('id', '00000000-0000-0000-0000-000000000000')

  if (deleteError) {
    console.error('[RSS-Combiner] Failed to clear live trades:', deleteError.message)
    return { activated: false, rowsCopied: 0, reason: 'delete_failed' }
  }

  // Copy staged to live in batches
  const BATCH_SIZE = 1000
  let offset = 0
  let totalCopied = 0

  while (true) {
    const { data: batch, error: fetchError } = await supabaseAdmin
      .from('congress_trades_staged')
      .select('ticker, ticker_type, company, traded, filed, transaction, trade_size_usd, trade_size_parsed, name, party, district, chamber, state, capitol_trades_url, quiver_upload_time')
      .range(offset, offset + BATCH_SIZE - 1)

    if (fetchError) {
      console.error(`[RSS-Combiner] Failed to fetch staged batch at offset ${offset}:`, fetchError.message)
      break
    }

    if (!batch || batch.length === 0) break

    const { error: insertError } = await supabaseAdmin
      .from('congress_trades')
      .insert(batch)

    if (insertError) {
      console.error(`[RSS-Combiner] Failed to insert batch at offset ${offset}:`, insertError.message)
    } else {
      totalCopied += batch.length
    }

    if (batch.length < BATCH_SIZE) break
    offset += BATCH_SIZE
  }

  // Clear staging table
  await supabaseAdmin
    .from('congress_trades_staged')
    .delete()
    .gte('id', '00000000-0000-0000-0000-000000000000')

  // Update settings: record activation time, clear staged_upload_at
  await supabaseAdmin
    .from('combined_feed_settings')
    .update({
      last_activation_at: new Date().toISOString(),
      staged_upload_at: null,
      updated_at: new Date().toISOString(),
    })
    .not('id', 'is', null)

  invalidateCache()
  invalidateTradesCache()

  console.log(`[RSS-Combiner] Activation complete: ${totalCopied} trades copied to live`)

  return { activated: true, rowsCopied: totalCopied }
}

/**
 * Check if the scheduled activation time has passed and activate staged data if so.
 * Schedule is day-of-week + time in America/Chicago timezone.
 */
export async function checkAndActivateSchedule(): Promise<ActivationResult> {
  const { data: settings } = await supabaseAdmin
    .from('combined_feed_settings')
    .select('upload_schedule_day, upload_schedule_time, staged_upload_at, last_activation_at')
    .limit(1)
    .single()

  if (!settings?.staged_upload_at) {
    return { activated: false, rowsCopied: 0, reason: 'no_staged_data' }
  }

  const scheduleDay = settings.upload_schedule_day ?? 2 // Tuesday
  const scheduleTime = settings.upload_schedule_time ?? '09:00'
  const [scheduleHour, scheduleMinute] = scheduleTime.split(':').map(Number)

  // Get current time in America/Chicago
  const nowCT = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
  )
  const nowDow = nowCT.getDay() // 0=Sunday

  // Find the most recent scheduled activation time
  // Go back up to 7 days to find the last occurrence of scheduleDay
  let daysBack = (nowDow - scheduleDay + 7) % 7
  const scheduledDate = new Date(nowCT)
  scheduledDate.setDate(scheduledDate.getDate() - daysBack)
  scheduledDate.setHours(scheduleHour, scheduleMinute, 0, 0)

  // If the scheduled time is in the future (same day but later), go back a week
  if (scheduledDate > nowCT) {
    scheduledDate.setDate(scheduledDate.getDate() - 7)
  }

  const stagedAt = new Date(settings.staged_upload_at)
  const lastActivatedAt = settings.last_activation_at ? new Date(settings.last_activation_at) : null

  // Activate if:
  // 1. Data was staged before the scheduled time
  // 2. We haven't already activated since the scheduled time
  const scheduledTimeMs = scheduledDate.getTime()
  const alreadyActivated = lastActivatedAt && lastActivatedAt.getTime() >= scheduledTimeMs
  const stagedBeforeSchedule = stagedAt.getTime() < scheduledTimeMs
  const nowPastSchedule = nowCT.getTime() >= scheduledTimeMs

  if (nowPastSchedule && stagedBeforeSchedule && !alreadyActivated) {
    console.log(`[RSS-Combiner] Scheduled activation triggered (schedule: ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][scheduleDay]} ${scheduleTime} CT)`)
    return activateStagedUpload()
  }

  return { activated: false, rowsCopied: 0, reason: 'not_time_yet' }
}

export function invalidateCache(): void {
  cachedXml = null
  cachedAt = null
}

export function invalidateTradesCache(): void {
  cachedTradesResponse = null
}

export function getCachedTradesResponse(): { trades: any[]; stats: any } | null {
  return cachedTradesResponse
}

export function setCachedTradesResponse(data: { trades: any[]; stats: any }): void {
  cachedTradesResponse = data
}
