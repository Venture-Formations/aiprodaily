'use client'

import { useState, useEffect, useMemo } from 'react'
import { Download, Settings2, Search, X } from 'lucide-react'

interface Recommendation {
  id: string
  ref_code: string
  publication_name: string
  publication_logo: string | null
  description: string | null
  type: 'free' | 'paid'
  status: 'active' | 'paused'
  cpa: number | null
  sparkloop_rcr: number | null
  max_payout: number | null
  screening_period: number | null
  excluded: boolean
  excluded_reason: string | null
  impressions: number
  submissions: number
  confirms: number
  rejections: number
  our_cr: number | null
  our_rcr: number | null
  sparkloop_confirmed: number
  sparkloop_pending: number
  sparkloop_rejected: number
  sparkloop_earnings: number
  sparkloop_net_earnings: number
  our_total_subscribes: number
  our_confirms: number
  our_rejections: number
  our_pending: number
  remaining_budget_dollars: number | null
  last_synced_at: string | null
  calculated_score: number
  effective_cr: number
  effective_rcr: number
  cr_source: string
  rcr_source: string
  unique_ips: number
}

interface GlobalStats {
  uniqueIps: number
  avgOffersSelected: number
}

interface Column {
  key: string
  label: string
  enabled: boolean
  exportable: boolean
  width?: 'xs' | 'sm' | 'md' | 'lg'
}

interface DetailedTabProps {
  recommendations: Recommendation[]
  globalStats: GlobalStats | null
  loading: boolean
}

const DEFAULT_COLUMNS: Column[] = [
  { key: 'publication_name', label: 'Newsletter', enabled: true, exportable: true, width: 'lg' },
  { key: 'ref_code', label: 'Ref Code', enabled: false, exportable: true, width: 'md' },
  { key: 'type', label: 'Type', enabled: false, exportable: true, width: 'xs' },
  { key: 'status', label: 'Status', enabled: true, exportable: true, width: 'sm' },
  { key: 'cpa', label: 'CPA', enabled: true, exportable: true, width: 'xs' },
  { key: 'screening_period', label: 'Screening', enabled: false, exportable: true, width: 'xs' },
  { key: 'sparkloop_rcr', label: 'SL RCR', enabled: true, exportable: true, width: 'sm' },
  { key: 'our_rcr', label: 'Our RCR', enabled: true, exportable: true, width: 'sm' },
  { key: 'effective_rcr', label: 'Eff. RCR', enabled: false, exportable: true, width: 'sm' },
  { key: 'rcr_source', label: 'RCR Source', enabled: false, exportable: true, width: 'sm' },
  { key: 'our_cr', label: 'Our CR', enabled: true, exportable: true, width: 'sm' },
  { key: 'effective_cr', label: 'Eff. CR', enabled: false, exportable: true, width: 'sm' },
  { key: 'cr_source', label: 'CR Source', enabled: false, exportable: true, width: 'sm' },
  { key: 'calculated_score', label: 'Score', enabled: true, exportable: true, width: 'sm' },
  { key: 'impressions', label: 'Impressions', enabled: true, exportable: true, width: 'xs' },
  { key: 'submissions', label: 'Submissions', enabled: true, exportable: true, width: 'xs' },
  { key: 'our_total_subscribes', label: 'Our Subs', enabled: true, exportable: true, width: 'xs' },
  { key: 'our_confirms', label: 'Our Conf', enabled: true, exportable: true, width: 'xs' },
  { key: 'our_rejections', label: 'Our Rej', enabled: true, exportable: true, width: 'xs' },
  { key: 'our_pending', label: 'Our Pend', enabled: true, exportable: true, width: 'xs' },
  { key: 'sparkloop_confirmed', label: 'SL Confirmed', enabled: false, exportable: true, width: 'xs' },
  { key: 'sparkloop_rejected', label: 'SL Rejected', enabled: false, exportable: true, width: 'xs' },
  { key: 'sparkloop_pending', label: 'SL Pending', enabled: false, exportable: true, width: 'xs' },
  { key: 'sparkloop_earnings', label: 'Earnings', enabled: true, exportable: true, width: 'sm' },
  { key: 'sparkloop_net_earnings', label: 'Net Earnings', enabled: false, exportable: true, width: 'sm' },
  { key: 'remaining_budget_dollars', label: 'Budget Left', enabled: true, exportable: true, width: 'sm' },
  { key: 'max_payout', label: 'Max Payout', enabled: false, exportable: true, width: 'sm' },
  { key: 'unique_ips', label: 'Unique IPs', enabled: true, exportable: true, width: 'xs' },
  { key: 'excluded', label: 'Excluded', enabled: false, exportable: true, width: 'xs' },
  { key: 'excluded_reason', label: 'Excl. Reason', enabled: false, exportable: true, width: 'md' },
  { key: 'last_synced_at', label: 'Last Synced', enabled: false, exportable: true, width: 'md' },
]

