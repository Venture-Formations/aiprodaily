'use client'

import { Search, X, ChevronDown, Download } from 'lucide-react'
import type { Recommendation } from '../types'
import {
  usePublicationsTab,
  statusBadgeClass,
  sourceBadgeClass,
  sourceLabel,
} from './usePublicationsTab'

interface Props {
  recommendations: Recommendation[]
  publicationId: string | null
}

export default function PublicationsTab({ recommendations, publicationId }: Props) {
  const {
    selectedRec, searchText, setSearchText, dropdownOpen, setDropdownOpen,
    dropdownRef, startDate, setStartDate, endDate, setEndDate,
    summary, loading, sourceFilter, setSourceFilter,
    sortAsc, setSortAsc, timezone, setTimezone, tz,
    filteredRecs, filteredReferrals,
    setQuickRange, clearSelection, clearDates, selectRec,
  } = usePublicationsTab(recommendations, publicationId)

  return (
    <div className="space-y-6">
      {/* Publication Selector + Date Range */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[250px]" ref={dropdownRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Publication</label>
            {selectedRec ? (
              <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-gray-50">
                {selectedRec.publication_logo && <img src={selectedRec.publication_logo} alt="" className="w-5 h-5 rounded-full" />}
                <span className="text-sm font-medium flex-1 truncate">{selectedRec.publication_name}</span>
                <button onClick={clearSelection} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center border rounded-lg">
                  <Search className="w-4 h-4 ml-3 text-gray-400" />
                  <input type="text" value={searchText} onChange={(e) => { setSearchText(e.target.value); setDropdownOpen(true) }} onFocus={() => setDropdownOpen(true)} placeholder="Search publications..." className="w-full px-2 py-2 text-sm rounded-lg outline-none" />
                  <ChevronDown className="w-4 h-4 mr-3 text-gray-400" />
                </div>
                {dropdownOpen && filteredRecs.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredRecs.map(rec => (
                      <button key={rec.id} onClick={() => selectRec(rec)} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left">
                        {rec.publication_logo ? <img src={rec.publication_logo} alt="" className="w-5 h-5 rounded-full flex-shrink-0" /> : <div className="w-5 h-5 rounded-full bg-purple-100 flex-shrink-0" />}
                        <span className="truncate">{rec.publication_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-end gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
            </div>
            <button onClick={() => setQuickRange(7)} className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">7 Days</button>
            <button onClick={() => setQuickRange(30)} className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">30 Days</button>
            {(startDate || endDate) && (
              <button onClick={clearDates} className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">Clear</button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end mt-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${timezone === 'CST' ? 'text-gray-700' : 'text-gray-400'}`}>CST</span>
            <button onClick={() => setTimezone(timezone === 'CST' ? 'UTC' : 'CST')} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${timezone === 'UTC' ? 'bg-purple-600' : 'bg-gray-300'}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${timezone === 'UTC' ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
            </button>
            <span className={`text-xs font-medium ${timezone === 'UTC' ? 'text-gray-700' : 'text-gray-400'}`}>UTC</span>
          </div>
        </div>
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
            <div className="text-2xl font-bold text-green-600">{summary.popup.confirmed + summary.page.confirmed}</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500 mb-1">Pending</div>
            <div className="text-2xl font-bold text-yellow-600">{summary.popup.pending + summary.page.pending}</div>
          </div>
        </div>
      )}

      {/* Source Filter + Table */}
      {selectedRec && startDate && endDate && (
        <div className="bg-white rounded-lg border">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex gap-1">
              {(['all', 'popup', 'page'] as const).map(f => (
                <button key={f} onClick={() => setSourceFilter(f)} className={`px-3 py-1.5 text-sm rounded-lg ${sourceFilter === f ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                  {f === 'all' ? 'All' : f === 'popup' ? 'Popup' : 'Page'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{loading ? 'Loading...' : `Showing ${filteredReferrals.length} submissions`}</span>
              {filteredReferrals.length > 0 && (
                <button onClick={() => {
                  const header = 'Email,Date,Status,Source'
                  const rows = filteredReferrals.map(r => {
                    const formattedDate = new Date(r.subscribed_at).toLocaleDateString('en-CA', { timeZone: tz })
                    return `${r.subscriber_email},${formattedDate},${r.status},${sourceLabel(r.source)}`
                  })
                  const csv = [header, ...rows].join('\n')
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${selectedRec?.publication_name.replace(/[^a-zA-Z0-9]/g, '_')}_${startDate}_${endDate}.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                }} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
                  <Download className="w-3.5 h-3.5" />Export CSV
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
                    <th className="px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900" onClick={() => setSortAsc(!sortAsc)}>Date {sortAsc ? '\u2191' : '\u2193'}</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredReferrals.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs">{r.subscriber_email}</td>
                      <td className="px-4 py-2.5 text-gray-600">{new Date(r.subscribed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: tz })}</td>
                      <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(r.status)}`}>{r.status}</span></td>
                      <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sourceBadgeClass(r.source)}`}>{sourceLabel(r.source)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!selectedRec && (
        <div className="bg-white rounded-lg border p-12 text-center text-gray-500">
          Select a publication above to view submission details
        </div>
      )}
    </div>
  )
}
