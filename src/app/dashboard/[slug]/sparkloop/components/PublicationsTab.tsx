'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X, ChevronDown, Download } from 'lucide-react'

interface Recommendation {
  id: string
  ref_code: string
  publication_name: string
  publication_logo: string | null
}

interface Referral {
  subscriber_email: string
  subscribed_at: string
  status: string
  source: string
}

interface SourceSummary {
  total: number
  confirmed: number
  rejected: number
  pending: number
  subscribed: number
}

interface Summary {
  popup: SourceSummary
  page: SourceSummary
}

interface Props {
  recommendations: Recommendation[]
}

export default function PublicationsTab({ recommendations }: Props) {
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null)
  const [searchText, setSearchText] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [referrals, setReferrals] = useState<Referral[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)

  const [sourceFilter, setSourceFilter] = useState<'all' | 'popup' | 'page'>('all')
  const [sortAsc, setSortAsc] = useState(false)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Quick date helpers
  function setQuickRange(days: number) {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  // Fetch when publication + dates are set
  useEffect(() => {
    if (selectedRec && startDate && endDate) {
      fetchSubmissions()
    }
  }, [selectedRec, startDate, endDate])

  async function fetchSubmissions() {
    if (!selectedRec || !startDate || !endDate) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        ref_code: selectedRec.ref_code,
        start: startDate,
        end: endDate,
      })
      const res = await fetch(`/api/sparkloop/admin/submissions?${params}`)
      const data = await res.json()
      if (data.success) {
        setReferrals(data.referrals)
        setSummary(data.summary)
      }
    } catch (error) {
      console.error('Failed to fetch submissions:', error)
    }
    setLoading(false)
  }

  const filteredRecs = useMemo(() => {
    if (!searchText.trim()) return recommendations
    const q = searchText.toLowerCase()
    return recommendations.filter(r => r.publication_name.toLowerCase().includes(q))
  }, [searchText, recommendations])

  const filteredReferrals = useMemo(() => {
    let list = [...referrals]
    if (sourceFilter === 'popup') list = list.filter(r => r.source === 'custom_popup')
    else if (sourceFilter === 'page') list = list.filter(r => r.source === 'recs_page')

    list.sort((a, b) => {
      const cmp = new Date(a.subscribed_at).getTime() - new Date(b.subscribed_at).getTime()
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [referrals, sourceFilter, sortAsc])

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      confirmed: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      pending: 'bg-yellow-100 text-yellow-700',
      subscribed: 'bg-gray-100 text-gray-600',
    }
    return map[status] || 'bg-gray-100 text-gray-600'
  }

  const sourceBadge = (source: string) => {
    return source === 'recs_page'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-purple-100 text-purple-700'
  }

  const sourceLabel = (source: string) => {
    return source === 'recs_page' ? 'Page' : 'Popup'
  }

  return (
    <div className="space-y-6">
      {/* Publication Selector + Date Range */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Publication Search Dropdown */}
          <div className="flex-1 min-w-[250px]" ref={dropdownRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Publication</label>
            {selectedRec ? (
              <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-gray-50">
                {selectedRec.publication_logo && (
                  <img src={selectedRec.publication_logo} alt="" className="w-5 h-5 rounded-full" />
                )}
                <span className="text-sm font-medium flex-1 truncate">{selectedRec.publication_name}</span>
                <button
                  onClick={() => { setSelectedRec(null); setSearchText(''); setReferrals([]); setSummary(null) }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center border rounded-lg">
                  <Search className="w-4 h-4 ml-3 text-gray-400" />
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => { setSearchText(e.target.value); setDropdownOpen(true) }}
                    onFocus={() => setDropdownOpen(true)}
                    placeholder="Search publications..."
                    className="w-full px-2 py-2 text-sm rounded-lg outline-none"
                  />
                  <ChevronDown className="w-4 h-4 mr-3 text-gray-400" />
                </div>
                {dropdownOpen && filteredRecs.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredRecs.map(rec => (
                      <button
                        key={rec.id}
                        onClick={() => {
                          setSelectedRec(rec)
                          setSearchText('')
                          setDropdownOpen(false)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                      >
                        {rec.publication_logo ? (
                          <img src={rec.publication_logo} alt="" className="w-5 h-5 rounded-full flex-shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-purple-100 flex-shrink-0" />
                        )}
                        <span className="truncate">{rec.publication_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <button onClick={() => setQuickRange(7)} className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
              7 Days
            </button>
            <button onClick={() => setQuickRange(30)} className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
              30 Days
            </button>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); setReferrals([]); setSummary(null) }}
                className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-400 mt-2">All dates and times are in UTC</div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500 mb-1">Popup Submissions</div>
            <div className="text-2xl font-bold text-purple-600">{summary.popup.total}</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500 mb-1">Page Submissions</div>
            <div className="text-2xl font-bold text-blue-600">{summary.page.total}</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500 mb-1">Confirmed</div>
            <div className="text-2xl font-bold text-green-600">
              {summary.popup.confirmed + summary.page.confirmed}
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500 mb-1">Pending</div>
            <div className="text-2xl font-bold text-yellow-600">
              {summary.popup.pending + summary.page.pending}
            </div>
          </div>
        </div>
      )}

      {/* Source Filter + Table */}
      {selectedRec && startDate && endDate && (
        <div className="bg-white rounded-lg border">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex gap-1">
              {(['all', 'popup', 'page'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setSourceFilter(f)}
                  className={`px-3 py-1.5 text-sm rounded-lg ${
                    sourceFilter === f ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'popup' ? 'Popup' : 'Page'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {loading ? 'Loading...' : `Showing ${filteredReferrals.length} submissions`}
              </span>
              {filteredReferrals.length > 0 && (
                <button
                  onClick={() => {
                    const header = 'Email,Date,Status,Source'
                    const rows = filteredReferrals.map(r =>
                      `${r.subscriber_email},${r.subscribed_at.split('T')[0]},${r.status},${r.source === 'recs_page' ? 'Page' : 'Popup'}`
                    )
                    const csv = [header, ...rows].join('\n')
                    const blob = new Blob([csv], { type: 'text/csv' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${selectedRec?.publication_name.replace(/[^a-zA-Z0-9]/g, '_')}_${startDate}_${endDate}.csv`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-500">Loading submissions...</div>
          ) : filteredReferrals.length === 0 ? (
            <div className="py-12 text-center text-gray-500">No submissions found for this selection</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-3 font-medium text-gray-600">Email</th>
                    <th
                      className="px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                      onClick={() => setSortAsc(!sortAsc)}
                    >
                      Date {sortAsc ? '\u2191' : '\u2193'}
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredReferrals.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs">{r.subscriber_email}</td>
                      <td className="px-4 py-2.5 text-gray-600">
                        {new Date(r.subscribed_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
                        })}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sourceBadge(r.source)}`}>
                          {sourceLabel(r.source)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Empty state when no publication selected */}
      {!selectedRec && (
        <div className="bg-white rounded-lg border p-12 text-center text-gray-500">
          Select a publication above to view submission details
        </div>
      )}
    </div>
  )
}
