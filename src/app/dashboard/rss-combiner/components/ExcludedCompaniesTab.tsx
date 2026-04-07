'use client'

import type { ExcludedCompany } from '../types'

interface ExcludedCompaniesTabProps {
  excludedCompanies: ExcludedCompany[]
  newExcludedTicker: string
  setNewExcludedTicker: (s: string) => void
  newExcludedCompanyName: string
  setNewExcludedCompanyName: (s: string) => void
  editingCompanyId: string | null
  setEditingCompanyId: (id: string | null) => void
  editCompanyTicker: string
  setEditCompanyTicker: (s: string) => void
  editCompanyName: string
  setEditCompanyName: (s: string) => void
  handleAddExcludedCompany: () => void
  handleEditExcludedCompany: (id: string) => void
  handleDeleteExcludedCompany: (id: string) => void
}

export function ExcludedCompaniesTab({
  excludedCompanies,
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
}: ExcludedCompaniesTabProps) {
  return (
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
  )
}
