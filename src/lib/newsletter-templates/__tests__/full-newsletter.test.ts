// src/lib/newsletter-templates/__tests__/full-newsletter.test.ts
import { describe, it, expect, vi } from 'vitest'
import { makeSnapshot, makeBusinessSettings, makeIssue } from './_fixtures'

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
  getBusinessSettings: vi.fn().mockResolvedValue({}),
}))
vi.mock('@/lib/bot-detection', () => ({ HONEYPOT_CONFIG: { SECTION_NAME: 'Honeypot' } }))
vi.mock('@/lib/config', () => ({ STORAGE_PUBLIC_URL: 'https://test.storage' }))

import { renderNewsletterFromSnapshot } from '../full-newsletter'

describe('renderNewsletterFromSnapshot', () => {
  it('composes a non-empty HTML document for an empty snapshot', async () => {
    const html = await renderNewsletterFromSnapshot(makeSnapshot())
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('</html>')
    // Header date must appear
    expect(html).toContain('Wednesday, April 29, 2026')
  })

  it('omits the review banner when isReview is false', async () => {
    const html = await renderNewsletterFromSnapshot(makeSnapshot({ isReview: false }))
    expect(html).not.toContain('Newsletter Review')
  })

  it('includes the review banner when isReview is true', async () => {
    const html = await renderNewsletterFromSnapshot(makeSnapshot({ isReview: true }))
    expect(html).toContain('Newsletter Review')
    expect(html).toContain('preview of tomorrow')
  })

  it('returns header + footer only when sortedSections is empty', async () => {
    const html = await renderNewsletterFromSnapshot(makeSnapshot())
    // No section content between header and footer — just whitespace/structure.
    // Both must exist.
    expect(html).toContain('View Online')   // header
    expect(html).toContain('Unsubscribe')   // footer
  })

  it('rejects with prefixed error when an internal generator throws', async () => {
    const broken = makeSnapshot({
      // Pass a snapshot where issue is missing required fields to trigger downstream error
      issue: undefined as any,
    })
    await expect(renderNewsletterFromSnapshot(broken)).rejects.toThrow(/HTML generation failed/)
  })
})
