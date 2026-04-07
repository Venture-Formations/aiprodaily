'use client'

import type { ApprovedSource } from '../types'

interface ApprovedSourcesTabProps {
  approvedSources: ApprovedSource[]
  newApprovedName: string
  setNewApprovedName: (s: string) => void
  newApprovedDomain: string
  setNewApprovedDomain: (s: string) => void
  handleAddApprovedSource: () => void
  handleDeleteApprovedSource: (id: string) => void
  handleToggleApprovedSource: (id: string, is_active: boolean) => void
}

export function ApprovedSourcesTab({
  approvedSources,
  newApprovedName,
  setNewApprovedName,
  newApprovedDomain,
  setNewApprovedDomain,
  handleAddApprovedSource,
  handleDeleteApprovedSource,
  handleToggleApprovedSource,
}: ApprovedSourcesTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-2">Add Approved Source</h2>
        <p className="text-xs text-gray-500 mb-3">
          Only articles from approved source domains will be stored during ingestion.
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Source Name</label>
            <input
              type="text"
              value={newApprovedName}
              onChange={(e) => setNewApprovedName(e.target.value)}
              placeholder="Yahoo Finance"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Domain</label>
            <input
              type="text"
              value={newApprovedDomain}
              onChange={(e) => setNewApprovedDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddApprovedSource()}
              placeholder="finance.yahoo.com"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-mono"
            />
          </div>
          <button
            onClick={handleAddApprovedSource}
            disabled={!newApprovedName.trim() || !newApprovedDomain.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-700">
            Approved Sources ({approvedSources.length})
          </h2>
        </div>
        {approvedSources.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">No approved sources yet.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Source Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Domain</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Active</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {approvedSources.map((s) => (
                <tr key={s.id} className={!s.is_active ? 'bg-gray-50 opacity-60' : ''}>
                  <td className="px-4 py-2 text-gray-900">{s.source_name}</td>
                  <td className="px-4 py-2 text-gray-500 font-mono text-xs">{s.source_domain}</td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => handleToggleApprovedSource(s.id, !s.is_active)}
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        s.is_active
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {s.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDeleteApprovedSource(s.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      Delete
                    </button>
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
