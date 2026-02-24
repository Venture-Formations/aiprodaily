// Shared types for the newsletter rendering system

export interface BusinessSettings {
  primaryColor: string
  secondaryColor: string
  tertiaryColor: string
  quaternaryColor: string
  headingFont: string
  bodyFont: string
  websiteUrl: string
  // Header fields
  headerImageUrl: string
  newsletterName: string
  // Footer fields
  businessName: string
  facebookEnabled: boolean
  facebookUrl: string
  twitterEnabled: boolean
  twitterUrl: string
  linkedinEnabled: boolean
  linkedinUrl: string
  instagramEnabled: boolean
  instagramUrl: string
}

export interface ModuleConfig {
  id: string
  name: string
  display_order: number
  is_active: boolean
  [key: string]: any
}

export type SectionItemType =
  | 'section'
  | 'ad_module'
  | 'poll_module'
  | 'prompt_module'
  | 'article_module'
  | 'text_box_module'
  | 'feedback_module'
  | 'sparkloop_rec_module'

export interface SectionItem {
  type: SectionItemType
  data: ModuleConfig
}

export interface IssueSnapshot {
  issue: any
  formattedDate: string
  businessSettings: BusinessSettings
  sortedSections: SectionItem[]
  isReview: boolean

  // Pre-fetched content (Phase 2.3 — near-zero DB calls during render)
  pollSelections: any[]
  promptSelections: any[]
  aiAppSelections: any[]
  textBoxSelections: any[]
  feedbackModule: any | null
  sparkloopRecSelections: any[]
  adSelections: any[]
  articlesByModule: Record<string, any[]>
  breakingNewsArticles: any[]
  beyondFeedArticles: any[]
}
