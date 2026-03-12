import Parser from 'rss-parser'
import { Feed } from 'feed'
import { supabaseAdmin } from '@/lib/supabase'

const parser = new Parser({
  customFields: {
    item: ['media:content', 'enclosure'],
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
  guid: string
}

// Module-level cache
let cachedXml: string | null = null
let cachedAt: number | null = null

export async function fetchAndCombineFeeds(
  sources: FeedSource[],
  maxAgeDays: number
): Promise<NormalizedItem[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - maxAgeDays)

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
      category: item.sourceLabel ? [{ name: item.sourceLabel }] : undefined,
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

  // Fetch active, non-excluded sources
  const { data: sources } = await supabaseAdmin
    .from('combined_feed_sources')
    .select('id, url, label')
    .eq('is_active', true)
    .eq('is_excluded', false)
    .order('label')

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
    settings?.max_age_days ?? 7
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