const getColumnWidthClass = (width?: 'xs' | 'sm' | 'md' | 'lg') => {
  switch (width) {
    case 'xs': return 'w-14 min-w-[3.5rem] max-w-[4rem]'
    case 'sm': return 'w-20 min-w-[5rem] max-w-[6rem]'
    case 'md': return 'w-28 min-w-[7rem] max-w-[8rem]'
    case 'lg': return 'w-44 min-w-[11rem] max-w-[14rem]'
    default: return 'w-24'
  }
}

export default function DetailedTab({ recommendations, globalStats, loading }: DetailedTabProps) {
  const [columns, setColumns] = useState<Column[]>(DEFAULT_COLUMNS)
  const [sortColumn, setSortColumn] = useState<string | null>('calculated_score')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'excluded' | 'paused'>('all')

  const enabledColumns = columns.filter(col => col.enabled)

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(columnKey)
      setSortDirection('desc')
    }
  }

  const toggleColumn = (key: string) => {
    setColumns(columns.map(col =>
      col.key === key ? { ...col, enabled: !col.enabled } : col
    ))
  }

  const filteredAndSorted = useMemo(() => {
    let result = [...recommendations]

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(r =>
        r.publication_name.toLowerCase().includes(q) ||
        r.ref_code.toLowerCase().includes(q)
      )
    }

    // Status filter
    if (statusFilter === 'active') {
      result = result.filter(r => r.status === 'active' && !r.excluded)
    } else if (statusFilter === 'excluded') {
      result = result.filter(r => r.excluded)
    } else if (statusFilter === 'paused') {
      result = result.filter(r => r.status === 'paused' && !r.excluded)
    }

    // Sort
    if (sortColumn) {
      result.sort((a, b) => {
        const aVal = a[sortColumn as keyof Recommendation]
        const bVal = b[sortColumn as keyof Recommendation]

        if (aVal === null || aVal === undefined || aVal === '') {
          return sortDirection === 'asc' ? 1 : -1
        }
        if (bVal === null || bVal === undefined || bVal === '') {
          return sortDirection === 'asc' ? -1 : 1
        }

        // Date columns
        if (sortColumn === 'last_synced_at') {
          const dateA = new Date(aVal as string).getTime()
          const dateB = new Date(bVal as string).getTime()
          return sortDirection === 'asc' ? dateA - dateB : dateB - dateA
        }

        // Numbers
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
        }

        // Boolean
        if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
          return sortDirection === 'asc'
            ? (aVal === bVal ? 0 : aVal ? 1 : -1)
            : (aVal === bVal ? 0 : aVal ? -1 : 1)
        }

        // Strings
        const strA = String(aVal).toLowerCase()
        const strB = String(bVal).toLowerCase()
        return sortDirection === 'asc'
          ? strA.localeCompare(strB)
          : strB.localeCompare(strA)
      })
    }

    return result
  }, [recommendations, searchQuery, statusFilter, sortColumn, sortDirection])

  const getColumnValue = (rec: Recommendation, key: string): string => {
    const value = rec[key as keyof Recommendation]
    if (value === null || value === undefined) return ''
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'

    // Currency formatting for export
    if (key === 'cpa' || key === 'max_payout') {
      return ((value as number) / 100).toFixed(2)
    }
    if (key === 'sparkloop_earnings' || key === 'sparkloop_net_earnings') {
      return ((value as number) / 100).toFixed(2)
    }
    if (key === 'calculated_score') {
      return (value as number).toFixed(4)
    }
    if (key === 'our_cr' || key === 'our_rcr' || key === 'sparkloop_rcr' || key === 'effective_cr' || key === 'effective_rcr') {
      return `${(value as number).toFixed(1)}%`
    }
    if (key === 'remaining_budget_dollars') {
      return (value as number).toFixed(2)
    }

    return String(value)
  }

  const exportToCSV = () => {
    const exportCols = columns.filter(col => col.enabled && col.exportable)
    const headers = exportCols.map(col => col.label).join(',')

    const rows = filteredAndSorted.map(rec => {
      return exportCols.map(col => {
        const value = getColumnValue(rec, col.key)
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }).join(',')
    })

    const csv = [headers, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `sparkloop-detailed-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const renderCellContent = (rec: Recommendation, columnKey: string) => {
    switch (columnKey) {
      case 'publication_name':
        return (
          <div className="flex items-center gap-2">
            {rec.publication_logo && (
              <img src={rec.publication_logo} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
            )}
            <span className="truncate">{rec.publication_name}</span>
          </div>
        )

      case 'status':
        if (rec.excluded) {
          return <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700">Excluded</span>
        }
        if (rec.status === 'paused') {
          return <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-yellow-100 text-yellow-700">Paused</span>
        }
        return <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-green-100 text-green-700">Active</span>

      case 'cpa':
        return rec.cpa !== null ? `$${(rec.cpa / 100).toFixed(2)}` : '-'

      case 'max_payout':
        return rec.max_payout !== null ? `$${(rec.max_payout / 100).toFixed(2)}` : '-'

      case 'screening_period':
        return rec.screening_period ? `${rec.screening_period}d` : '-'

      case 'sparkloop_rcr':
        return rec.sparkloop_rcr !== null ? `${rec.sparkloop_rcr.toFixed(0)}%` : '-'

      case 'our_rcr':
        return rec.our_rcr !== null
          ? <span className="text-blue-600 font-medium">{rec.our_rcr.toFixed(1)}%</span>
          : '-'

      case 'effective_rcr':
        return `${rec.effective_rcr.toFixed(1)}%`

      case 'rcr_source':
        return rec.rcr_source === 'ours' ? (
          <span className="text-blue-600">ours</span>
        ) : rec.rcr_source === 'sparkloop' ? 'SL' : 'default'

      case 'our_cr':
        return rec.our_cr !== null
          ? <span className="text-blue-600 font-medium">{rec.our_cr.toFixed(1)}%</span>
          : '-'

      case 'effective_cr':
        return `${rec.effective_cr.toFixed(1)}%`

      case 'cr_source':
        return rec.cr_source === 'ours' ? (
          <span className="text-blue-600">ours</span>
        ) : 'default'

      case 'calculated_score':
        return <span className="font-mono font-medium">${rec.calculated_score.toFixed(4)}</span>

      case 'our_total_subscribes':
        return <span className="text-blue-600">{rec.our_total_subscribes}</span>

      case 'our_confirms':
        return <span className="text-green-600 font-medium">{rec.our_confirms}</span>

      case 'our_rejections':
        return <span className="text-red-600">{rec.our_rejections}</span>

      case 'our_pending':
        return <span className="text-yellow-600">{rec.our_pending}</span>

      case 'sparkloop_confirmed':
        return <span className="text-green-600/60">{rec.sparkloop_confirmed}</span>

      case 'sparkloop_rejected':
        return <span className="text-red-600/60">{rec.sparkloop_rejected}</span>

      case 'sparkloop_pending':
        return <span className="text-yellow-600/60">{rec.sparkloop_pending}</span>

      case 'sparkloop_earnings':
        return rec.sparkloop_earnings ? `$${(rec.sparkloop_earnings / 100).toFixed(2)}` : '-'

      case 'sparkloop_net_earnings':
        return rec.sparkloop_net_earnings ? `$${(rec.sparkloop_net_earnings / 100).toFixed(2)}` : '-'

      case 'remaining_budget_dollars':
        if (rec.remaining_budget_dollars === null || rec.remaining_budget_dollars === undefined) return '-'
        return `$${rec.remaining_budget_dollars.toFixed(2)}`

      case 'excluded':
        return rec.excluded ? 'Yes' : 'No'

      case 'last_synced_at':
        if (!rec.last_synced_at) return '-'
        return new Date(rec.last_synced_at).toLocaleDateString()

      case 'type':
        return rec.type === 'paid' ? (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-700">Paid</span>
        ) : (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-700">Free</span>
        )

      default: {
        const value = rec[columnKey as keyof Recommendation]
        if (value === null || value === undefined) return '-'
        if (typeof value === 'number') return value.toLocaleString()
        return String(value)
      }
    }
  }

  return (
    <div className="py-4">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search newsletters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex gap-1">
          {(['all', 'active', 'excluded', 'paused'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg capitalize ${
                statusFilter === s
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Column selector toggle */}
        <button
          onClick={() => setShowColumnSelector(!showColumnSelector)}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg ${
            showColumnSelector ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          Columns
        </button>

        {/* CSV export */}
        <button
          onClick={exportToCSV}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          <Download className="w-3.5 h-3.5" />
          CSV
        </button>

        {/* Results count */}
        <span className="text-xs text-gray-500 ml-auto">
          {filteredAndSorted.length} of {recommendations.length} recommendations
        </span>
      </div>

      {/* Global stats bar */}
      {globalStats && (
        <div className="flex gap-4 mb-4 text-xs text-gray-600">
          <span>Global Unique IPs: <strong>{globalStats.uniqueIps}</strong></span>
          <span>Avg Offers Selected: <strong>{globalStats.avgOffersSelected.toFixed(1)}</strong></span>
        </div>
      )}

      {/* Column Selector */}
      {showColumnSelector && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-xs font-semibold mb-2">Select Columns to Display</h3>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5">
            {columns.map(col => (
              <label key={col.key} className="flex items-center space-x-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={col.enabled}
                  onChange={() => toggleColumn(col.key)}
                  className="rounded border-gray-300"
                />
                <span>{col.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              {enabledColumns.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-2 py-2 text-left text-[11px] font-medium text-gray-500 cursor-pointer hover:bg-gray-100 whitespace-nowrap ${getColumnWidthClass(col.width)}`}
                >
                  <div className="flex items-center gap-1">
                    <span className="truncate">{col.label}</span>
                    <span className="text-gray-400 flex-shrink-0">
                      {sortColumn === col.key ? (
                        sortDirection === 'desc' ? '▼' : '▲'
                      ) : null}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={enabledColumns.length} className="px-4 py-8 text-center text-gray-500 text-sm">
                  Loading...
                </td>
              </tr>
            ) : filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={enabledColumns.length} className="px-4 py-8 text-center text-gray-500 text-sm">
                  No recommendations found
                </td>
              </tr>
            ) : (
              filteredAndSorted.map(rec => (
                <tr
                  key={rec.id}
                  className={`hover:bg-gray-50 ${rec.excluded ? 'bg-red-50/50' : ''}`}
                >
                  {enabledColumns.map(col => (
                    <td
                      key={col.key}
                      className={`px-2 py-1.5 text-xs whitespace-nowrap ${getColumnWidthClass(col.width)}`}
                    >
                      {renderCellContent(rec, col.key)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-3 text-[10px] text-gray-500">
        <strong>Score</strong> = CR x CPA x RCR (expected revenue per impression) |
        <span className="text-blue-600 ml-1">Blue values</span> = calculated from our data (20+ samples)
      </div>
    </div>
  )
}
