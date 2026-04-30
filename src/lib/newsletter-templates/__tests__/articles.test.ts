// src/lib/newsletter-templates/__tests__/articles.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeBusinessSettings, makeIssue, makeArticle, makeArticleModule } from './_fixtures'

// Mock Supabase before importing the SUT — articles.ts imports supabaseAdmin at top.
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
    }),
  },
}))

import { generateArticleModuleSection } from '../articles'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateArticleModuleSection', () => {
  it('returns empty string when moduleArticles is empty', async () => {
    const html = await generateArticleModuleSection(
      makeIssue(),
      'mod-art-1',
      false,
      makeBusinessSettings(),
      [], // empty articles
      makeArticleModule()
    )
    expect(html).toBe('')
  })

  it('returns empty string when moduleConfig is missing and DB returns null', async () => {
    const html = await generateArticleModuleSection(
      makeIssue(),
      'unknown-module-id',
      false,
      makeBusinessSettings()
      // moduleArticles, moduleConfig both undefined → falls back to mocked DB → null
    )
    expect(html).toBe('')
  })
})

describe('generateArticleModuleSection — content rendering', () => {
  it('renders headline and body, wraps source URL with tracking', async () => {
    const article = makeArticle({
      headline: 'Major AI release',
      content: 'Big news today.',
      rss_post: { source_url: 'https://news.example.com/post-1', image_url: null, image_alt: null },
    })
    const html = await generateArticleModuleSection(
      makeIssue(),
      'mod-art-1',
      false,
      makeBusinessSettings(),
      [article],
      makeArticleModule({ block_order: ['title', 'body'] })
    )
    expect(html).toContain('Major AI release')
    expect(html).toContain('Big news today.')
    // Tracked URL prefix from wrapTrackingUrl
    expect(html).toContain('/api/link-tracking/click?')
    // Original URL is encoded as the `url` query param
    expect(html).toContain(encodeURIComponent('https://news.example.com/post-1'))
  })

  it('uses bodyFont from settings, never hardcoded', async () => {
    const article = makeArticle()
    const html = await generateArticleModuleSection(
      makeIssue(),
      'mod-art-1',
      false,
      makeBusinessSettings({ bodyFont: 'CustomFont, sans-serif' }),
      [article],
      makeArticleModule()
    )
    expect(html).toContain('CustomFont, sans-serif')
  })

  it('renders trade_image when block_order includes trade_image and trade_image_url is set', async () => {
    const article = makeArticle({
      trade_image_url: 'https://test.example.com/trade.png',
      trade_image_alt: 'Trade graphic',
    })
    const html = await generateArticleModuleSection(
      makeIssue(),
      'mod-art-1',
      false,
      makeBusinessSettings(),
      [article],
      makeArticleModule({ block_order: ['trade_image', 'title', 'body'] })
    )
    expect(html).toContain('https://test.example.com/trade.png')
    expect(html).toContain('alt="Trade graphic"')
  })

  it('sanitizes alt text — strips quotes from headline-derived alt', async () => {
    const article = makeArticle({
      headline: `It's a "great" headline`,
      ai_image_url: 'https://test.example.com/ai.png',
      image_alt: null,
    })
    const html = await generateArticleModuleSection(
      makeIssue(),
      'mod-art-1',
      false,
      makeBusinessSettings(),
      [article],
      makeArticleModule({ block_order: ['ai_image', 'title'] })
    )
    // sanitizeAltText strips both ' and " — quoted form should NOT appear in alt attribute
    expect(html).not.toContain(`alt="It's a "great" headline"`)
    expect(html).toContain('alt="Its a great headline"')
  })

  it('hides module name header when show_name is false', async () => {
    const article = makeArticle()
    const html = await generateArticleModuleSection(
      makeIssue(),
      'mod-art-1',
      false,
      makeBusinessSettings(),
      [article],
      makeArticleModule({ name: 'Hidden Module', show_name: false })
    )
    expect(html).not.toContain('Hidden Module')
  })

  it('appends unsubscribe link when includeUnsubscribeLink=true', async () => {
    const article = makeArticle()
    const html = await generateArticleModuleSection(
      makeIssue(),
      'mod-art-1',
      true, // includeUnsubscribeLink
      makeBusinessSettings(),
      [article],
      makeArticleModule()
    )
    expect(html).toContain('{$unsubscribe}')
    expect(html).toContain('unsubscribe')
  })
})
