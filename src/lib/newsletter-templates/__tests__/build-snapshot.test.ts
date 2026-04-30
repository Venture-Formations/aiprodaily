// src/lib/newsletter-templates/__tests__/build-snapshot.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeIssue } from './_fixtures'

// ---- Mock supabaseAdmin so each `from(table)` returns a query builder
// whose final await resolves to whatever this file dictates per-table.
const tableData: Record<string, any[]> = {}

vi.mock('@/lib/supabase', () => {
  const builder = (table: string) => {
    const result = { data: tableData[table] ?? [], error: null }
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => Promise.resolve(result)),
      // Some callers use .limit(...).maybeSingle() — not used by build-snapshot itself,
      // but provide for safety.
      limit: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve(result)),
      maybeSingle: vi.fn(() => Promise.resolve(result)),
      then: (resolve: any) => Promise.resolve(result).then(resolve),
    }
    return chain
  }
  return {
    supabaseAdmin: { from: vi.fn((t: string) => builder(t)) },
  }
})

// fetchBusinessSettings is called inside buildIssueSnapshot — short-circuit it.
vi.mock('../helpers', async () => {
  const actual = await vi.importActual<typeof import('../helpers')>('../helpers')
  return {
    ...actual,
    fetchBusinessSettings: vi.fn().mockResolvedValue({
      primaryColor: '#000', secondaryColor: '#000', tertiaryColor: '#000', quaternaryColor: '#000',
      headingFont: 'A', bodyFont: 'A',
      websiteUrl: 'https://test', headerImageUrl: '', newsletterName: 'N', businessName: 'B',
      facebookEnabled: false, facebookUrl: '', twitterEnabled: false, twitterUrl: '',
      linkedinEnabled: false, linkedinUrl: '', instagramEnabled: false, instagramUrl: '',
    }),
  }
})

// All dynamic selector imports — return empty by default.
vi.mock('@/lib/poll-modules', () => ({
  PollModuleSelector: { getIssuePollSelections: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@/lib/ai-app-modules', () => ({
  AppModuleSelector: { getIssueSelections: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@/lib/text-box-modules', () => ({
  TextBoxModuleSelector: { getIssueSelections: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@/lib/feedback-modules', () => ({
  FeedbackModuleSelector: { getFeedbackModuleWithBlocks: vi.fn().mockResolvedValue(null) },
}))
vi.mock('@/lib/sparkloop-rec-modules', () => ({
  SparkLoopRecModuleSelector: { getIssueSelections: vi.fn().mockResolvedValue({ selections: [] }) },
}))

import { buildIssueSnapshot } from '../build-snapshot'

beforeEach(() => {
  // Reset all per-table data
  for (const k of Object.keys(tableData)) delete tableData[k]
})

describe('buildIssueSnapshot', () => {
  it('returns a fully-shaped snapshot with empty arrays by default', async () => {
    const snapshot = await buildIssueSnapshot(makeIssue())
    expect(snapshot.issue.id).toBe('issue-test-1')
    expect(snapshot.formattedDate).toContain('April') // "Wednesday, April 29, 2026"
    expect(snapshot.sortedSections).toEqual([])
    expect(snapshot.pollSelections).toEqual([])
    expect(snapshot.aiAppSelections).toEqual([])
    expect(snapshot.textBoxSelections).toEqual([])
    expect(snapshot.feedbackModule).toBeNull()
    expect(snapshot.sparkloopRecSelections).toEqual([])
    expect(snapshot.adSelections).toEqual([])
    expect(snapshot.articlesByModule).toEqual({})
    expect(snapshot.isReview).toBe(false)
  })
})

describe('buildIssueSnapshot — sortedSections', () => {
  it('merges all module types into one list sorted by display_order', async () => {
    tableData['newsletter_sections'] = [{ id: 'sec-3', name: 'Top', display_order: 30, is_active: true, section_type: 'breaking_news' }]
    tableData['ad_modules'] = [{ id: 'ad-1', name: 'AdMod', display_order: 10, is_active: true }]
    tableData['poll_modules'] = [{ id: 'poll-1', name: 'PollMod', display_order: 20, is_active: true }]
    tableData['prompt_modules'] = []
    tableData['article_modules'] = []
    tableData['text_box_modules'] = []
    tableData['sparkloop_rec_modules'] = []
    tableData['feedback_modules'] = []

    const snap = await buildIssueSnapshot(makeIssue())
    expect(snap.sortedSections.map(s => s.data.id)).toEqual(['ad-1', 'poll-1', 'sec-3'])
    expect(snap.sortedSections.map(s => s.type)).toEqual(['ad_module', 'poll_module', 'section'])
  })

  it('filters out legacy primary_articles and secondary_articles section types', async () => {
    tableData['newsletter_sections'] = [
      { id: 'old1', name: 'P', display_order: 1, is_active: true, section_type: 'primary_articles' },
      { id: 'old2', name: 'S', display_order: 2, is_active: true, section_type: 'secondary_articles' },
      { id: 'keep', name: 'BN', display_order: 3, is_active: true, section_type: 'breaking_news' },
    ]
    tableData['ad_modules'] = []
    tableData['poll_modules'] = []
    tableData['prompt_modules'] = []
    tableData['article_modules'] = []
    tableData['text_box_modules'] = []
    tableData['sparkloop_rec_modules'] = []
    tableData['feedback_modules'] = []

    const snap = await buildIssueSnapshot(makeIssue())
    expect(snap.sortedSections.map(s => s.data.id)).toEqual(['keep'])
  })
})

describe('buildIssueSnapshot — preheaderText', () => {
  it('prefers welcome_summary over subject_line', async () => {
    const snap = await buildIssueSnapshot(makeIssue({ welcome_summary: 'Welcome line', subject_line: 'Subject line' }))
    expect(snap.preheaderText).toBe('Welcome line')
  })

  it('falls back to subject_line when welcome_summary is empty', async () => {
    const snap = await buildIssueSnapshot(makeIssue({ welcome_summary: null, subject_line: 'Subject line' }))
    expect(snap.preheaderText).toBe('Subject line')
  })

  it('truncates preheader to 120 chars', async () => {
    const long = 'A'.repeat(200)
    const snap = await buildIssueSnapshot(makeIssue({ welcome_summary: long }))
    expect(snap.preheaderText).toHaveLength(120)
  })

  it('returns empty string when both fields are empty', async () => {
    const snap = await buildIssueSnapshot(makeIssue({ welcome_summary: '', subject_line: '' }))
    expect(snap.preheaderText).toBe('')
  })
})

describe('buildIssueSnapshot — isReview flag', () => {
  it('respects isReview option (default false)', async () => {
    expect((await buildIssueSnapshot(makeIssue())).isReview).toBe(false)
    expect((await buildIssueSnapshot(makeIssue(), { isReview: true })).isReview).toBe(true)
  })
})
