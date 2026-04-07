export interface ScoredPost {
  id: string
  originalTitle: string
  originalDescription: string
  originalFullText: string
  publicationDate: string
  author: string
  sourceUrl: string
  sourceName: string
  imageUrl: string
  feedType: string
  feedName: string
  ingestDate: string
  criteria1Score: number | null
  criteria1Weight: number
  criteria1Reasoning: string
  criteria1Name: string
  criteria1Enabled: boolean
  criteria2Score: number | null
  criteria2Weight: number
  criteria2Reasoning: string
  criteria2Name: string
  criteria2Enabled: boolean
  criteria3Score: number | null
  criteria3Weight: number
  criteria3Reasoning: string
  criteria3Name: string
  criteria3Enabled: boolean
  criteria4Score: number | null
  criteria4Weight: number
  criteria4Reasoning: string
  criteria4Name: string
  criteria4Enabled: boolean
  criteria5Score: number | null
  criteria5Weight: number
  criteria5Reasoning: string
  criteria5Name: string
  criteria5Enabled: boolean
  totalScore: number | null
  finalPosition: number | null
}

export interface Column {
  key: string
  label: string
  enabled: boolean
  exportable: boolean
  width?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}

export interface ArticlesTabProps {
  slug: string
  excludeIps?: boolean
}

export type DatePreset = '7d' | '30d' | '90d' | 'custom'
