'use client'

import type { CompanyGroup } from './types'

interface SelectionModeInfoProps {
  moduleSelectionMode: string
  moduleNextPosition: number
  companyGroups: CompanyGroup[]
  onResetPosition: () => void
  onSetPosition: (newPos: number) => void
}

export default function SelectionModeInfo({
  moduleSelectionMode,
  moduleNextPosition,
  companyGroups,
  onResetPosition,
  onSetPosition,
}: SelectionModeInfoProps) {
  const modeLabels: Record<string, { label: string; description: string }> = {
    sequential: { label: 'Sequential', description: 'Companies rotate in order by position' },
    random: { label: 'Random', description: 'A random company is selected each time' },
    priority: { label: 'Priority', description: 'Highest priority company is selected first' },
    manual: { label: 'Manual', description: 'Admin selects ad manually per issue' }
  }
  const modeInfo = modeLabels[moduleSelectionMode] || modeLabels.sequential
  const nextCompany = moduleSelectionMode === 'sequential'
    ? companyGroups.find(g => g.display_order === moduleNextPosition) || companyGroups[0]
    : null
  const nextAd = nextCompany
    ? nextCompany.advertisements.find(ad => ad.display_order === nextCompany.next_ad_position) || nextCompany.advertisements[0]
    : null

  return (
    <div className={`mb-4 border rounded-lg p-4 ${moduleSelectionMode === 'sequential' ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm ${moduleSelectionMode === 'sequential' ? 'text-purple-800' : 'text-blue-800'}`}>
            <strong>Selection Mode:</strong> {modeInfo.label}
            <span className={`ml-2 ${moduleSelectionMode === 'sequential' ? 'text-purple-600' : 'text-blue-600'}`}>— {modeInfo.description}</span>
          </p>
          {moduleSelectionMode === 'sequential' && nextCompany && (
            <p className="text-sm text-purple-800 mt-1">
              <strong>Next company:</strong> Position {moduleNextPosition} — <span className="text-purple-600">{nextCompany.advertiser.company_name}</span>
              {nextAd && (
                <span className="ml-2 text-purple-600">| Next ad: {nextAd.title}</span>
              )}
            </p>
          )}
        </div>
        {moduleSelectionMode === 'sequential' && (
          <div className="flex items-center gap-2">
            <button
              onClick={onResetPosition}
              className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
            >
              Reset to #1
            </button>
            <input
              type="number"
              min="1"
              max={companyGroups.length}
              value={moduleNextPosition}
              onChange={(e) => {
                const newPos = parseInt(e.target.value) || 1
                onSetPosition(newPos)
              }}
              className="w-16 px-2 py-1 border border-purple-300 rounded text-center text-sm"
              title="Set next company position"
            />
          </div>
        )}
      </div>
    </div>
  )
}
