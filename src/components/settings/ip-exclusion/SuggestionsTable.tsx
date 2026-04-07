'use client'

import type { IpSuggestion } from './types'

interface SuggestionsTableProps {
  suggestions: IpSuggestion[]
  onExcludeSuggestion: (ipAddress: string, reason: string) => void
  onDismissSuggestion: (ipAddress: string) => void
  onSeeEmails: (ip: string) => void
}

function getSuspicionBadgeColor(level: 'high' | 'medium') {
  return level === 'high'
    ? 'bg-red-100 text-red-800'
    : 'bg-yellow-100 text-yellow-800'
}

export default function SuggestionsTable({
  suggestions,
  onExcludeSuggestion,
  onDismissSuggestion,
  onSeeEmails,
}: SuggestionsTableProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Suggested IPs to Exclude</h3>
      <p className="text-sm text-gray-600 mb-4">
        These IPs show suspicious patterns like multiple different email addresses interacting within seconds -
        typically indicating email security scanners (Barracuda, Mimecast, etc.) or bots.
      </p>

      {suggestions.length === 0 ? (
        <p className="text-gray-500 text-sm italic">No suspicious IPs detected - your data looks clean!</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Emails</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Suspicion</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {suggestions.map((suggestion) => (
                <tr key={suggestion.ip_address} className={suggestion.known_scanner ? 'bg-orange-50' : ''}>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-mono">{suggestion.ip_address}</div>
                    {suggestion.known_scanner && (
                      <span className="inline-flex mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                        {suggestion.known_scanner.organization}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600" title={`${suggestion.poll_votes} poll votes, ${suggestion.link_clicks} link clicks`}>
                    {suggestion.total_activity}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{suggestion.unique_emails}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSuspicionBadgeColor(suggestion.suspicion_level)}`}>
                      {suggestion.suspicion_level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs" title={suggestion.reason}>
                    {suggestion.reason}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => onSeeEmails(suggestion.ip_address)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      See Emails
                    </button>
                    <button
                      onClick={() => onExcludeSuggestion(
                        suggestion.known_scanner?.recommended_cidr || suggestion.ip_address,
                        suggestion.reason
                      )}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                      title={suggestion.known_scanner ? `Exclude range ${suggestion.known_scanner.recommended_cidr}` : 'Exclude this IP'}
                    >
                      {suggestion.known_scanner ? 'Exclude Range' : 'Exclude'}
                    </button>
                    <button
                      onClick={() => onDismissSuggestion(suggestion.ip_address)}
                      className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                    >
                      Dismiss
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
