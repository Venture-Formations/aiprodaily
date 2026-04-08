import * as XLSX from 'xlsx'
import type { Tab } from './types'

export const COLUMN_MAP: Record<string, string> = {
  ticker: 'ticker',
  'ticker type': 'ticker_type',
  company: 'company',
  traded: 'traded',
  filed: 'filed',
  transaction: 'transaction',
  'trade size usd': 'trade_size_usd',
  'trade size (usd)': 'trade_size_usd',
  name: 'name',
  party: 'party',
  district: 'district',
  chamber: 'chamber',
  state: 'state',
  'capitol trades url': 'capitol_trades_url',
  'quiver upload time': 'quiver_upload_time',
  quiveruploadtime: 'quiver_upload_time',
}

export function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/_/g, ' ')
}

export function parseExcelDate(val: any): string | null {
  if (!val) return null
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val)
    if (date) {
      const y = date.y
      const m = String(date.m).padStart(2, '0')
      const d = String(date.d).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
  }
  if (typeof val === 'string') {
    const d = new Date(val)
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
  }
  return null
}

export const TABS: { key: Tab; label: string }[] = [
  { key: 'trades', label: 'Trades' },
  { key: 'ticker-db', label: 'Ticker Database' },
  { key: 'excluded-companies', label: 'Excluded Companies' },
  { key: 'approved-sources', label: 'Approved Sources' },
  { key: 'excluded-keywords', label: 'Excluded Keywords' },
  { key: 'settings', label: 'Settings' },
]

export const TICKERS_PER_PAGE = 200

export const DEFAULT_EDIT_SETTINGS = {
  max_age_days: 7,
  cache_ttl_minutes: 15,
  feed_title: 'Combined RSS Feed',
  url_template: '',
  sale_url_template: '',
  purchase_url_template: '',
  max_trades: 21,
  upload_schedule_day: 2,
  upload_schedule_time: '09:00',
  trade_freshness_days: 7,
  max_trades_per_member: 5,
  feed_article_age_days: 14,
  min_articles_per_company: 2,
  secondary_sale_url_template: '',
  secondary_purchase_url_template: '',
  min_posts_per_trade: 20,
  secondary_templates_enabled: true,
}
