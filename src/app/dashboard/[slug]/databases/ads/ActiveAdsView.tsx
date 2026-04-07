'use client'

import type { AdWithRelations, CompanyGroup } from './types'

interface ActiveAdsViewProps {
  companyGroups: CompanyGroup[]
  expandedCompanies: Set<string>
  moduleSelectionMode: string
  moduleNextPosition: number
  onToggleExpanded: (companyId: string) => void
  onCompanyDragStart: (e: React.DragEvent<HTMLDivElement>, index: number) => void
  onCompanyDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  onCompanyDrop: (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => void
  onAdDragStart: (e: React.DragEvent<HTMLDivElement>, companyId: string, index: number) => void
  onAdDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  onAdDrop: (e: React.DragEvent<HTMLDivElement>, companyId: string, dropIndex: number) => void
  onPreview: (ad: AdWithRelations) => void
  onEdit: (ad: AdWithRelations) => void
  onDelete: (adId: string) => void
  onSetNextAdPosition: (companyAdvertiserId: string, newPos: number) => void
}

export default function ActiveAdsView({
  companyGroups,
  expandedCompanies,
  moduleSelectionMode,
  moduleNextPosition,
  onToggleExpanded,
  onCompanyDragStart,
  onCompanyDragOver,
  onCompanyDrop,
  onAdDragStart,
  onAdDragOver,
  onAdDrop,
  onPreview,
  onEdit,
  onDelete,
  onSetNextAdPosition,
}: ActiveAdsViewProps) {
  if (companyGroups.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <p className="text-gray-500">No active advertisements found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {companyGroups.map((company, companyIndex) => {
        const isNextCompany = moduleSelectionMode === 'sequential' && company.display_order === moduleNextPosition
        const isExpanded = expandedCompanies.has(company.advertiser_id)

        return (
          <div
            key={company.advertiser_id}
            draggable
            onDragStart={(e) => onCompanyDragStart(e, companyIndex)}
            onDragOver={onCompanyDragOver}
            onDrop={(e) => onCompanyDrop(e, companyIndex)}
            className={`bg-white rounded-lg shadow transition-shadow ${
              isNextCompany ? 'ring-2 ring-purple-400' : ''
            }`}
          >
            {/* Company Header */}
            <div
              className={`flex items-center gap-3 p-4 cursor-pointer select-none ${
                isNextCompany ? 'bg-purple-50' : 'hover:bg-gray-50'
              }`}
              onClick={() => onToggleExpanded(company.advertiser_id)}
            >
              <span className="text-lg text-gray-400 cursor-move" title="Drag to reorder">&#9776;</span>
              <span className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded font-bold text-gray-600 text-sm">
                {companyIndex + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {company.advertiser.company_name}
                  </h3>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {company.advertisements.length} {company.advertisements.length === 1 ? 'ad' : 'ads'}
                  </span>
                  {isNextCompany && (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-200 text-purple-800">
                      NEXT COMPANY
                    </span>
                  )}
                  {company.paid && company.frequency !== 'single' && (
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                      company.times_paid > 0 && company.times_used >= company.times_paid
                        ? 'bg-gray-200 text-gray-600'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {company.frequency === 'weekly' ? 'Weekly' : 'Monthly'} Sponsor — {company.times_used}/{company.times_paid} used
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Used {company.times_used}x
                  {company.last_used_date && (
                    <span> | Last: {new Date(company.last_used_date).toLocaleDateString()}</span>
                  )}
                </p>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Expanded: Ads within company */}
            {isExpanded && (
              <div className="border-t border-gray-100 px-4 pb-4">
                {/* Internal ad rotation position control */}
                {company.advertisements.length > 1 && (
                  <div className="flex items-center gap-2 py-2 text-xs text-gray-500">
                    <span>Next ad position:</span>
                    <input
                      type="number"
                      min="1"
                      max={company.advertisements.length}
                      value={company.next_ad_position}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const newPos = parseInt(e.target.value) || 1
                        onSetNextAdPosition(company.advertiser_id, newPos)
                      }}
                      className="w-12 px-1 py-0.5 border border-gray-200 rounded text-center text-xs"
                    />
                  </div>
                )}

                <div className="space-y-2 mt-1">
                  {company.advertisements.map((ad, adIndex) => {
                    const isNextAd = ad.display_order === company.next_ad_position
                    return (
                      <div
                        key={ad.id}
                        draggable
                        onDragStart={(e) => onAdDragStart(e, company.advertiser_id, adIndex)}
                        onDragOver={onAdDragOver}
                        onDrop={(e) => onAdDrop(e, company.advertiser_id, adIndex)}
                        className={`rounded-lg border p-3 cursor-move hover:shadow transition-shadow ${
                          isNextAd ? 'border-purple-300 bg-purple-50/50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-sm text-gray-400">&#9776;</span>
                            <span className="w-6 h-6 flex items-center justify-center bg-gray-50 rounded text-xs font-medium text-gray-500">
                              {adIndex + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-gray-900 truncate">{ad.title}</h4>
                                {isNextAd && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-purple-100 text-purple-700 flex-shrink-0">
                                    NEXT AD
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 truncate">
                                {ad.times_used}x used
                                {ad.last_used_date && ` | Last: ${new Date(ad.last_used_date).toLocaleDateString()}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0 ml-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); onPreview(ad as AdWithRelations) }}
                              className="bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 text-xs"
                            >
                              Preview
                            </button>
                            <a
                              href={`/ads/${ad.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 text-xs"
                            >
                              Analytics
                            </a>
                            <button
                              onClick={(e) => { e.stopPropagation(); onEdit(ad as AdWithRelations) }}
                              className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 text-xs"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDelete(ad.id) }}
                              className="bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700 text-xs"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
