'use client'

import { Download, Settings2, Search, X, Calendar, Ban, Pause, Play, Pencil, RefreshCw, CheckCircle } from 'lucide-react'
import { toLocalDateStr } from '@/lib/date-utils'
import { MS_PER_DAY, STATUS_FILTERS, DATE_FILTERED_COLUMNS } from './constants'
import { getColumnWidthClass } from './utils'
import { useDetailedTabState } from './useDetailedTabState'
import { CellRenderer } from './CellRenderer'
import { OverrideModalPanel } from './OverrideModalPanel'
import { DefaultsEditor } from './DefaultsEditor'
import { GlobalStatsBar } from './GlobalStatsBar'
import type { DetailedTabProps } from './types'

export default function DetailedTab({ recommendations, globalStats, defaults, loading, onRefresh, publicationId }: DetailedTabProps) {
  const state = useDetailedTabState({ recommendations, onRefresh, publicationId })

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
            value={state.searchQuery}
            onChange={(e) => state.setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {state.searchQuery && (
            <button onClick={() => state.setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex gap-1">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => state.setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg capitalize ${
                state.statusFilter === s
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
          onClick={() => state.setShowColumnSelector(!state.showColumnSelector)}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg ${
            state.showColumnSelector ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          Columns
        </button>

        {/* CSV export */}
        <button
          onClick={state.exportToCSV}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          <Download className="w-3.5 h-3.5" />
          CSV
        </button>

        {/* Results count */}
        <span className="text-xs text-gray-500 ml-auto">
          {state.filteredAndSorted.length} of {recommendations.length} recommendations
        </span>
      </div>

      {/* Bulk actions bar */}
      {state.selectedIds.size > 0 && (
        <div className="flex items-center gap-2 mb-4 p-2 bg-gray-50 rounded-lg border">
          <span className="text-sm text-gray-600 font-medium">{state.selectedIds.size} selected</span>
          <div className="flex gap-1 ml-auto">
            <button
              onClick={() => state.bulkAction('pause')}
              disabled={state.actionLoading === 'bulk'}
              className="flex items-center gap-1 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 text-xs disabled:opacity-50"
            >
              <Pause className="w-3.5 h-3.5" /> Pause
            </button>
            <button
              onClick={() => state.bulkAction('exclude')}
              disabled={state.actionLoading === 'bulk'}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs disabled:opacity-50"
            >
              <Ban className="w-3.5 h-3.5" /> Exclude
            </button>
            <button
              onClick={() => state.bulkAction('reactivate')}
              disabled={state.actionLoading === 'bulk'}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Reactivate
            </button>
          </div>
        </div>
      )}

      {/* Date Range Picker */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Calendar className="w-4 h-4 text-gray-400" />
        <button
          onClick={() => state.setQuickRange(7)}
          className={`px-2 py-1 text-xs rounded-lg ${
            state.dateRangeActive && state.dateStart === toLocalDateStr(new Date(Date.now() - 6 * MS_PER_DAY))
              ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          7 Days
        </button>
        <button
          onClick={() => state.setQuickRange(30)}
          className={`px-2 py-1 text-xs rounded-lg ${
            state.dateRangeActive && state.dateStart === toLocalDateStr(new Date(Date.now() - 29 * MS_PER_DAY))
              ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          30 Days
        </button>
        <span className="text-xs text-gray-300">|</span>
        <input
          type="date"
          value={state.dateStart}
          onChange={(e) => state.setDateStart(e.target.value)}
          className="px-2 py-1 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <span className="text-xs text-gray-400">to</span>
        <input
          type="date"
          value={state.dateEnd}
          onChange={(e) => state.setDateEnd(e.target.value)}
          className="px-2 py-1 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        {(state.dateStart || state.dateEnd) && (
          <button
            onClick={state.clearDateRange}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
        <span className="text-xs text-gray-300">|</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-medium ${state.timezone === 'CST' ? 'text-gray-700' : 'text-gray-400'}`}>CST</span>
          <button
            role="switch"
            aria-checked={state.timezone === 'UTC'}
            aria-label="Timezone: toggle between CT and UTC"
            onClick={() => state.setTimezone(state.timezone === 'CST' ? 'UTC' : 'CST')}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              state.timezone === 'UTC' ? 'bg-purple-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                state.timezone === 'UTC' ? 'translate-x-[18px]' : 'translate-x-[3px]'
              }`}
            />
          </button>
          <span className={`text-xs font-medium ${state.timezone === 'UTC' ? 'text-gray-700' : 'text-gray-400'}`}>UTC</span>
        </div>
        {state.dateRangeLoading && (
          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-gray-300 border-t-purple-500" />
        )}
        {state.dateRangeActive && !state.dateRangeLoading && (
          <span className="px-2 py-0.5 text-[10px] rounded-full bg-purple-100 text-purple-700">
            Filtered: Popup Impr/Subs/CR, Page Impr/Subs/CR, Conf, Rej, Pend
          </span>
        )}
      </div>

      {/* Global stats bar */}
      {globalStats && (
        <GlobalStatsBar
          globalStats={globalStats}
          dateRangeActive={state.dateRangeActive}
          rangeStats={state.rangeStats}
          dateStart={state.dateStart}
          dateEnd={state.dateEnd}
          dateRangeMetrics={state.dateRangeMetrics}
          recommendations={recommendations}
        />
      )}

      {/* Default CR/RCR Controls */}
      <DefaultsEditor
        defaults={defaults}
        editingDefaultCr={state.editingDefaultCr}
        setEditingDefaultCr={state.setEditingDefaultCr}
        defaultCrInput={state.defaultCrInput}
        setDefaultCrInput={state.setDefaultCrInput}
        editingDefaultRcr={state.editingDefaultRcr}
        setEditingDefaultRcr={state.setEditingDefaultRcr}
        defaultRcrInput={state.defaultRcrInput}
        setDefaultRcrInput={state.setDefaultRcrInput}
        editingDefaultMcb={state.editingDefaultMcb}
        setEditingDefaultMcb={state.setEditingDefaultMcb}
        defaultMcbInput={state.defaultMcbInput}
        setDefaultMcbInput={state.setDefaultMcbInput}
        defaultSaving={state.defaultSaving}
        saveDefault={state.saveDefault}
      />

      {/* Column Selector */}
      {state.showColumnSelector && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-xs font-semibold mb-2">Select Columns to Display</h3>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5">
            {state.columns.map(col => (
              <label key={col.key} className="flex items-center space-x-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={col.enabled}
                  onChange={() => state.toggleColumn(col.key)}
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
              <th className="px-2 py-2 text-left w-8">
                <input
                  type="checkbox"
                  checked={state.selectedIds.size === state.filteredAndSorted.length && state.filteredAndSorted.length > 0}
                  onChange={state.selectAll}
                  className="rounded"
                />
              </th>
              {state.enabledColumns.map(col => (
                <th
                  key={col.key}
                  onClick={() => state.handleSort(col.key)}
                  className={`px-2 py-2 text-left text-[11px] font-medium text-gray-500 cursor-pointer hover:bg-gray-100 whitespace-nowrap ${getColumnWidthClass(col.width)}`}
                >
                  <div className="flex items-center gap-1" title={col.label}>
                    <span className="truncate">
                      {col.label}
                      {state.dateRangeActive && DATE_FILTERED_COLUMNS.has(col.key) ? '*' : ''}
                    </span>
                    <span className="text-gray-400 flex-shrink-0">
                      {state.sortColumn === col.key ? (
                        state.sortDirection === 'desc' ? '\u25BC' : '\u25B2'
                      ) : null}
                    </span>
                  </div>
                </th>
              ))}
              <th className="px-2 py-2 text-center text-[11px] font-medium text-gray-500 w-24 whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={state.totalColumns} className="px-4 py-8 text-center text-gray-500 text-sm">
                  Loading...
                </td>
              </tr>
            ) : state.filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={state.totalColumns} className="px-4 py-8 text-center text-gray-500 text-sm">
                  No recommendations found
                </td>
              </tr>
            ) : (
              state.filteredAndSorted.map(rec => (
                <tr
                  key={rec.id}
                  className={`hover:bg-gray-50 ${rec.excluded ? 'bg-red-50/50' : rec.status === 'paused' && rec.paused_reason === 'manual' ? 'bg-yellow-50/50' : ''}`}
                >
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={state.selectedIds.has(rec.id)}
                      onChange={() => state.toggleSelect(rec.id)}
                      className="rounded"
                    />
                  </td>
                  {state.enabledColumns.map(col => (
                    <td
                      key={col.key}
                      className={`px-2 py-1.5 text-xs whitespace-nowrap ${getColumnWidthClass(col.width)}`}
                    >
                      <CellRenderer
                        rec={rec}
                        columnKey={col.key}
                        dateRangeActive={state.dateRangeActive}
                        onToggleModuleEligible={state.handleToggleModuleEligible}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center">
                    {state.actionLoading === rec.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin inline" />
                    ) : (
                      <div className="flex items-center justify-center gap-0.5">
                        {rec.excluded || rec.status === 'paused' ? (
                          <button
                            onClick={() => state.handleReactivate(rec)}
                            title="Reactivate"
                            className="p-1 rounded text-green-600 hover:bg-green-100"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => state.handlePause(rec)}
                              title="Pause"
                              className="p-1 rounded text-yellow-600 hover:bg-yellow-100"
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => state.handleExclude(rec)}
                              title="Exclude"
                              className="p-1 rounded text-red-600 hover:bg-red-100"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => state.openOverrideModal(rec)}
                          title="Edit overrides"
                          className="p-1 rounded text-gray-500 hover:bg-gray-100"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-3 text-[10px] text-gray-500">
        <strong>Score</strong> = CR x CPA x RCR x (1 - Slip%) |
        <span className="text-blue-600 ml-1">Blue</span> = popup data |
        <span className="text-teal-600 ml-1">Teal</span> = page data |
        <span className="text-orange-600 ml-1">Orange</span> = override (no real data) |
        <span className="text-red-600 ml-1">Red</span> = override (real data available)
        {state.dateRangeActive && (
          <>
            {' | '}
            <span className="text-purple-600">* Purple</span> = filtered by date range ({state.dateStart} to {state.dateEnd})
          </>
        )}
      </div>

      {/* Override Modal */}
      {state.overrideRec && (
        <OverrideModalPanel
          overrideRec={state.overrideRec}
          defaults={defaults}
          overrideCrValue={state.overrideCrValue}
          setOverrideCrValue={state.setOverrideCrValue}
          overrideRcrValue={state.overrideRcrValue}
          setOverrideRcrValue={state.setOverrideRcrValue}
          overrideSlipValue={state.overrideSlipValue}
          setOverrideSlipValue={state.setOverrideSlipValue}
          overrideSaving={state.overrideSaving}
          onSave={state.saveOverrides}
          onClose={() => state.setOverrideRec(null)}
        />
      )}
    </div>
  )
}
