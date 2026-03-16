'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Layout from '@/components/Layout'
import * as XLSX from 'xlsx'

type Tab = 'trades' | 'ticker-db' | 'excluded-companies' | 'excluded-sources' | 'excluded-keywords' | 'settings'

interface TradeRow {
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

interface TradeStats {
  totalTrades: number
  uniqueTickers: number
  selectedForFeed: number
}

interface TickerMapping {
  id: string
  ticker: string
  company_name: string
  created_at: string
}

interface ExcludedCompany {
  id: string
  ticker: string
  company_name: string | null
  created_at: string
}

interface ExcludedSource {
  id: string
  source_name: string
  created_at: string
}

interface ExcludedKeyword {
  id: string
  keyword: string
  created_at: string
}

interface FeedSettings {
  id: string
  max_age_days: number
  cache_ttl_minutes: number
  feed_title: string
  url_template: string
  sale_url_template: string | null
  purchase_url_template: string | null
  max_trades: number
  max_articles_per_trade: number
  updated_at: string
}

// Column header mapping for XLSX parsing (client-side)
const COLUMN_MAP: Record<string, string> = {
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
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/_/g, ' ')
}

function parseExcelDate(val: any): string | null {
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

const TABS: { key: Tab; label: string }[] = [
  { key: 'trades', label: 'Trades' },
  { key: 'ticker-db', label: 'Ticker Database' },
  { key: 'excluded-companies', label: 'Excluded Companies' },
  { key: 'excluded-sources', label: 'Excluded Sources' },
  { key: 'excluded-keywords', label: 'Excluded Keywords' },
  { key: 'settings', label: 'Settings' },
]

export default function RSSCombinerPage() {
  const [activeTab, setActiveTab] = useState<Tab>('trades')

  // Trades state
  const [trades, setTrades] = useState<TradeRow[]>([])
  const [tradeStats, setTradeStats] = useState<TradeStats | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [uploadProgress, setUploadProgress] = useState('')

  // Settings state
  const [settings, setSettings] = useState<FeedSettings | null>(null)
  const [editSettings, setEditSettings] = useState({
    max_age_days: 7,
    cache_ttl_minutes: 15,
    feed_title: 'Combined RSS Feed',
    url_template: '',
    sale_url_template: '',
    purchase_url_template: '',
    max_trades: 21,
    max_articles_per_trade: 5,
  })
  const [savingSettings, setSavingSettings] = useState(false)

  // Ticker DB state
  const [tickers, setTickers] = useState<TickerMapping[]>([])
  const [tickerSearch, setTickerSearch] = useState('')
  const [tickerPage, setTickerPage] = useState(0)
  const TICKERS_PER_PAGE = 200
  const [newTicker, setNewTicker] = useState('')
  const [newTickerName, setNewTickerName] = useState('')
  const [editingTickerId, setEditingTickerId] = useState<string | null>(null)
  const [editTickerName, setEditTickerName] = useState('')
  const [tickerUploading, setTickerUploading] = useState(false)
  const [tickerUploadResult, setTickerUploadResult] = useState<any>(null)

  // Excluded companies state
  const [excludedCompanies, setExcludedCompanies] = useState<ExcludedCompany[]>([])
  const [newExcludedTicker, setNewExcludedTicker] = useState('')
  const [newExcludedCompanyName, setNewExcludedCompanyName] = useState('')
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null)
  const [editCompanyTicker, setEditCompanyTicker] = useState('')
  const [editCompanyName, setEditCompanyName] = useState('')

  // Excluded sources state
  const [excludedSources, setExcludedSources] = useState<ExcludedSource[]>([])
  const [newExcludedSource, setNewExcludedSource] = useState('')
  const [knownSources, setKnownSources] = useState<string[]>([])
  const [loadingKnownSources, setLoadingKnownSources] = useState(false)
  const [showSourceDropdown, setShowSourceDropdown] = useState(false)
  const sourceInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Excluded keywords state
  const [excludedKeywords, setExcludedKeywords] = useState<ExcludedKeyword[]>([])
  const [newKeyword, setNewKeyword] = useState('')

  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const fetchTrades = useCallback(async () => {
    const res = await fetch('/api/admin/rss-combiner/trades')
    if (res.ok) {
      const data = await res.json()
      setTrades(data.trades || [])
      setTradeStats(data.stats || null)
    }
  }, [])

  const fetchSettings = useCallback(async () => {
    const res = await fetch('/api/admin/rss-combiner/settings')
    if (res.ok) {
      const data = await res.json()
      const s = data.settings
      setSettings(s)
      if (s) {
        setEditSettings({
          max_age_days: s.max_age_days,
          cache_ttl_minutes: s.cache_ttl_minutes,
          feed_title: s.feed_title,
          url_template: s.url_template || '',
          sale_url_template: s.sale_url_template || '',
          purchase_url_template: s.purchase_url_template || '',
          max_trades: s.max_trades,
          max_articles_per_trade: s.max_articles_per_trade ?? 5,
        })
      }
    }
  }, [])

  const fetchTickers = useCallback(async () => {
    const res = await fetch('/api/admin/rss-combiner/ticker-db')
    if (res.ok) {
      const data = await res.json()
      setTickers(data.tickers || [])
    }
  }, [])

  const fetchExcludedCompanies = useCallback(async () => {
    const res = await fetch('/api/admin/rss-combiner/excluded-companies')
    if (res.ok) {
      const data = await res.json()
      setExcludedCompanies(data.companies || [])
    }
  }, [])

  const fetchExcludedSources = useCallback(async () => {
    const res = await fetch('/api/admin/rss-combiner/excluded-sources')
    if (res.ok) {
      const data = await res.json()
      setExcludedSources(data.excludedSources || [])
    }
  }, [])

  const fetchExcludedKeywords = useCallback(async () => {
    const res = await fetch('/api/admin/rss-combiner/excluded-keywords')
    if (res.ok) {
      const data = await res.json()
      setExcludedKeywords(data.keywords || [])
    }
  }, [])

  const fetchKnownSources = useCallback(async () => {
    setLoadingKnownSources(true)
    try {
      const res = await fetch('/api/admin/rss-combiner/known-sources')
      if (res.ok) {
        const data = await res.json()
        setKnownSources(data.sources || [])
      }
    } finally {
      setLoadingKnownSources(false)
    }
  }, [])

  useEffect(() => {
    Promise.all([
      fetchTrades(),
      fetchSettings(),
      fetchTickers(),
      fetchExcludedCompanies(),
      fetchExcludedSources(),
      fetchExcludedKeywords(),
    ]).finally(() => setLoading(false))
  }, [fetchTrades, fetchSettings, fetchTickers, fetchExcludedCompanies, fetchExcludedSources, fetchExcludedKeywords])

  // Fetch known sources when switching to excluded-sources tab
  useEffect(() => {
    if (activeTab === 'excluded-sources' && knownSources.length === 0) {
      fetchKnownSources()
    }
  }, [activeTab, knownSources.length, fetchKnownSources])

  // Close source dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        sourceInputRef.current &&
        !sourceInputRef.current.contains(e.target as Node)
      ) {
        setShowSourceDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // --- Upload Handlers ---

  const handleTradeUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement
    const file = fileInput?.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadResult(null)
    setUploadProgress('Reading XLSX file...')

    try {
      // Parse XLSX client-side
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) {
        setUploadResult({ error: 'No sheets found in workbook' })
        return
      }

      const sheet = workbook.Sheets[sheetName]
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      if (rows.length === 0) {
        setUploadResult({ error: 'No data rows found' })
        return
      }

      setUploadProgress(`Parsed ${rows.length.toLocaleString()} rows. Mapping columns...`)

      // Map columns
      const rawHeaders = Object.keys(rows[0])
      const colIndex: Record<string, string> = {}
      for (const h of rawHeaders) {
        const normalized = normalizeHeader(h)
        const dbCol = COLUMN_MAP[normalized]
        if (dbCol) colIndex[h] = dbCol
      }

      if (!Object.values(colIndex).includes('ticker') || !Object.values(colIndex).includes('traded')) {
        setUploadResult({ error: 'XLSX must have "Ticker" and "Traded" columns' })
        return
      }

      // Convert rows to trade objects
      const trades: any[] = []
      for (const row of rows) {
        const trade: Record<string, any> = {}
        for (const [rawHeader, dbCol] of Object.entries(colIndex)) {
          const val = row[rawHeader]
          if (dbCol === 'traded' || dbCol === 'filed') {
            trade[dbCol] = parseExcelDate(val)
          } else {
            trade[dbCol] = val != null ? String(val).trim() || null : null
          }
        }
        if (trade.ticker && trade.traded) {
          trades.push(trade)
        }
      }

      setUploadProgress(`Uploading ${trades.length.toLocaleString()} trades in batches...`)

      // Send as JSON in chunks (2K rows per request to stay under Vercel 4.5MB body limit)
      const CHUNK_SIZE = 2000
      let totalInserted = 0
      const allErrors: string[] = []

      for (let i = 0; i < trades.length; i += CHUNK_SIZE) {
        const chunk = trades.slice(i, i + CHUNK_SIZE)
        const batchNum = Math.floor(i / CHUNK_SIZE) + 1
        const totalBatches = Math.ceil(trades.length / CHUNK_SIZE)
        setUploadProgress(`Uploading batch ${batchNum} of ${totalBatches}...`)

        // First chunk truncates existing data, subsequent chunks append
        const res = await fetch('/api/admin/rss-combiner/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trades: chunk, append: i > 0 }),
        })

        const data = await res.json()
        if (res.ok) {
          totalInserted += data.inserted || 0
          if (data.errors?.length) allErrors.push(...data.errors)
        } else {
          allErrors.push(data.error || `Batch ${batchNum} failed`)
        }
      }

      setUploadResult({
        inserted: totalInserted,
        total: rows.length,
        uniqueTickers: new Set(trades.map((t: any) => t.ticker?.toUpperCase())).size,
        errors: allErrors.slice(0, 20),
      })
      fetchTrades()
      fileInput.value = ''
    } catch (err: any) {
      setUploadResult({ error: err.message || 'Upload failed' })
    } finally {
      setUploading(false)
      setUploadProgress('')
    }
  }

  const handleTickerCSVUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement
    const file = fileInput?.files?.[0]
    if (!file) return

    setTickerUploading(true)
    setTickerUploadResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/admin/rss-combiner/ticker-db/upload', { method: 'POST', body: formData })
      const data = await res.json()
      setTickerUploadResult(data)
      if (res.ok) {
        fetchTickers()
        fileInput.value = ''
      }
    } catch {
      setTickerUploadResult({ error: 'Upload failed' })
    } finally {
      setTickerUploading(false)
    }
  }

  // --- CRUD Handlers ---

  const handleAddTicker = async () => {
    if (!newTicker.trim() || !newTickerName.trim()) return
    const res = await fetch('/api/admin/rss-combiner/ticker-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: newTicker, company_name: newTickerName }),
    })
    if (res.ok) {
      fetchTickers()
      setNewTicker('')
      setNewTickerName('')
    }
  }

  const handleEditTicker = async (id: string) => {
    if (!editTickerName.trim()) return
    const ticker = tickers.find((t) => t.id === id)
    if (!ticker) return
    const res = await fetch('/api/admin/rss-combiner/ticker-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: ticker.ticker, company_name: editTickerName }),
    })
    if (res.ok) {
      fetchTickers()
      setEditingTickerId(null)
      setEditTickerName('')
    }
  }

  const handleDeleteTicker = async (id: string) => {
    const res = await fetch('/api/admin/rss-combiner/ticker-db', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setTickers((prev) => prev.filter((t) => t.id !== id))
  }

  const handleAddExcludedCompany = async () => {
    if (!newExcludedTicker.trim()) return
    const res = await fetch('/api/admin/rss-combiner/excluded-companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: newExcludedTicker, company_name: newExcludedCompanyName || undefined }),
    })
    if (res.ok) {
      const data = await res.json()
      setExcludedCompanies((prev) => [...prev, data.company])
      setNewExcludedTicker('')
      setNewExcludedCompanyName('')
    }
  }

  const handleEditExcludedCompany = async (id: string) => {
    if (!editCompanyTicker.trim()) return
    // Delete old, create new (since ticker is the unique key)
    const delRes = await fetch('/api/admin/rss-combiner/excluded-companies', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (delRes.ok) {
      const addRes = await fetch('/api/admin/rss-combiner/excluded-companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: editCompanyTicker, company_name: editCompanyName || undefined }),
      })
      if (addRes.ok) {
        fetchExcludedCompanies()
      }
    }
    setEditingCompanyId(null)
  }

  const handleDeleteExcludedCompany = async (id: string) => {
    const res = await fetch('/api/admin/rss-combiner/excluded-companies', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setExcludedCompanies((prev) => prev.filter((c) => c.id !== id))
  }

  const handleAddExcludedSource = async (sourceName?: string) => {
    const name = (sourceName || newExcludedSource).trim()
    if (!name) return
    const res = await fetch('/api/admin/rss-combiner/excluded-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_name: name }),
    })
    if (res.ok) {
      const data = await res.json()
      setExcludedSources((prev) => [...prev, data.excludedSource])
      setNewExcludedSource('')
      setShowSourceDropdown(false)
    }
  }

  const handleRemoveExcludedSource = async (id: string) => {
    const res = await fetch('/api/admin/rss-combiner/excluded-sources', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setExcludedSources((prev) => prev.filter((s) => s.id !== id))
  }

  const handleAddKeyword = async () => {
    const kw = newKeyword.trim()
    if (!kw) return
    const res = await fetch('/api/admin/rss-combiner/excluded-keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: kw }),
    })
    if (res.ok) {
      const data = await res.json()
      setExcludedKeywords((prev) => [...prev, data.keyword])
      setNewKeyword('')
    }
  }

  const handleDeleteKeyword = async (id: string) => {
    const res = await fetch('/api/admin/rss-combiner/excluded-keywords', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setExcludedKeywords((prev) => prev.filter((k) => k.id !== id))
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const res = await fetch('/api/admin/rss-combiner/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editSettings),
      })
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings)
      }
    } finally {
      setSavingSettings(false)
    }
  }

  const feedUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/feeds/combined`
    : '/api/feeds/combined'

  const handleCopy = () => {
    navigator.clipboard.writeText(feedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Filtered ticker list for search (reset page when search changes)
  const filteredTickers = tickerSearch
    ? tickers.filter(
        (t) =>
          t.ticker.toLowerCase().includes(tickerSearch.toLowerCase()) ||
          t.company_name.toLowerCase().includes(tickerSearch.toLowerCase())
      )
    : tickers

  const tickerTotalPages = Math.ceil(filteredTickers.length / TICKERS_PER_PAGE)
  const paginatedTickers = filteredTickers.slice(
    tickerPage * TICKERS_PER_PAGE,
    (tickerPage + 1) * TICKERS_PER_PAGE
  )

  // Filtered known sources for dropdown (exclude already-excluded ones)
  const excludedSourceNames = new Set(excludedSources.map((s) => s.source_name.toLowerCase()))
  const filteredKnownSources = knownSources
    .filter((s) => !excludedSourceNames.has(s.toLowerCase()))
    .filter((s) =>
      newExcludedSource ? s.toLowerCase().includes(newExcludedSource.toLowerCase()) : true
    )

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Congressional Trading RSS</h1>
          <p className="mt-1 text-sm text-gray-600">
            Upload congressional trade data to auto-generate news feeds for the highest-value trades.
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-6 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap pb-3 px-1 border-b-2 text-sm font-medium ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab: Trades */}
        {activeTab === 'trades' && (
          <div className="space-y-6">
            {tradeStats && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">{tradeStats.totalTrades.toLocaleString()}</div>
                  <div className="text-xs text-gray-500 mt-1">Total Trades</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{tradeStats.uniqueTickers}</div>
                  <div className="text-xs text-gray-500 mt-1">Unique Tickers</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{tradeStats.selectedForFeed}</div>
                  <div className="text-xs text-gray-500 mt-1">Selected for Feed</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="text-sm font-medium text-gray-700 mb-3">Upload XLSX</h2>
                <form onSubmit={handleTradeUpload}>
                  <input
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-3"
                  />
                  <button
                    type="submit"
                    disabled={uploading}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {uploading ? 'Uploading...' : 'Upload & Replace All Trades'}
                  </button>
                </form>
                <p className="mt-2 text-xs text-gray-500">
                  Expects congressional trading XLSX. File is parsed in browser then uploaded in batches.
                </p>

                {uploadProgress && (
                  <div className="mt-2 text-xs text-blue-600">{uploadProgress}</div>
                )}

                {uploadResult && (
                  <div className="mt-3 p-3 rounded bg-gray-50 text-sm">
                    {uploadResult.error ? (
                      <div className="text-red-600">{uploadResult.error}</div>
                    ) : (
                      <>
                        <div className="font-medium mb-1">
                          Upload complete: {uploadResult.inserted?.toLocaleString()} of {uploadResult.total?.toLocaleString()} rows inserted
                        </div>
                        <div className="text-blue-700">Unique tickers: {uploadResult.uniqueTickers}</div>
                        {uploadResult.errors?.length > 0 && (
                          <div className="mt-2 text-red-600 text-xs">
                            {uploadResult.errors.map((err: string, i: number) => (
                              <div key={i}>{err}</div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="text-sm font-medium text-gray-700 mb-3">Feed Generation</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Sale URL Template</label>
                    <input
                      type="text"
                      value={editSettings.sale_url_template}
                      onChange={(e) => setEditSettings({ ...editSettings, sale_url_template: e.target.value })}
                      placeholder="https://news.google.com/rss/search?q={company_name}+stock..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-mono"
                    />
                    <p className="text-xs text-gray-400 mt-1">For Sale, Sale (Partial), Sale (Full) transactions. Use {'{company_name}'} as placeholder.</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Purchase URL Template</label>
                    <input
                      type="text"
                      value={editSettings.purchase_url_template}
                      onChange={(e) => setEditSettings({ ...editSettings, purchase_url_template: e.target.value })}
                      placeholder="https://news.google.com/rss/search?q={company_name}+stock..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-mono"
                    />
                    <p className="text-xs text-gray-400 mt-1">For Purchase transactions. Use {'{company_name}'} as placeholder.</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Max Trades for Feed</label>
                    <input
                      type="number"
                      value={editSettings.max_trades}
                      onChange={(e) => setEditSettings({ ...editSettings, max_trades: parseInt(e.target.value) || 1 })}
                      min={1}
                      max={200}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Max Articles per Trade</label>
                    <input
                      type="number"
                      value={editSettings.max_articles_per_trade}
                      onChange={(e) => setEditSettings({ ...editSettings, max_articles_per_trade: parseInt(e.target.value) || 1 })}
                      min={1}
                      max={100}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                    />
                  </div>
                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingSettings ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>

            {/* Selected Trades Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-sm font-medium text-gray-700">
                  Top Trades Selected for Feed ({trades.length})
                </h2>
              </div>
              {trades.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  No trades yet. Upload an XLSX file to get started.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ticker</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Traded</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Transaction</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Trade Size</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Party</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Chamber</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {trades.map((trade) => (
                        <tr key={trade.id}>
                          <td className="px-3 py-2 font-medium text-blue-700">{trade.ticker}</td>
                          <td className="px-3 py-2 text-gray-700">{trade.company_name}</td>
                          <td className="px-3 py-2 text-gray-500">{trade.traded}</td>
                          <td className="px-3 py-2 text-gray-500">{trade.transaction || '-'}</td>
                          <td className="px-3 py-2 text-gray-500 text-right">{trade.trade_size_usd || '-'}</td>
                          <td className="px-3 py-2 text-gray-700">{trade.name || '-'}</td>
                          <td className="px-3 py-2 text-gray-500">{trade.party || '-'}</td>
                          <td className="px-3 py-2 text-gray-500">{trade.chamber || '-'}</td>
                          <td className="px-3 py-2 text-gray-500">{trade.state || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Ticker Database */}
        {activeTab === 'ticker-db' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Add Ticker Mapping</h2>
              <div className="flex items-end gap-2">
                <div className="flex-shrink-0 w-32">
                  <label className="block text-xs text-gray-500 mb-1">Ticker</label>
                  <input
                    type="text"
                    value={newTicker}
                    onChange={(e) => setNewTicker(e.target.value)}
                    placeholder="AAPL"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md uppercase"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Company Name</label>
                  <input
                    type="text"
                    value={newTickerName}
                    onChange={(e) => setNewTickerName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTicker()}
                    placeholder="Apple Inc."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <button
                  onClick={handleAddTicker}
                  disabled={!newTicker.trim() || !newTickerName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Bulk Import (CSV)</h2>
              <form onSubmit={handleTickerCSVUpload}>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-3"
                />
                <button
                  type="submit"
                  disabled={tickerUploading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {tickerUploading ? 'Uploading...' : 'Upload CSV'}
                </button>
              </form>
              <p className="mt-2 text-xs text-gray-500">CSV columns: ticker, company_name. Existing tickers will be updated.</p>

              {tickerUploadResult && (
                <div className="mt-3 p-3 rounded bg-gray-50 text-sm">
                  {tickerUploadResult.error ? (
                    <div className="text-red-600">{tickerUploadResult.error}</div>
                  ) : (
                    <div className="text-green-700">Upserted: {tickerUploadResult.upserted} of {tickerUploadResult.total}</div>
                  )}
                </div>
              )}
            </div>

            {/* Ticker Table with Edit */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-700">Ticker Mappings ({tickers.length})</h2>
                <input
                  type="text"
                  value={tickerSearch}
                  onChange={(e) => { setTickerSearch(e.target.value); setTickerPage(0) }}
                  placeholder="Search..."
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md w-48"
                />
              </div>
              {filteredTickers.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">
                  {tickers.length === 0 ? 'No ticker mappings yet.' : 'No results matching your search.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ticker</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Company Name</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-40">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedTickers.map((t) => (
                        <tr key={t.id}>
                          <td className="px-4 py-2 font-medium text-gray-900">{t.ticker}</td>
                          <td className="px-4 py-2 text-gray-700">
                            {editingTickerId === t.id ? (
                              <input
                                type="text"
                                value={editTickerName}
                                onChange={(e) => setEditTickerName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleEditTicker(t.id)
                                  if (e.key === 'Escape') setEditingTickerId(null)
                                }}
                                autoFocus
                                className="w-full px-2 py-1 text-sm border border-blue-300 rounded"
                              />
                            ) : (
                              t.company_name
                            )}
                          </td>
                          <td className="px-4 py-2 text-right space-x-2">
                            {editingTickerId === t.id ? (
                              <>
                                <button
                                  onClick={() => handleEditTicker(t.id)}
                                  className="text-green-600 hover:text-green-800 text-xs"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingTickerId(null)}
                                  className="text-gray-500 hover:text-gray-700 text-xs"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingTickerId(t.id)
                                    setEditTickerName(t.company_name)
                                  }}
                                  className="text-blue-500 hover:text-blue-700 text-xs"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteTicker(t.id)}
                                  className="text-red-500 hover:text-red-700 text-xs"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {tickerTotalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    Showing {tickerPage * TICKERS_PER_PAGE + 1}-{Math.min((tickerPage + 1) * TICKERS_PER_PAGE, filteredTickers.length)} of {filteredTickers.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTickerPage((p) => Math.max(0, p - 1))}
                      disabled={tickerPage === 0}
                      className="px-3 py-1 text-xs font-medium border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-gray-600">
                      Page {tickerPage + 1} of {tickerTotalPages}
                    </span>
                    <button
                      onClick={() => setTickerPage((p) => Math.min(tickerTotalPages - 1, p + 1))}
                      disabled={tickerPage >= tickerTotalPages - 1}
                      className="px-3 py-1 text-xs font-medium border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Excluded Companies with Edit */}
        {activeTab === 'excluded-companies' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-medium text-gray-700 mb-2">Exclude Company/Ticker</h2>
              <p className="text-xs text-gray-500 mb-3">
                Tickers listed here will be skipped when generating RSS feeds (use for funds, ETFs, etc.)
              </p>
              <div className="flex items-end gap-2">
                <div className="flex-shrink-0 w-32">
                  <label className="block text-xs text-gray-500 mb-1">Ticker</label>
                  <input
                    type="text"
                    value={newExcludedTicker}
                    onChange={(e) => setNewExcludedTicker(e.target.value)}
                    placeholder="SPY"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md uppercase"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Display Name (optional)</label>
                  <input
                    type="text"
                    value={newExcludedCompanyName}
                    onChange={(e) => setNewExcludedCompanyName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddExcludedCompany()}
                    placeholder="SPDR S&P 500 ETF"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <button
                  onClick={handleAddExcludedCompany}
                  disabled={!newExcludedTicker.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  Exclude
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-sm font-medium text-gray-700">Excluded Companies ({excludedCompanies.length})</h2>
              </div>
              {excludedCompanies.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">No companies excluded yet.</div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ticker</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Display Name</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-40">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {excludedCompanies.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-2 font-medium text-gray-900">
                          {editingCompanyId === c.id ? (
                            <input
                              type="text"
                              value={editCompanyTicker}
                              onChange={(e) => setEditCompanyTicker(e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-blue-300 rounded uppercase"
                            />
                          ) : (
                            c.ticker
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-500">
                          {editingCompanyId === c.id ? (
                            <input
                              type="text"
                              value={editCompanyName}
                              onChange={(e) => setEditCompanyName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleEditExcludedCompany(c.id)
                                if (e.key === 'Escape') setEditingCompanyId(null)
                              }}
                              autoFocus
                              className="w-full px-2 py-1 text-sm border border-blue-300 rounded"
                            />
                          ) : (
                            c.company_name || '-'
                          )}
                        </td>
                        <td className="px-4 py-2 text-right space-x-2">
                          {editingCompanyId === c.id ? (
                            <>
                              <button
                                onClick={() => handleEditExcludedCompany(c.id)}
                                className="text-green-600 hover:text-green-800 text-xs"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingCompanyId(null)}
                                className="text-gray-500 hover:text-gray-700 text-xs"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingCompanyId(c.id)
                                  setEditCompanyTicker(c.ticker)
                                  setEditCompanyName(c.company_name || '')
                                }}
                                className="text-blue-500 hover:text-blue-700 text-xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteExcludedCompany(c.id)}
                                className="text-red-500 hover:text-red-700 text-xs"
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab: Excluded Sources with Autocomplete */}
        {activeTab === 'excluded-sources' && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-medium text-gray-700">Excluded Publishers ({excludedSources.length})</h2>
              <p className="text-xs text-gray-500 mt-1">
                Articles from these publishers will be filtered out. Source names come from the RSS &lt;source&gt; element.
              </p>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 relative">
                  <input
                    ref={sourceInputRef}
                    type="text"
                    value={newExcludedSource}
                    onChange={(e) => {
                      setNewExcludedSource(e.target.value)
                      setShowSourceDropdown(true)
                    }}
                    onFocus={() => setShowSourceDropdown(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddExcludedSource()
                        setShowSourceDropdown(false)
                      }
                      if (e.key === 'Escape') setShowSourceDropdown(false)
                    }}
                    placeholder={loadingKnownSources ? 'Loading sources...' : 'Type to search or add publisher...'}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                  {showSourceDropdown && filteredKnownSources.length > 0 && (
                    <div
                      ref={dropdownRef}
                      className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto"
                    >
                      {filteredKnownSources.map((source) => (
                        <button
                          key={source}
                          onClick={() => handleAddExcludedSource(source)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 text-gray-700"
                        >
                          {source}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleAddExcludedSource()}
                  disabled={!newExcludedSource.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  Exclude
                </button>
              </div>
              {excludedSources.length === 0 ? (
                <div className="text-sm text-gray-500 py-2">No publishers excluded yet.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {excludedSources.map((es) => (
                    <span
                      key={es.id}
                      className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-red-50 text-red-700 rounded-full border border-red-200"
                    >
                      {es.source_name}
                      <button
                        onClick={() => handleRemoveExcludedSource(es.id)}
                        className="ml-1 text-red-400 hover:text-red-600"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Excluded Keywords */}
        {activeTab === 'excluded-keywords' && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-medium text-gray-700">Excluded Keywords ({excludedKeywords.length})</h2>
              <p className="text-xs text-gray-500 mt-1">
                Articles with titles containing these keywords will be filtered out (case-insensitive).
              </p>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                  placeholder="Keyword to exclude..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md"
                />
                <button
                  onClick={handleAddKeyword}
                  disabled={!newKeyword.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  Exclude
                </button>
              </div>
              {excludedKeywords.length === 0 ? (
                <div className="text-sm text-gray-500 py-2">No keywords excluded yet.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {excludedKeywords.map((kw) => (
                    <span
                      key={kw.id}
                      className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-orange-50 text-orange-700 rounded-full border border-orange-200"
                    >
                      {kw.keyword}
                      <button
                        onClick={() => handleDeleteKeyword(kw.id)}
                        className="ml-1 text-orange-400 hover:text-orange-600"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Settings */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Feed Settings</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Feed Title</label>
                  <input
                    type="text"
                    value={editSettings.feed_title}
                    onChange={(e) => setEditSettings({ ...editSettings, feed_title: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Max Age (days)</label>
                    <input
                      type="number"
                      value={editSettings.max_age_days}
                      onChange={(e) => setEditSettings({ ...editSettings, max_age_days: parseInt(e.target.value) || 1 })}
                      min={1}
                      max={90}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cache TTL (minutes)</label>
                    <input
                      type="number"
                      value={editSettings.cache_ttl_minutes}
                      onChange={(e) => setEditSettings({ ...editSettings, cache_ttl_minutes: parseInt(e.target.value) || 1 })}
                      min={1}
                      max={1440}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Combined Feed URL</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-50 rounded px-3 py-2 text-sm text-gray-800 border border-gray-200 overflow-x-auto">
                  {feedUrl}
                </code>
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Requires Bearer token (CRON_SECRET) or ?secret= param. Add ?refresh=true to force cache bust.
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
