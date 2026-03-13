'use client'

import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'

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
  max_trades: number
  updated_at: string
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

  // Settings state
  const [settings, setSettings] = useState<FeedSettings | null>(null)
  const [editSettings, setEditSettings] = useState({
    max_age_days: 7,
    cache_ttl_minutes: 15,
    feed_title: 'Combined RSS Feed',
    url_template: '',
    max_trades: 21,
  })
  const [savingSettings, setSavingSettings] = useState(false)

  // Ticker DB state
  const [tickers, setTickers] = useState<TickerMapping[]>([])
  const [tickerSearch, setTickerSearch] = useState('')
  const [newTicker, setNewTicker] = useState('')
  const [newTickerName, setNewTickerName] = useState('')
  const [tickerUploading, setTickerUploading] = useState(false)
  const [tickerUploadResult, setTickerUploadResult] = useState<any>(null)

  // Excluded companies state
  const [excludedCompanies, setExcludedCompanies] = useState<ExcludedCompany[]>([])
  const [newExcludedTicker, setNewExcludedTicker] = useState('')
  const [newExcludedCompanyName, setNewExcludedCompanyName] = useState('')

  // Excluded sources state
  const [excludedSources, setExcludedSources] = useState<ExcludedSource[]>([])
  const [newExcludedSource, setNewExcludedSource] = useState('')

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
          max_trades: s.max_trades,
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

  // --- Upload Handlers ---

  const handleTradeUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement
    const file = fileInput?.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/admin/rss-combiner/upload', { method: 'POST', body: formData })
      const data = await res.json()
      setUploadResult(data)
      if (res.ok) {
        fetchTrades()
        fileInput.value = ''
      }
    } catch {
      setUploadResult({ error: 'Upload failed' })
    } finally {
      setUploading(false)
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

  const handleDeleteExcludedCompany = async (id: string) => {
    const res = await fetch('/api/admin/rss-combiner/excluded-companies', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setExcludedCompanies((prev) => prev.filter((c) => c.id !== id))
  }

  const handleAddExcludedSource = async () => {
    const name = newExcludedSource.trim()
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

  // Filtered ticker list for search
  const filteredTickers = tickerSearch
    ? tickers.filter(
        (t) =>
          t.ticker.toLowerCase().includes(tickerSearch.toLowerCase()) ||
          t.company_name.toLowerCase().includes(tickerSearch.toLowerCase())
      )
    : tickers

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
            {/* Stats Bar */}
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

            {/* Upload + Template Settings side-by-side */}
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
                  Expects congressional trading XLSX. Each upload replaces all existing trades.
                </p>

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
                    <label className="block text-xs text-gray-500 mb-1">URL Template</label>
                    <input
                      type="text"
                      value={editSettings.url_template}
                      onChange={(e) => setEditSettings({ ...editSettings, url_template: e.target.value })}
                      placeholder="https://news.google.com/rss/search?q={company_name}+stock..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-mono"
                    />
                    <p className="text-xs text-gray-400 mt-1">Use {'{company_name}'} as placeholder</p>
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
            {/* Manual Add */}
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

            {/* CSV Upload */}
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

            {/* Ticker Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-700">Ticker Mappings ({tickers.length})</h2>
                <input
                  type="text"
                  value={tickerSearch}
                  onChange={(e) => setTickerSearch(e.target.value)}
                  placeholder="Search..."
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md w-48"
                />
              </div>
              {filteredTickers.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">
                  {tickers.length === 0 ? 'No ticker mappings yet.' : 'No results matching your search.'}
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ticker</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Company Name</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredTickers.map((t) => (
                        <tr key={t.id}>
                          <td className="px-4 py-2 font-medium text-gray-900">{t.ticker}</td>
                          <td className="px-4 py-2 text-gray-700">{t.company_name}</td>
                          <td className="px-4 py-2 text-right">
                            <button
                              onClick={() => handleDeleteTicker(t.id)}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Excluded Companies */}
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
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {excludedCompanies.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-2 font-medium text-gray-900">{c.ticker}</td>
                        <td className="px-4 py-2 text-gray-500">{c.company_name || '-'}</td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => handleDeleteExcludedCompany(c.id)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab: Excluded Sources */}
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
                <input
                  type="text"
                  value={newExcludedSource}
                  onChange={(e) => setNewExcludedSource(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddExcludedSource()}
                  placeholder="Publisher name (e.g. Barchart.com)"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md"
                />
                <button
                  onClick={handleAddExcludedSource}
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

            {/* Feed URL */}
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
