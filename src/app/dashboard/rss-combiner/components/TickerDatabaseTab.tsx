'use client'

import { TICKERS_PER_PAGE } from '../constants'
import type { TickerMapping } from '../types'

interface TickerDatabaseTabProps {
  tickers: TickerMapping[]
  filteredTickers: TickerMapping[]
  tickerSearch: string
  setTickerSearch: (s: string) => void
  tickerPage: number
  setTickerPage: (p: number | ((p: number) => number)) => void
  newTicker: string
  setNewTicker: (s: string) => void
  newTickerName: string
  setNewTickerName: (s: string) => void
  editingTickerId: string | null
  setEditingTickerId: (id: string | null) => void
  editTickerName: string
  setEditTickerName: (s: string) => void
  tickerUploading: boolean
  tickerUploadResult: any
  handleTickerCSVUpload: (e: React.FormEvent<HTMLFormElement>) => void
  handleAddTicker: () => void
  handleEditTicker: (id: string) => void
  handleDeleteTicker: (id: string) => void
  unknownTickers: { ticker: string; raw_company: string }[]
  confirmingTicker: { ticker: string; name: string } | null
  setConfirmingTicker: (t: { ticker: string; name: string } | null) => void
  handleConfirmUnknownTicker: (ticker: string, companyName: string) => void
  excludedTickerSet: Set<string>
  handleToggleExclude: (ticker: string) => void
}

export function TickerDatabaseTab({
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
  unknownTickers,
  confirmingTicker,
  setConfirmingTicker,
  handleConfirmUnknownTicker,
  excludedTickerSet,
  handleToggleExclude,
}: TickerDatabaseTabProps) {
  const tickerTotalPages = Math.ceil(filteredTickers.length / TICKERS_PER_PAGE)
  const paginatedTickers = filteredTickers.slice(
    tickerPage * TICKERS_PER_PAGE,
    (tickerPage + 1) * TICKERS_PER_PAGE
  )

  return (
    <div className="space-y-6">
      {/* Unknown Tickers */}
      {unknownTickers.length > 0 && (
        <div className="bg-amber-50 rounded-lg border border-amber-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-200">
            <h2 className="text-sm font-medium text-amber-800">
              Unknown Tickers ({unknownTickers.length})
            </h2>
            <p className="text-xs text-amber-600 mt-0.5">
              These tickers from uploaded trades don&apos;t have a name mapping. Confirm or edit the company name to add them.
            </p>
          </div>
          <div className="divide-y divide-amber-100">
            {unknownTickers.map((ut) => (
              <div key={ut.ticker} className="px-4 py-2 flex items-center gap-3">
                <span className="font-mono font-medium text-sm text-gray-900 w-20">{ut.ticker}</span>
                {confirmingTicker?.ticker === ut.ticker ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={confirmingTicker.name}
                      onChange={(e) => setConfirmingTicker({ ...confirmingTicker, name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConfirmUnknownTicker(ut.ticker, confirmingTicker.name)
                        if (e.key === 'Escape') setConfirmingTicker(null)
                      }}
                      autoFocus
                      className="flex-1 px-2 py-1 text-sm border border-amber-300 rounded"
                    />
                    <button
                      onClick={() => handleConfirmUnknownTicker(ut.ticker, confirmingTicker.name)}
                      disabled={!confirmingTicker.name.trim()}
                      className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setConfirmingTicker(null)}
                      className="px-3 py-1 text-xs font-medium text-gray-600 bg-white rounded border border-gray-300 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-600 truncate">{ut.raw_company}</span>
                    <button
                      onClick={() => setConfirmingTicker({ ticker: ut.ticker, name: ut.raw_company })}
                      className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded border border-blue-200 hover:bg-blue-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleConfirmUnknownTicker(ut.ticker, ut.raw_company)}
                      className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700"
                    >
                      Confirm
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Ticker */}
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

      {/* Bulk Import */}
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
                            onClick={() => handleToggleExclude(t.ticker)}
                            className={`text-xs ${
                              excludedTickerSet.has(t.ticker.toUpperCase())
                                ? 'text-green-600 hover:text-green-800'
                                : 'text-orange-500 hover:text-orange-700'
                            }`}
                          >
                            {excludedTickerSet.has(t.ticker.toUpperCase()) ? 'Include' : 'Exclude'}
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
  )
}
