// src/lib/newsletter-templates/__tests__/_fixtures.ts
import type { BusinessSettings, IssueSnapshot, SectionItem } from '../types'

export function makeBusinessSettings(overrides: Partial<BusinessSettings> = {}): BusinessSettings {
  return {
    primaryColor: '#1877F2',
    secondaryColor: '#10B981',
    tertiaryColor: '#F59E0B',
    quaternaryColor: '#8B5CF6',
    headingFont: 'Georgia, serif',
    bodyFont: 'Arial, sans-serif',
    websiteUrl: 'https://test.example.com',
    headerImageUrl: 'https://test.example.com/header.png',
    newsletterName: 'Test Newsletter',
    businessName: 'Test Business',
    facebookEnabled: false,
    facebookUrl: '',
    twitterEnabled: false,
    twitterUrl: '',
    linkedinEnabled: false,
    linkedinUrl: '',
    instagramEnabled: false,
    instagramUrl: '',
    ...overrides,
  }
}

export function makeIssue(overrides: Record<string, any> = {}) {
  return {
    id: 'issue-test-1',
    publication_id: 'pub-test-1',
    date: '2026-04-29',
    mailerlite_issue_id: 'ml-1234',
    status: 'draft',
    welcome_summary: null,
    subject_line: null,
    poll_id: null,
    module_articles: [],
    ...overrides,
  }
}

export function makeArticle(overrides: Record<string, any> = {}) {
  return {
    id: 'art-1',
    headline: 'Test Headline',
    content: 'Body content here.',
    is_active: true,
    rank: 1,
    ai_image_url: null,
    image_alt: null,
    trade_image_url: null,
    trade_image_alt: null,
    article_module_id: 'mod-art-1',
    rss_post: { source_url: 'https://source.example.com/article', image_url: null, image_alt: null },
    ...overrides,
  }
}

export function makeArticleModule(overrides: Record<string, any> = {}) {
  return {
    id: 'mod-art-1',
    publication_id: 'pub-test-1',
    name: 'Top Stories',
    display_order: 10,
    is_active: true,
    show_name: true,
    block_order: ['title', 'body'],
    config: {},
    ...overrides,
  }
}

export function makeAdvertisement(overrides: Record<string, any> = {}) {
  return {
    id: 'ad-1',
    title: 'Sponsor Title',
    body: '<p>Sponsor body.</p>',
    image_url: 'https://test.example.com/ad.png',
    image_alt: 'Sponsor image',
    button_text: 'Learn more',
    button_url: 'https://sponsor.example.com',
    cta_text: 'Click here →',
    company_name: 'SponsorCo',
    ...overrides,
  }
}

export function makeSnapshot(overrides: Partial<IssueSnapshot> = {}): IssueSnapshot {
  return {
    issue: makeIssue(),
    formattedDate: 'Wednesday, April 29, 2026',
    businessSettings: makeBusinessSettings(),
    sortedSections: [] as SectionItem[],
    isReview: false,
    preheaderText: '',
    pollSelections: [],
    promptSelections: [],
    aiAppSelections: [],
    textBoxSelections: [],
    feedbackModule: null,
    sparkloopRecSelections: [],
    adSelections: [],
    articlesByModule: {},
    breakingNewsArticles: [],
    beyondFeedArticles: [],
    ...overrides,
  }
}
