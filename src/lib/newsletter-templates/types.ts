// Shared types for the newsletter rendering system

export interface BusinessSettings {
  primaryColor: string
  secondaryColor: string
  tertiaryColor: string
  quaternaryColor: string
  headingFont: string
  bodyFont: string
  websiteUrl: string
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
}
