'use client'

import type { DetectedScanner } from './types'

interface DetectedScannersPanelProps {
  detectedScanners: DetectedScanner[]
  onExcludeKnownScanner: (scanner: DetectedScanner) => void
}

export default function DetectedScannersPanel({
  detectedScanners,
  onExcludeKnownScanner,
}: DetectedScannersPanelProps) {
  if (detectedScanners.length === 0) return null

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-orange-900 mb-2">
        Detected Email Security Scanners
      </h3>
      <p className="text-sm text-orange-800 mb-4">
        We detected activity from known email security services. These services scan links in emails
        before delivery, creating false clicks. Click &quot;Exclude All Ranges&quot; to block all their IP ranges.
      </p>

      <div className="space-y-3">
        {detectedScanners.map((scanner) => (
          <div
            key={scanner.organization}
            className="bg-white rounded-lg border border-orange-200 p-4 flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{scanner.organization}</span>
                <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                  {scanner.type === 'email_scanner' ? 'Email Scanner' : scanner.type}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {scanner.ip_count} IP{scanner.ip_count !== 1 ? 's' : ''} detected •
                {' '}{scanner.total_activity} total activities •
                {' '}{scanner.recommended_ranges.length} range{scanner.recommended_ranges.length !== 1 ? 's' : ''} to exclude
              </p>
              <p className="text-xs text-gray-500 mt-1 font-mono">
                Ranges: {scanner.recommended_ranges.slice(0, 3).join(', ')}
                {scanner.recommended_ranges.length > 3 && ` +${scanner.recommended_ranges.length - 3} more`}
              </p>
            </div>
            <button
              onClick={() => onExcludeKnownScanner(scanner)}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded text-sm font-medium whitespace-nowrap"
            >
              Exclude All Ranges
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
