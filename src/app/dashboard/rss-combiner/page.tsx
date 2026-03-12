'use client'

import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'

interface FeedSource {
  id: string
  url: string
  label: string
  is_active: boolean
  is_excluded: boolean
  created_at: string
  updated_at: string
}

interface FeedSettings {
  id: string
  max_age_days: number
  cache_ttl_minutes: number
  feed_title: string
  updated_at: string
}

interface UploadResult {
  created: number
  updated: number
  deactivated: number
  errors: string[]
  total: number
}

export default function RSSCombinerPage() {
  const [sources, setSources] = useState<FeedSource[]>([])
  const [settings, setSettings] = useState<FeedSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [copied, setCopied] = useState(false)

  // Editable settings fields
  const [editMaxAge, setEditMaxAge] = useState(7)
  const [editCacheTtl, setEditCacheTtl] = useState(15)
  const [editFeedTitle, setEditFeedTitle] = useState('Combined RSS Feed')

  const fetchData = useCallback(async () => {
    try {
      const [sourcesRes, settingsRes] = await Promise.all([
        fetch('/api/admin/rss-combiner/sources'),
        fetch('/api/admin/rss-combiner/settings'),
      ])

      if (sourcesRes.ok) {
        const data = await sourcesRes.json()
        setSources(data.sources || [])
      }

      if (settingsRes.ok) {
        const data = await settingsRes.json()
        const s = data.settings
        setSettings(s)
        if (s) {
          setEditMaxAge(s.max_age_days)
          setEditCacheTtl(s.cache_ttl_minutes)
          setEditFeedTitle(s.feed_title)
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
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

      const res = await fetch('/api/admin/rss-combiner/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (res.ok) {
        setUploadResult(data)
        fetchData()
        fileInput.value = ''
      } else {
        setUploadResult({ created: 0, updated: 0, deactivated: 0, errors: [data.error], total: 0 })
      }
    } catch (error) {
      setUploadResult({ created: 0, updated: 0, deactivated: 0, errors: ['Upload failed'], total: 0 })
    } finally {
      setUploading(false)
    }
  }

  const handleToggle = async (id: string, field: 'is_active' | 'is_excluded', value: boolean) => {
    try {
      const res = await fetch('/api/admin/rss-combiner/sources', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: value }),
      })

      if (res.ok) {
        setSources((prev) =>
          prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
        )
      }
    } catch (error) {
      console.error('Toggle failed:', error)
    }
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const res = await fetch('/api/admin/rss-combiner/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_age_days: editMaxAge,
          cache_ttl_minutes: editCacheTtl,
          feed_title: editFeedTitle,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings)
      }
    } catch (error) {
      console.error('Save settings failed:', error)
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

  const activeCount = sources.filter((s) => s.is_active && !s.is_excluded).length
  const excludedCount = sources.filter((s) => s.is_excluded).length
  const inactiveCount = sources.filter((s) => !s.is_active).length

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
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">RSS Feed Combiner</h1>
          <p className="mt-1 text-sm text-gray-600">
            Combine multiple RSS feeds into a single endpoint. Upload a CSV of feed URLs to manage sources.
          </p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
            <div className="text-xs text-gray-500 mt-1">Active Sources</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{excludedCount}</div>
            <div className="text-xs text-gray-500 mt-1">Excluded</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-gray-400">{inactiveCount}</div>
            <div className="text-xs text-gray-500 mt-1">Inactive</div>
          </div>
        </div>

        {/* Feed URL */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-8">
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
            Requires Bearer token (CRON_SECRET) for authentication. Add ?refresh=true to force cache bust.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Upload */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Upload CSV</h2>
            <form onSubmit={handleUpload}>
              <input
                type="file"
                accept=".csv,text/csv"
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-3"
              />
              <button
                type="submit"
                disabled={uploading}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload & Replace'}
              </button>
            </form>
            <p className="mt-2 text-xs text-gray-500">
              CSV columns: url (required), label (optional). Each upload replaces the active set.
            </p>

            {uploadResult && (
              <div className="mt-3 p-3 rounded bg-gray-50 text-sm">
                <div className="font-medium mb-1">
                  Upload complete ({uploadResult.total} URLs processed)
                </div>
                <div className="text-green-700">Created: {uploadResult.created}</div>
                <div className="text-blue-700">Updated: {uploadResult.updated}</div>
                <div className="text-yellow-700">Deactivated: {uploadResult.deactivated}</div>
                {uploadResult.errors.length > 0 && (
                  <div className="mt-2 text-red-600">
                    {uploadResult.errors.map((err, i) => (
                      <div key={i}>{err}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Settings</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Feed Title</label>
                <input
                  type="text"
                  value={editFeedTitle}
                  onChange={(e) => setEditFeedTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max Age (days)</label>
                  <input
                    type="number"
                    value={editMaxAge}
                    onChange={(e) => setEditMaxAge(parseInt(e.target.value) || 1)}
                    min={1}
                    max={90}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cache TTL (minutes)</label>
                  <input
                    type="number"
                    value={editCacheTtl}
                    onChange={(e) => setEditCacheTtl(parseInt(e.target.value) || 1)}
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
        </div>

        {/* Sources Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-medium text-gray-700">
              Feed Sources ({sources.length})
            </h2>
          </div>

          {sources.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              No sources yet. Upload a CSV to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Label</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Active</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Excluded</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sources.map((source) => (
                    <tr
                      key={source.id}
                      className={
                        !source.is_active
                          ? 'bg-gray-50 text-gray-400'
                          : source.is_excluded
                            ? 'bg-red-50'
                            : ''
                      }
                    >
                      <td className="px-4 py-2 text-sm font-medium">
                        {source.label || '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {source.url}
                        </a>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={source.is_active}
                          onChange={(e) => handleToggle(source.id, 'is_active', e.target.checked)}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={source.is_excluded}
                          onChange={(e) => handleToggle(source.id, 'is_excluded', e.target.checked)}
                          className="h-4 w-4 text-red-600 rounded"
                        />
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {new Date(source.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
