'use client'

interface CompanyFieldProps {
  currentCompanyName?: string | null
  advertiserId?: string | null
  advertisers: Array<{ id: string; company_name: string }>
  selectedAdvertiserId: string
  setSelectedAdvertiserId: (id: string) => void
  newCompanyName: string
  setNewCompanyName: (name: string) => void
  companyMode: 'existing' | 'new'
  setCompanyMode: (mode: 'existing' | 'new') => void
  companyName?: string | null
}

export default function CompanyField({
  currentCompanyName,
  advertiserId,
  advertisers,
  selectedAdvertiserId,
  setSelectedAdvertiserId,
  newCompanyName,
  setNewCompanyName,
  companyMode,
  setCompanyMode,
  companyName,
}: CompanyFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Company
      </label>
      <div className="space-y-3">
        {/* Current company display */}
        {currentCompanyName && (
          <p className="text-sm text-gray-600">
            Current: <span className="font-medium">{currentCompanyName}</span>
          </p>
        )}
        {!currentCompanyName && companyName && (
          <p className="text-sm text-gray-600">
            Current: <span className="font-medium">{companyName}</span>
          </p>
        )}

        {/* Mode toggle */}
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="editCompanyMode"
              checked={companyMode === 'new'}
              onChange={() => setCompanyMode('new')}
              className="text-blue-600"
            />
            <span className="text-sm text-gray-700">{advertiserId || companyName ? 'Change Company' : 'New Company'}</span>
          </label>
          {advertisers.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="editCompanyMode"
                checked={companyMode === 'existing'}
                onChange={() => setCompanyMode('existing')}
                className="text-blue-600"
              />
              <span className="text-sm text-gray-700">Select Existing</span>
            </label>
          )}
        </div>

        {/* New company input */}
        {companyMode === 'new' && (
          <input
            type="text"
            value={newCompanyName}
            onChange={(e) => setNewCompanyName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Enter company name"
          />
        )}

        {/* Existing company dropdown */}
        {companyMode === 'existing' && advertisers.length > 0 && (
          <select
            value={selectedAdvertiserId}
            onChange={(e) => setSelectedAdvertiserId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Select a company...</option>
            {advertisers.map(adv => (
              <option key={adv.id} value={adv.id}>
                {adv.company_name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}
