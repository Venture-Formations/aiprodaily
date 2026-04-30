// src/lib/newsletter-templates/__tests__/sections.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeBusinessSettings, makeIssue } from './_fixtures'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
    }),
  },
}))

vi.mock('@/lib/poll-modules', () => ({
  PollModuleSelector: { getIssuePollSelections: vi.fn().mockResolvedValue([]) },
  PollModuleRenderer: { renderPollModule: vi.fn().mockResolvedValue({ html: '<poll/>' }) },
}))

vi.mock('@/lib/ai-app-modules', () => ({
  AppModuleSelector: { getIssueSelections: vi.fn().mockResolvedValue([]) },
  AppModuleRenderer: { renderModule: vi.fn().mockResolvedValue({ html: '<ai/>', moduleName: 'm', appCount: 0 }) },
}))

vi.mock('@/lib/prompt-modules', () => ({
  PromptModuleSelector: { getIssuePromptSelections: vi.fn().mockResolvedValue([]) },
  PromptModuleRenderer: { renderPromptModule: vi.fn().mockResolvedValue({ html: '<prompt/>' }) },
}))

vi.mock('@/lib/text-box-modules', () => ({
  TextBoxModuleSelector: { getIssueSelections: vi.fn().mockResolvedValue([]) },
  TextBoxModuleRenderer: { renderModule: vi.fn().mockResolvedValue({ html: '<tb/>' }) },
}))

vi.mock('@/lib/feedback-modules', () => ({
  FeedbackModuleSelector: { getFeedbackModuleWithBlocks: vi.fn().mockResolvedValue(null) },
  FeedbackModuleRenderer: { renderFeedbackModule: vi.fn().mockResolvedValue({ html: '<fb/>' }) },
}))

vi.mock('@/lib/sparkloop-rec-modules', () => ({
  SparkLoopRecModuleSelector: { getIssueSelections: vi.fn().mockResolvedValue({ selections: [] }) },
  SparkLoopRecModuleRenderer: { renderSection: vi.fn(() => '<slr/>') },
}))

import {
  generateWelcomeSection,
  generatePollSection,
  generateBreakingNewsSection,
  generateBeyondTheFeedSection,
  generateLocalEventsSection,
  generateWordleSection,
  generateMinnesotaGetawaysSection,
  generateRoadWorkSection,
  generatePollModulesSection,
  generateAIAppsSection,
  generatePromptModulesSection,
  generateTextBoxModuleSection,
  generateFeedbackModuleSection,
  generateSparkLoopRecModuleSection,
} from '../sections'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateWelcomeSection', () => {
  it('returns empty string when intro, tagline, and summary are all blank', async () => {
    expect(await generateWelcomeSection(null, null, null, 'pub-1', makeBusinessSettings())).toBe('')
    expect(await generateWelcomeSection('', '   ', '', 'pub-1', makeBusinessSettings())).toBe('')
  })

  it('always includes the personalized greeting merge tag', async () => {
    const html = await generateWelcomeSection('Welcome back', null, null, 'pub-1', makeBusinessSettings())
    expect(html).toContain(`{$name|default('Accounting Pro')}`)
  })

  it('uses bodyFont from business settings, never hardcoded', async () => {
    const html = await generateWelcomeSection('Welcome', null, null, 'pub-1', makeBusinessSettings({ bodyFont: 'CustomFont, sans-serif' }))
    expect(html).toContain('CustomFont, sans-serif')
  })

  // NOTE: sections.ts:27-34 computes a `fullIntro` variable but never uses it —
  // the `intro` argument is silently dropped from rendered output. This test
  // characterizes that current (buggy) behavior so we'd notice if it changed.
  // TODO: file follow-up issue to fix the dead code in generateWelcomeSection.
  it('renders greeting, tagline, and summary (intro arg currently unused — see source bug)', async () => {
    const html = await generateWelcomeSection(
      'Hello there',
      'The bold tagline',
      'A short summary.',
      'pub-1',
      makeBusinessSettings()
    )
    expect(html).toContain('The bold tagline')
    expect(html).toContain('A short summary.')
    expect(html).toContain(`{$name|default('Accounting Pro')}`)
    expect(html).not.toContain('Hello there')
  })
})

