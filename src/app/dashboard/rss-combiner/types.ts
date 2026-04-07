export type Tab = 'trades' | 'ticker-db' | 'excluded-companies' | 'approved-sources' | 'excluded-keywords' | 'settings'

export interface TradeRow {
  id: string
  ticker: string
  company_name: string
  traded: string
  transaction: string | null
  trade_size_usd: string | null
  trade_size_parsed: number
  name: string | null
  party: string | null
  chamber: string | null
  state: string | null
  district: string | null
}

export interface TradeStats {
  totalTrades: number
  uniqueTickers: number
  selectedForFeed: number
}

export interface TickerMapping {
  id: string
  ticker: string
  company_name: string
  created_at: string
}

export interface ExcludedCompany {
  id: string
  ticker: string
  company_name: string | null
  created_at: string
}

export interface ExcludedKeyword {
  id: string
  keyword: string
  created_at: string
}

export interface ApprovedSource {
  id: string
  source_name: string
  source_domain: string
  is_active: boolean
  created_at: string
}

export interface IngestionStats {
  feedsFetched: number
  feedsFailed: number
  articlesStored: number
  articlesFiltered: number
  articlesSkippedDuplicate: number
}

export interface FeedSettings {
  id: string
  max_age_days: number
  cache_ttl_minutes: number
  feed_title: string
  url_template: string
  sale_url_template: string | null
  purchase_url_template: string | null
  max_trades: number
  last_ingestion_at: string | null
  updated_at: string
  upload_schedule_day: number
  upload_schedule_time: string
  staged_upload_at: string | null
  last_activation_at: string | null
  trade_freshness_days: number
  max_trades_per_member: number
  feed_article_age_days: number
  min_articles_per_company: number
}

export interface StagingStatus {
  count: number
  staged_upload_at: string | null
  upload_schedule_day: number
  upload_schedule_time: string
}

export interface EditSettings {
  max_age_days: number
  cache_ttl_minutes: number
  feed_title: string
  url_template: string
  sale_url_template: string
  purchase_url_template: string
  max_trades: number
  upload_schedule_day: number
  upload_schedule_time: string
  trade_freshness_days: number
  max_trades_per_member: number
  feed_article_age_days: number
  min_articles_per_company: number
}
