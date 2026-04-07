import type { ArticleModule, ModuleArticle, ArticleSelectionMode } from '@/types/database'

export interface ArticleModulesPanelProps {
  issueId: string
  issueStatus?: string
}

export interface CriteriaConfig {
  id: string
  name: string
  weight: number
  criteria_number: number
}

export interface ModuleWithCriteria extends ArticleModule {
  criteria?: CriteriaConfig[]
}

export interface ArticleSelection {
  id: string
  issue_id: string
  article_module_id: string
  article_ids: string[]
  selection_mode?: ArticleSelectionMode
  selected_at?: string
  used_at?: string
  article_module?: ArticleModule
  articles?: ModuleArticle[]
}

export interface ArticleWithRssPost extends ModuleArticle {
  rss_post?: {
    id?: string
    title?: string
    source_url?: string
    image_url?: string
    author?: string
    rss_feed?: { name?: string }
    post_ratings?: Array<{
      total_score: number
      criteria_1_score?: number
      criteria_2_score?: number
      criteria_3_score?: number
      criteria_4_score?: number
      criteria_5_score?: number
    }>
  }
}

export const SELECTION_MODE_LABELS: Record<ArticleSelectionMode, string> = {
  top_score: 'Top Score',
  manual: 'Manual'
}