describe('generateBreakingNewsSection', () => {
  it('returns empty string when breakingNewsArticles is empty', async () => {
    const html = await generateBreakingNewsSection(makeIssue(), makeBusinessSettings(), [])
    expect(html).toBe('')
  })

  it('renders title with tracked URL using "Breaking News" as section name', async () => {
    const selections = [{
      post: { id: 'p1', ai_title: null, title: 'Headline One', ai_summary: null, description: 'Summary one', source_url: 'https://news.test/1' },
    }]
    const html = await generateBreakingNewsSection(makeIssue(), makeBusinessSettings(), selections)
    expect(html).toContain('Headline One')
    expect(html).toContain('Summary one')
    expect(html).toContain('/api/link-tracking/click?')
    // URLSearchParams encodes spaces as '+', so 'Breaking News' → 'Breaking+News'
    expect(html).toContain('Breaking+News')
  })

  it('prefers ai_title and ai_summary over original when present', async () => {
    const selections = [{
      post: { id: 'p1', ai_title: 'AI Headline', title: 'Original Headline', ai_summary: 'AI summary', description: 'Original desc', source_url: 'https://x.test' },
    }]
    const html = await generateBreakingNewsSection(makeIssue(), makeBusinessSettings(), selections)
    expect(html).toContain('AI Headline')
    expect(html).toContain('AI summary')
    expect(html).not.toContain('Original Headline')
  })
})

describe('generateBeyondTheFeedSection', () => {
  it('returns empty string when beyondFeedArticles is empty', async () => {
    const html = await generateBeyondTheFeedSection(makeIssue(), makeBusinessSettings(), [])
    expect(html).toBe('')
  })

  it('uses "Beyond the Feed" as the tracked section name', async () => {
    const selections = [{
      post: { id: 'p1', ai_title: 'A', title: 'A', ai_summary: 'B', description: 'B', source_url: 'https://x.test' },
    }]
    const html = await generateBeyondTheFeedSection(makeIssue(), makeBusinessSettings(), selections)
    // URLSearchParams encodes spaces as '+', so 'Beyond the Feed' → 'Beyond+the+Feed'
    expect(html).toContain('Beyond+the+Feed')
  })
})

describe('generatePollSection', () => {
  it('returns empty string when sent issue has no poll_id', async () => {
    const html = await generatePollSection(
      { id: 'i1', publication_id: 'p1', status: 'sent', poll_id: null },
      makeBusinessSettings()
    )
    expect(html).toBe('')
  })

  it('returns empty string when DB returns no active poll for draft', async () => {
    // Default mock single() returns { data: null }
    const html = await generatePollSection(
      { id: 'i1', publication_id: 'p1', status: 'draft' },
      makeBusinessSettings()
    )
    expect(html).toBe('')
  })
})

describe('stub sections (disabled features)', () => {
  it('all return empty strings', async () => {
    const issue = makeIssue()
    expect(await generateLocalEventsSection(issue)).toBe('')
    expect(await generateWordleSection(issue)).toBe('')
    expect(await generateMinnesotaGetawaysSection(issue)).toBe('')
    expect(await generateRoadWorkSection(issue)).toBe('')
  })
})

describe('module-delegate sections — empty-state', () => {
  it('generatePollModulesSection returns "" when no selection matches moduleId', async () => {
    const html = await generatePollModulesSection(
      { id: 'i1', publication_id: 'p1' },
      'mod-poll-x',
      makeBusinessSettings(),
      [] // empty selections
    )
    expect(html).toBe('')
  })

  it('generateAIAppsSection returns "" when aiAppSelections is empty', async () => {
    const html = await generateAIAppsSection(makeIssue(), makeBusinessSettings(), [])
    expect(html).toBe('')
  })

  it('generatePromptModulesSection returns "" when promptSelections is empty', async () => {
    const html = await generatePromptModulesSection(
      { id: 'i1', publication_id: 'p1' },
      'mod-prompt-x',
      makeBusinessSettings(),
      []
    )
    expect(html).toBe('')
  })

  it('generateTextBoxModuleSection returns "" when textBoxSelections is empty', async () => {
    const html = await generateTextBoxModuleSection(
      { id: 'i1', publication_id: 'p1' },
      'mod-tb-x',
      makeBusinessSettings(),
      []
    )
    expect(html).toBe('')
  })

  it('generateFeedbackModuleSection returns "" when feedbackModule is null', async () => {
    const html = await generateFeedbackModuleSection(
      { id: 'i1', publication_id: 'p1' },
      'mod-fb-x',
      makeBusinessSettings(),
      null
    )
    expect(html).toBe('')
  })

  it('generateSparkLoopRecModuleSection returns "" when selections empty', async () => {
    const html = await generateSparkLoopRecModuleSection(
      { id: 'i1', publication_id: 'p1' },
      'mod-slr-x',
      makeBusinessSettings(),
      []
    )
    expect(html).toBe('')
  })
})
