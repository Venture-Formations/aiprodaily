// src/lib/newsletter-templates/__tests__/ads.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeBusinessSettings, makeIssue, makeAdvertisement } from './_fixtures'

// Mock Supabase + the ad-modules renderer (used by generateAdModulesSection)
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    }),
  },
}))

vi.mock('@/lib/ad-modules', () => ({
  AdModuleRenderer: {
    renderForArchive: vi.fn(() => '<div class="ad-mock">AD HTML</div>'),
  },
}))

vi.mock('@/lib/html-normalizer', () => ({
  normalizeEmailHtml: vi.fn((html: string) => html), // pass-through
}))

import {
  generateAdvertorialHtml,
  generateAdvertorialSection,
  generateAdModulesSection,
  generateDiningDealsSection,
} from '../ads'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateAdvertorialHtml (pure renderer)', () => {
  const baseStyle = {
    primaryColor: '#1877F2',
    headingFont: 'Georgia, serif',
    bodyFont: 'Arial, sans-serif',
  }

  it('renders title and body', () => {
    const html = generateAdvertorialHtml(
      { title: 'Buy Our Thing', body: '<p>It is great</p>', button_url: 'https://x.test' },
      baseStyle
    )
    expect(html).toContain('Buy Our Thing')
    expect(html).toContain('<p>It is great</p>')
  })

  it('omits image row when image_url is missing', () => {
    const html = generateAdvertorialHtml(
      { title: 'No Image Ad', body: 'body', button_url: '#' },
      baseStyle
    )
    expect(html).not.toContain('<img ')
  })

  it('renders image with sanitized alt when image_url present', () => {
    // sanitizeAltText strips quotes entirely: Has "quotes" → Has quotes
    const html = generateAdvertorialHtml(
      {
        title: 'Headline',
        body: 'body',
        button_url: 'https://x.test',
        image_url: 'https://test.example.com/x.png',
        image_alt: `Has "quotes"`,
      },
      baseStyle
    )
    expect(html).toContain('https://test.example.com/x.png')
    expect(html).toContain("alt='Has quotes'")
  })

  it('escapes special chars in cta_text', () => {
    const html = generateAdvertorialHtml(
      {
        title: 'T',
        body: 'b',
        button_url: 'https://x.test',
        cta_text: '<script>alert(1)</script>',
      },
      baseStyle
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('omits CTA row when button_url is "#" (no destination)', () => {
    const html = generateAdvertorialHtml(
      { title: 'T', body: 'b', button_url: '#', cta_text: 'Click me' },
      baseStyle
    )
    // CTA only renders when buttonUrl !== '#'. The link wrapping the CTA shouldn't be there.
    expect(html).not.toMatch(/<a[^>]*>Click me<\/a>/)
  })

  it('uses sectionName in header (defaults to "Advertorial")', () => {
    const def = generateAdvertorialHtml(
      { title: 't', body: 'b', button_url: '#' },
      baseStyle
    )
    expect(def).toContain('>Advertorial<')

    const named = generateAdvertorialHtml(
      { title: 't', body: 'b', button_url: '#' },
      { ...baseStyle, sectionName: 'Sponsored' }
    )
    expect(named).toContain('>Sponsored<')
  })
})

describe('generateAdvertorialSection (DB-fallback path)', () => {
  it('returns empty string when no ad selected', async () => {
    // Default mock returns { data: null } from maybeSingle
    const html = await generateAdvertorialSection(makeIssue(), false, 'Advertorial', makeBusinessSettings())
    expect(html).toBe('')
  })
})

describe('generateAdModulesSection', () => {
  it('returns empty string when adSelections is empty array', async () => {
    const html = await generateAdModulesSection(
      makeIssue(),
      'mod-ad-1',
      makeBusinessSettings(),
      [] // pre-fetched, empty
    )
    expect(html).toBe('')
  })

  it('filters pre-fetched selections by moduleId', async () => {
    const adSelections = [
      { ad_module: { id: 'mod-ad-1', name: 'Module A', display_order: 1, block_order: ['title', 'body'] }, advertisement: makeAdvertisement() },
      { ad_module: { id: 'mod-ad-2', name: 'Module B', display_order: 2, block_order: ['title'] }, advertisement: makeAdvertisement({ title: 'Other Ad' }) },
    ]
    const html = await generateAdModulesSection(
      makeIssue(),
      'mod-ad-1',
      makeBusinessSettings(),
      adSelections
    )
    // Mock returns '<div class="ad-mock">AD HTML</div>' once per matching selection.
    expect(html).toBe('<div class="ad-mock">AD HTML</div>')
  })

  it('passes a tracked URL (not raw) to the renderer', async () => {
    const { AdModuleRenderer } = await import('@/lib/ad-modules')
    const adSelections = [
      { ad_module: { id: 'mod-ad-1', name: 'Module A', display_order: 1, block_order: ['title'] }, advertisement: makeAdvertisement({ button_url: 'https://sponsor.example.com' }) },
    ]
    await generateAdModulesSection(makeIssue(), 'mod-ad-1', makeBusinessSettings(), adSelections)
    const callArg = vi.mocked(AdModuleRenderer.renderForArchive).mock.calls[0][1]
    expect(callArg.button_url).toContain('/api/link-tracking/click?')
  })
})

describe('generateDiningDealsSection (stub)', () => {
  it('always returns empty string', async () => {
    expect(await generateDiningDealsSection(makeIssue())).toBe('')
  })
})
