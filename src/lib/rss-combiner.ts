import Parser from 'rss-parser'
import { Feed } from 'feed'
import { supabaseAdmin } from '@/lib/supabase'

const parser = new Parser({
  customFields: {
    item: ['media:content', 'enclosure', 'source'],
  },
})

interface FeedSource {
  id: string
  url: string
  label: string
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
}

// Module-level cache
let cachedXml: string | null = null
let cachedAt: number | null = null

/**
 * Extract the publisher/source name from an RSS item.
 * Google News RSS includes <source>Publisher Name</source>.
 * Falls back to parsing "Title - Source" pattern from the title.
 */
function extractSourceName(item: any): string {
  // rss-parser captures <source> element text
  if (item.source && typeof item.source === 'string') {
    return item.source
  }
  // Some feeds use source as an object with $ attrs and _ text
  if (item.source?._) {
    return item.source._
  }
  // Fallback: Google News titles are "Article Title - Publisher Name"
  const title = item.title || ''
  const dashIdx = title.lastIndexOf(' - ')
  if (dashIdx > 0) {
    return title.substring(dashIdx + 3).trim()
  }
  return ''
}

export async function fetchAndCombineFeeds(
  sources: FeedSource[],
  maxAgeDays: number,
  excludedSources: Set<string> = new Set()
): Promise<NormalizedItem[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - maxAgeDays)

  // Lowercase excluded sources for case-insensitive matching
  const excludedLower = new Set(
    Array.from(excludedSources).map((s) => s.toLowerCase())
  )

  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const feed = await parser.parseURL(source.url)
      return feed.items.map((item) => ({
        title: item.title || 'Untitled',
        link: item.link || '',
        description: item.contentSnippet || item.content || '',
        pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
        author: item.creator || (item as any).author || '',
        sourceLabel: source.label || new URL(source.url).hostname,
        sourceName: extractSourceName(item),
        guid: item.guid || item.link || `${source.url}#${item.title}`,
      }))
    })
  )

  const items: NormalizedItem[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      items.push(...result.value)
    } else {
      console.error('[RSS-Combiner] Feed fetch failed:', result.reason?.message || result.reason)
    }
  }

  return items
    .filter((item) => item.pubDate >= cutoff)
    .filter((item) => !item.sourceName || !excludedLower.has(item.sourceName.toLowerCase()))
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
}

export function generateCombinedFeedXml(
  items: NormalizedItem[],
  feedTitle: string
): string {
  const feed = new Feed({
    title: feedTitle,
    description: 'Combined RSS feed from multiple sources',
    id: 'combined-rss-feed',
    link: 'https://aiprodaily.com',
    copyright: '',
    updated: items.length > 0 ? items[0].pubDate : new Date(),
    generator: 'AIProDaily RSS Combiner',
  })

  for (const item of items) {
    feed.addItem({
      title: item.title,
      id: item.guid,
      link: item.link,
      description: item.description,
      date: item.pubDate,
      author: item.author ? [{ name: item.author }] : undefined,
      category: [
        ...(item.sourceLabel ? [{ name: item.sourceLabel }] : []),
        ...(item.sourceName ? [{ name: `source:${item.sourceName}` }] : []),
      ],
    })
  }

  return feed.rss2()
}

export async function getCombinedFeed(forceRefresh = false): Promise<string> {
  // Load settings
  const { data: settings } = await supabaseAdmin
    .from('combined_feed_settings')
    .select('max_age_days, cache_ttl_minutes, feed_title')
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

  // Fetch active, non-excluded feed sources
  const { data: sources } = await supabaseAdmin
    .from('combined_feed_sources')
    .select('id, url, label')
    .eq('is_active', true)
    .eq('is_excluded', false)
    .order('label')

  // Fetch excluded article sources (publisher names)
  const { data: excludedRows } = await supabaseAdmin
    .from('combined_feed_excluded_sources')
    .select('source_name')

  const excludedSources = new Set(
    (excludedRows || []).map((r) => r.source_name)
  )

  if (!sources || sources.length === 0) {
    const emptyFeed = generateCombinedFeedXml(
      [],
      settings?.feed_title ?? 'Combined RSS Feed'
    )
    cachedXml = emptyFeed
    cachedAt = Date.now()
    return emptyFeed
  }

  const items = await fetchAndCombineFeeds(
    sources,
    settings?.max_age_days ?? 7,
    excludedSources
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
