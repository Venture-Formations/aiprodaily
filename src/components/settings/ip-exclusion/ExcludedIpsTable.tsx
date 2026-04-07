'use client'

import type { ExcludedIp } from './types'

interface ExcludedIpsTableProps {
  excludedIps: ExcludedIp[]
  currentPage: number
  setCurrentPage: (page: number | ((p: number) => number)) => void
  pageSize: number
  exporting: boolean
  onExportCSV: () => void
  onRemoveIp: (ipAddress: string) => void
  onSeeEmails: (ip: string) => void
}

export default function ExcludedIpsTable({
  excludedIps,
  currentPage,
  setCurrentPage,
  pageSize,
  exporting,
  onExportCSV,
  onRemoveIp,
  onSeeEmails,
}: ExcludedIpsTableProps) {
  const totalPages = Math.ceil(excludedIps.length / pageSize)

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">Excluded IP Addresses</h3>
        {excludedIps.length > 0 && (
          <button
            onClick={onExportCSV}
            disabled={exporting}
            className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 px-3 py-1.5 rounded text-sm font-medium"
          >
            {exporting ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </>
            )}
          </button>
        )}
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Activity from these IP addresses will still be recorded, but will be excluded from both poll analytics and link click analytics.
        Use this to filter out spam clickers, bots, or internal testing. You can exclude individual IPs or CIDR ranges.
      </p>

      {excludedIps.length === 0 ? (
        <p className="text-gray-500 text-sm italic">No excluded IP addresses</p>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">
              Showing {Math.min((currentPage - 1) * pageSize + 1, excludedIps.length)} - {Math.min(currentPage * pageSize, excludedIps.length)} of {excludedIps.length} excluded IPs
              {' '}({excludedIps.filter(ip => ip.is_range).length} ranges, {excludedIps.filter(ip => !ip.is_range).length} single IPs)
            </p>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Added</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {excludedIps.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((ip) => (
                  <tr key={ip.id}>
                    <td className="px-4 py-3 text-sm font-mono">
                      {ip.is_range ? `${ip.ip_address}/${ip.cidr_prefix}` : ip.ip_address}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {ip.is_range ? (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                          Range
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                          Single
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{ip.reason || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(ip.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => onSeeEmails(ip.is_range ? `${ip.ip_address}/${ip.cidr_prefix}` : ip.ip_address)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        See Emails
                      </button>
                      <button
                        onClick={() => onRemoveIp(ip.ip_address)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination controls */}
          {excludedIps.length > pageSize && (
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Previous
              </button>
              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1
                  })
                  .map((page, index, arr) => (
                    <span key={page} className="flex items-center">
                      {index > 0 && arr[index - 1] !== page - 1 && (
                        <span className="px-2 text-gray-400">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-md text-sm font-medium ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    </span>
                  ))}
              </div>
              <button
                onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  currentPage >= totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
