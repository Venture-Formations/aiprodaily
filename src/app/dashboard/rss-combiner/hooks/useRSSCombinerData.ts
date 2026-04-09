'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { COLUMN_MAP, normalizeHeader, parseExcelDate, DEFAULT_EDIT_SETTINGS } from '../constants'
import type {
  Tab,
  TradeRow,
  TradeStats,
  TickerMapping,
  ExcludedCompany,
  ExcludedKeyword,
  ApprovedSource,
  IngestionStats,
  FeedSettings,
  StagingStatus,
  EditSettings,
} from '../types'

export function useRSSCombinerData() {
  const [activeTab, setActiveTab] = useState<Tab>('trades')

  // Trades state
  const [trades, setTrades] = useState<TradeRow[]>([])
  const [tradeStats, setTradeStats] = useState<TradeStats | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [uploadProgress, setUploadProgress] = useState('')

  // Settings state
  const [settings, setSettings] = useState<FeedSettings | null>(null)
  const [editSettings, setEditSettings] = useState<EditSettings>(DEFAULT_EDIT_SETTINGS)
  const [savingSettings, setSavingSettings] = useState(false)

  // Ticker DB state
  const [tickers, setTickers] = useState<TickerMapping[]>([])
  const [tickerSearch, setTickerSearch] = useState('')
  const [tickerPage, setTickerPage] = useState(0)
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

  // Approved sources state
  const [approvedSources, setApprovedSources] = useState<ApprovedSource[]>([])
  const [newApprovedName, setNewApprovedName] = useState('')
  const [newApprovedDomain, setNewApprovedDomain] = useState('')

  // Ingestion state
  const [ingesting, setIngesting] = useState(false)
  const [ingestionResult, setIngestionResult] = useState<IngestionStats | null>(null)
  const [workflowStatus, setWorkflowStatus] = useState<'idle' | 'starting' | 'started' | 'failed'>('idle')
  const [workflowStartedAt, setWorkflowStartedAt] = useState<string | null>(null)

  // Excluded keywords state
  const [excludedKeywords, setExcludedKeywords] = useState<ExcludedKeyword[]>([])
  const [newKeyword, setNewKeyword] = useState('')

  // Staging state
  const [stagingStatus, setStagingStatus] = useState<StagingStatus | null>(null)
  const [activating, setActivating] = useState(false)
  const [activationResult, setActivationResult] = useState<any>(null)

  // Unknown tickers state
  const [unknownTickers, setUnknownTickers] = useState<{ ticker: string; raw_company: string }[]>([])
  const [confirmingTicker, setConfirmingTicker] = useState<{ ticker: string; name: string } | null>(null)

  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  // --- Fetch callbacks ---

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
          upload_schedule_day: s.upload_schedule_day ?? 2,
          upload_schedule_time: s.upload_schedule_time ?? '09:00',
          trade_freshness_days: s.trade_freshness_days ?? 7,
          max_trades_per_member: s.max_trades_per_member ?? 5,
          feed_article_age_days: s.feed_article_age_days ?? 14,
          min_articles_per_company: s.min_articles_per_company ?? 2,
          secondary_sale_url_template: s.secondary_sale_url_template || '',
          secondary_purchase_url_template: s.secondary_purchase_url_template || '',
          min_posts_per_trade: s.min_posts_per_trade ?? 20,
          secondary_templates_enabled: s.secondary_templates_enabled ?? true,
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

  const fetchApprovedSources = useCallback(async () => {
    const res = await fetch('/api/admin/rss-combiner/approved-sources')
    if (res.ok) {
      const data = await res.json()
      setApprovedSources(data.approvedSources || [])
    }
  }, [])

  const fetchExcludedKeywords = useCallback(async () => {
    const res = await fetch('/api/admin/rss-combiner/excluded-keywords')
    if (res.ok) {
      const data = await res.json()
      setExcludedKeywords(data.keywords || [])
    }
  }, [])

  const fetchUnknownTickers = useCallback(async () => {
    const res = await fetch('/api/admin/rss-combiner/ticker-db/unknown')
    if (res.ok) {
      const data = await res.json()
      setUnknownTickers(data.unknown || [])
    }
  }, [])

  const fetchStagingStatus = useCallback(async () => {
    const res = await fetch('/api/admin/rss-combiner/staging')
    if (res.ok) {
      const data = await res.json()
      setStagingStatus(data)
    }
  }, [])

  // Lazy tab loading
  const loadedTabs = useRef<Set<string>>(new Set())

  useEffect(() => {
    const loadTabData = async () => {
      const promises: Promise<void>[] = []

      if (!loadedTabs.current.has('settings')) {
        loadedTabs.current.add('settings')
        promises.push(fetchSettings())
      }

      if (!loadedTabs.current.has(activeTab)) {
        loadedTabs.current.add(activeTab)
        switch (activeTab) {
          case 'trades':
            promises.push(fetchTrades())
            promises.push(fetchStagingStatus())
            break
          case 'ticker-db':
            promises.push(fetchTickers())
            promises.push(fetchUnknownTickers())
            promises.push(fetchExcludedCompanies())
            break
          case 'excluded-companies':
            promises.push(fetchExcludedCompanies())
            break
          case 'approved-sources':
            promises.push(fetchApprovedSources())
            break
          case 'excluded-keywords':
            promises.push(fetchExcludedKeywords())
            break
        }
      }

      if (promises.length > 0) {
        await Promise.all(promises).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    }
    loadTabData()
  }, [activeTab, fetchTrades, fetchSettings, fetchTickers, fetchExcludedCompanies, fetchApprovedSources, fetchExcludedKeywords, fetchStagingStatus, fetchUnknownTickers])

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

      const parsedTrades: any[] = []
      for (const row of rows) {
        const trade: Record<string, any> = {}
        for (const [rawHeader, dbCol] of Object.entries(colIndex)) {
          const val = row[rawHeader]
          if (dbCol === 'traded' || dbCol === 'filed' || dbCol === 'quiver_upload_time') {
            trade[dbCol] = parseExcelDate(val)
          } else {
            trade[dbCol] = val != null ? String(val).trim() || null : null
          }
        }
        if (trade.ticker && trade.traded) {
          parsedTrades.push(trade)
        }
      }

      setUploadProgress(`Uploading ${parsedTrades.length.toLocaleString()} trades in batches...`)

      const CHUNK_SIZE = 2000
      let totalInserted = 0
      const allErrors: string[] = []

      for (let i = 0; i < parsedTrades.length; i += CHUNK_SIZE) {
        const chunk = parsedTrades.slice(i, i + CHUNK_SIZE)
        const batchNum = Math.floor(i / CHUNK_SIZE) + 1
        const totalBatches = Math.ceil(parsedTrades.length / CHUNK_SIZE)
        setUploadProgress(`Uploading batch ${batchNum} of ${totalBatches}...`)

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
        uniqueTickers: new Set(parsedTrades.map((t: any) => t.ticker?.toUpperCase())).size,
        staged: true,
        errors: allErrors.slice(0, 20),
      })
      fetchStagingStatus()
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

  const handleConfirmUnknownTicker = async (ticker: string, companyName: string) => {
    const res = await fetch('/api/admin/rss-combiner/ticker-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, company_name: companyName }),
    })
    if (res.ok) {
      setUnknownTickers((prev) => prev.filter((t) => t.ticker !== ticker))
      setConfirmingTicker(null)
      fetchTickers()
    }
  }

  const handleToggleExclude = async (ticker: string) => {
    const existing = excludedCompanies.find((c) => c.ticker.toUpperCase() === ticker.toUpperCase())
    if (existing) {
      const res = await fetch('/api/admin/rss-combiner/excluded-companies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: existing.id }),
      })
      if (res.ok) {
        setExcludedCompanies((prev) => prev.filter((c) => c.id !== existing.id))
      }
    } else {
      const tickerMapping = tickers.find((t) => t.ticker.toUpperCase() === ticker.toUpperCase())
      const res = await fetch('/api/admin/rss-combiner/excluded-companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, company_name: tickerMapping?.company_name || undefined }),
      })
      if (res.ok) {
        const data = await res.json()
        setExcludedCompanies((prev) => [...prev, data.company])
      }
    }
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

  const handleAddApprovedSource = async () => {
    if (!newApprovedName.trim() || !newApprovedDomain.trim()) return
    const res = await fetch('/api/admin/rss-combiner/approved-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_name: newApprovedName.trim(), source_domain: newApprovedDomain.trim() }),
    })
    if (res.ok) {
      const data = await res.json()
      setApprovedSources((prev) => [...prev, data.approvedSource])
      setNewApprovedName('')
      setNewApprovedDomain('')
    }
  }

  const handleDeleteApprovedSource = async (id: string) => {
    const res = await fetch('/api/admin/rss-combiner/approved-sources', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setApprovedSources((prev) => prev.filter((s) => s.id !== id))
  }

  const handleToggleApprovedSource = async (id: string, is_active: boolean) => {
    const res = await fetch('/api/admin/rss-combiner/approved-sources', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active }),
    })
    if (res.ok) {
      const data = await res.json()
      setApprovedSources((prev) => prev.map((s) => (s.id === id ? data.approvedSource : s)))
    }
  }

  const handleRunIngestion = async () => {
    setIngesting(true)
    setIngestionResult(null)
    try {
      const res = await fetch('/api/admin/rss-combiner/ingest', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setIngestionResult(data)
        fetchSettings()
      } else {
        const data = await res.json()
        setIngestionResult({ feedsFetched: 0, feedsFailed: 0, articlesStored: 0, articlesFiltered: 0, articlesSkippedDuplicate: 0 })
        console.error('Ingestion failed:', data.error)
      }
    } catch {
      setIngestionResult({ feedsFetched: 0, feedsFailed: 0, articlesStored: 0, articlesFiltered: 0, articlesSkippedDuplicate: 0 })
    } finally {
      setIngesting(false)
    }
  }

  const handleActivateNow = async () => {
    setActivating(true)
    setActivationResult(null)
    setWorkflowStatus('idle')
    try {
      const res = await fetch('/api/admin/rss-combiner/activate', { method: 'POST' })
      const data = await res.json()
      setActivationResult(data)
      if (data.activated) {
        // Activation now triggers the ingestion workflow in the background.
        // Surface that state so the UI can display "workflow started".
        if (data.workflowStarted) {
          setWorkflowStatus('started')
          setWorkflowStartedAt(new Date().toISOString())
        } else if (data.workflowError) {
          setWorkflowStatus('failed')
        }
        fetchTrades()
        fetchStagingStatus()
        fetchSettings()
      }
    } catch {
      setActivationResult({ activated: false, reason: 'request_failed' })
    } finally {
      setActivating(false)
    }
  }

  // Triggers the durable workflow which handles ingestion across multiple steps,
  // each with its own 800s timeout. Returns immediately; workflow runs in background.
  // Sets workflowStatus so the UI can distinguish "started" from "failed" — the
  // fire-and-forget nature means we don't know the actual stats until the workflow
  // finishes and last_ingestion_at updates.
  const handleRunIngestionWorkflow = async () => {
    setIngesting(true)
    setIngestionResult(null)
    setWorkflowStatus('starting')
    setWorkflowStartedAt(null)
    try {
      const res = await fetch('/api/workflows/rss-combiner-ingestion', { method: 'POST' })
      if (res.ok) {
        setWorkflowStatus('started')
        setWorkflowStartedAt(new Date().toISOString())
      } else {
        const data = await res.json().catch(() => ({}))
        console.error('Workflow start failed:', data.error)
        setWorkflowStatus('failed')
      }
    } catch (error) {
      console.error('Workflow start error:', error)
      setWorkflowStatus('failed')
    } finally {
      setIngesting(false)
    }
  }

  const handleDiscardStaged = async () => {
    if (!confirm('Discard all staged data?')) return
    const res = await fetch('/api/admin/rss-combiner/staging', { method: 'DELETE' })
    if (res.ok) {
      setStagingStatus(null)
      setUploadResult(null)
    }
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

  const handleCopy = () => {
    const feedUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/api/feeds/combined`
      : '/api/feeds/combined'
    navigator.clipboard.writeText(feedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Derived state
  const excludedTickerSet = new Set(excludedCompanies.map((c) => c.ticker.toUpperCase()))

  const filteredTickers = tickerSearch
    ? tickers.filter(
        (t) =>
          t.ticker.toLowerCase().includes(tickerSearch.toLowerCase()) ||
          t.company_name.toLowerCase().includes(tickerSearch.toLowerCase())
      )
    : tickers

  const feedUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/feeds/combined`
    : '/api/feeds/combined'

  return {
    // Tab
    activeTab,
    setActiveTab,
    loading,

    // Trades
    trades,
    tradeStats,
    uploading,
    uploadResult,
    uploadProgress,
    handleTradeUpload,

    // Settings
    settings,
    editSettings,
    setEditSettings,
    savingSettings,
    handleSaveSettings,

    // Tickers
    tickers,
    filteredTickers,
    tickerSearch,
    setTickerSearch,
    tickerPage,
    setTickerPage,
    newTicker,
    setNewTicker,
    newTickerName,
    setNewTickerName,
    editingTickerId,
    setEditingTickerId,
    editTickerName,
    setEditTickerName,
    tickerUploading,
    tickerUploadResult,
    handleTickerCSVUpload,
    handleAddTicker,
    handleEditTicker,
    handleDeleteTicker,

    // Unknown tickers
    unknownTickers,
    confirmingTicker,
    setConfirmingTicker,
    handleConfirmUnknownTicker,

    // Excluded companies
    excludedCompanies,
    excludedTickerSet,
    newExcludedTicker,
    setNewExcludedTicker,
    newExcludedCompanyName,
    setNewExcludedCompanyName,
    editingCompanyId,
    setEditingCompanyId,
    editCompanyTicker,
    setEditCompanyTicker,
    editCompanyName,
    setEditCompanyName,
    handleAddExcludedCompany,
    handleEditExcludedCompany,
    handleDeleteExcludedCompany,
    handleToggleExclude,

    // Approved sources
    approvedSources,
    newApprovedName,
    setNewApprovedName,
    newApprovedDomain,
    setNewApprovedDomain,
    handleAddApprovedSource,
    handleDeleteApprovedSource,
    handleToggleApprovedSource,

    // Excluded keywords
    excludedKeywords,
    newKeyword,
    setNewKeyword,
    handleAddKeyword,
    handleDeleteKeyword,

    // Ingestion
    ingesting,
    ingestionResult,
    handleRunIngestion,
    handleRunIngestionWorkflow,
    workflowStatus,
    workflowStartedAt,

    // Staging
    stagingStatus,
    activating,
    activationResult,
    handleActivateNow,
    handleDiscardStaged,

    // Feed URL
    feedUrl,
    copied,
    handleCopy,
  }
}
