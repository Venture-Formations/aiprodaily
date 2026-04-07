import type { Recommendation } from '../../types'

export type { Recommendation }

export interface GlobalStats {
  uniqueIps: number
  avgOffersSelected: number
}

export interface Column {
  key: string
  label: string
  enabled: boolean
  exportable: boolean
  width?: 'xs' | 'sm' | 'md' | 'lg'
}

export interface Defaults {
  cr: number
  rcr: number
  minConversionsBudget: number
}

export interface DetailedTabProps {
  recommendations: Recommendation[]
  globalStats: GlobalStats | null
  defaults: Defaults
  loading: boolean
  onRefresh: () => void
}

export interface DateRangeMetrics {
  impressions: number
  confirmed_impressions: number
  submissions: number
  confirms: number
  rejections: number
  pending: number
  page_impressions: number
  confirmed_page_impressions: number
  page_submissions: number
}

export interface RangeStats {
  uniqueIps: number
  avgOffersSelected: number
  avgValuePerSubscriber?: number
  uniqueSubscribers?: number
  uniqueSends?: number
}

export type StatusFilter = 'all' | 'active' | 'excluded' | 'paused' | 'archived'
