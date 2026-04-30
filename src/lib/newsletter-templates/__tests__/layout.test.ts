// src/lib/newsletter-templates/__tests__/layout.test.ts
import { describe, it, expect, vi } from 'vitest'
import { makeBusinessSettings } from './_fixtures'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [] }),
    }),
  },
}))

vi.mock('@/lib/publication-settings', () => ({
  getBusinessSettings: vi.fn(),
}))

vi.mock('@/lib/bot-detection', () => ({
  HONEYPOT_CONFIG: { SECTION_NAME: 'Honeypot' },
}))

vi.mock('@/lib/config', () => ({
  STORAGE_PUBLIC_URL: 'https://test.storage',
}))

import { generateNewsletterHeader, generateNewsletterFooter } from '../layout'

describe('generateNewsletterHeader', () => {
  it('includes the formatted date in the body', async () => {
    const html = await generateNewsletterHeader(
      'Wednesday, April 29, 2026',
      '2026-04-29',
      'ml-1',
      'pub-1',
      makeBusinessSettings()
    )
    expect(html).toContain('Wednesday, April 29, 2026')
  })

  it('renders headerImageUrl when present', async () => {
    const html = await generateNewsletterHeader(
      'date',
      '2026-04-29',
      'ml-1',
      'pub-1',
      makeBusinessSettings({ headerImageUrl: 'https://test.example.com/banner.png' })
    )
    expect(html).toContain('https://test.example.com/banner.png')
  })

  it('falls back to newsletterName text banner when headerImageUrl is empty', async () => {
    const html = await generateNewsletterHeader(
      'date',
      '2026-04-29',
      'ml-1',
      'pub-1',
      makeBusinessSettings({ headerImageUrl: '', newsletterName: 'Fallback Name' })
    )
    expect(html).not.toContain('<img alt="Fallback Name"')
    expect(html).toContain('>Fallback Name<')
  })

  it('emits hidden preheader div when preheaderText provided', async () => {
    const html = await generateNewsletterHeader(
      'date',
      '2026-04-29',
      'ml-1',
      'pub-1',
      makeBusinessSettings(),
      'Tomorrow: AI for accountants — what changed this week.'
    )
    expect(html).toContain('Tomorrow: AI for accountants')
    expect(html).toContain('display:none;font-size:1px')
  })

  it('omits preheader div when preheaderText is empty/undefined', async () => {
    const html = await generateNewsletterHeader(
      'date',
      '2026-04-29',
      'ml-1',
      'pub-1',
      makeBusinessSettings()
    )
    expect(html).not.toContain('display:none;font-size:1px')
  })

  it('wraps Sign Up link with tracking when issueDate provided', async () => {
    const html = await generateNewsletterHeader(
      'date',
      '2026-04-29',
      'ml-1',
      'pub-1',
      makeBusinessSettings({ websiteUrl: 'https://test.example.com' })
    )
    expect(html).toContain('/api/link-tracking/click?')
  })
})

describe('generateNewsletterFooter', () => {
  it('renders only enabled social icons', async () => {
    const html = await generateNewsletterFooter(
      '2026-04-29',
      'ml-1',
      'pub-1',
      makeBusinessSettings({
        facebookEnabled: true,
        facebookUrl: 'https://fb.test/x',
        twitterEnabled: false,
        twitterUrl: 'https://tw.test/x',
        linkedinEnabled: true,
        linkedinUrl: 'https://li.test/x',
      })
    )
    expect(html).toContain('alt="Facebook"')
    expect(html).toContain('alt="LinkedIn"')
    expect(html).not.toContain('alt="Twitter/X"')
    expect(html).not.toContain('alt="Instagram"')
  })

  it('omits the social section entirely when no icons are enabled', async () => {
    const html = await generateNewsletterFooter(
      '2026-04-29',
      'ml-1',
      'pub-1',
      makeBusinessSettings() // all *Enabled false by default
    )
    expect(html).not.toContain('alt="Facebook"')
    expect(html).not.toContain('alt="Twitter/X"')
  })

  it('embeds honeypot link inside the address comma', async () => {
    const html = await generateNewsletterFooter(
      '2026-04-29',
      'ml-1',
      'pub-1',
      makeBusinessSettings()
    )
    // Honeypot is wrapped in an <a> on the comma after "Saint Joseph".
    // Look for the linked-comma pattern.
    expect(html).toMatch(/Saint Joseph<a [^>]*>,<\/a>/)
  })

  it('includes unsubscribe link with email merge tag', async () => {
    const html = await generateNewsletterFooter(
      '2026-04-29',
      'ml-1',
      'pub-1',
      makeBusinessSettings()
    )
    expect(html).toContain('Unsubscribe')
    expect(html).toContain('{$email}')
  })

  it('includes current year in copyright', async () => {
    const year = new Date().getFullYear()
    const html = await generateNewsletterFooter(
      '2026-04-29',
      'ml-1',
      'pub-1',
      makeBusinessSettings()
    )
    expect(html).toContain(`©${year}`)
  })
})
