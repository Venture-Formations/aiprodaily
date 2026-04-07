'use client'

import EmailsByIPModal from '@/components/EmailsByIPModal'
import { useIPExclusion } from './ip-exclusion/useIPExclusion'
import ExcludedIpsTable from './ip-exclusion/ExcludedIpsTable'
import SuggestionsTable from './ip-exclusion/SuggestionsTable'
import DetectedScannersPanel from './ip-exclusion/DetectedScannersPanel'

export default function IPExclusionSettings() {
  const {
    excludedIps,
    suggestions,
    detectedScanners,
    publicationId,
    loading,
    newIp,
    setNewIp,
    newReason,
    setNewReason,
    message,
    messageType,
    emailModalIp,
    setEmailModalIp,
    currentPage,
    setCurrentPage,
    exporting,
    PAGE_SIZE,
    handleAddIp,
    handleRemoveIp,
    handleExcludeSuggestion,
    handleDismissSuggestion,
    handleExportCSV,
    handleExcludeKnownScanner,
  } = useIPExclusion()

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-6"></div>
          <div className="space-y-3">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-md ${
          messageType === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* Add IP Form + Excluded IPs Table */}
      <div>
        {/* Add IP Form (above the table) */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-0 rounded-b-none border-b-0">
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddIp()}
                placeholder="Enter IP or CIDR range (e.g., 192.168.1.1 or 192.168.1.0/24)"
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono"
              />
              <button
                onClick={handleAddIp}
                disabled={!newIp.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm font-medium whitespace-nowrap"
              >
                Add IP
              </button>
            </div>
            <input
              type="text"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="Reason (optional, e.g., 'spam clicker', 'internal testing')"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <ExcludedIpsTable
          excludedIps={excludedIps}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          pageSize={PAGE_SIZE}
          exporting={exporting}
          onExportCSV={handleExportCSV}
          onRemoveIp={handleRemoveIp}
          onSeeEmails={(ip) => setEmailModalIp(ip)}
        />
      </div>

      {/* Detected Known Scanners */}
      <DetectedScannersPanel
        detectedScanners={detectedScanners}
        onExcludeKnownScanner={handleExcludeKnownScanner}
      />

      {/* Suggested IPs */}
      <SuggestionsTable
        suggestions={suggestions}
        onExcludeSuggestion={handleExcludeSuggestion}
        onDismissSuggestion={handleDismissSuggestion}
        onSeeEmails={(ip) => setEmailModalIp(ip)}
      />

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">How IP Exclusion Works:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li><strong>Activity is still recorded:</strong> Excluded IPs can still vote and click links, but their activity won&apos;t be counted in analytics.</li>
          <li><strong>Applies to:</strong> Both poll response analytics and link click analytics.</li>
          <li><strong>CIDR ranges:</strong> Use CIDR notation (e.g., 192.168.1.0/24) to exclude entire IP ranges.</li>
          <li><strong>Useful for:</strong> Filtering out spam clickers, auto-clickers, bots, or internal testing.</li>
          <li><strong>Per-publication:</strong> Each publication has its own exclusion list.</li>
          <li><strong>Auditable:</strong> Click &quot;See Emails&quot; to view all email addresses associated with an IP.</li>
          <li><strong>Suggestions:</strong> IPs with multiple emails interacting within seconds are flagged as likely email security scanners.</li>
        </ul>
      </div>

      {/* Email Modal */}
      {emailModalIp && publicationId && (
        <EmailsByIPModal
          isOpen={!!emailModalIp}
          onClose={() => setEmailModalIp(null)}
          ipAddress={emailModalIp}
          publicationId={publicationId}
        />
      )}
    </div>
  )
}
