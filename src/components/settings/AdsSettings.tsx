'use client'

import { useAdsSettings, getQuantityLabel } from './useAdsSettings'

export default function AdsSettings() {
  const {
    loading,
    saving,
    message,
    editingId,
    editPrice,
    setEditPrice,
    adsPerNewsletter,
    setAdsPerNewsletter,
    savingAdsPerNewsletter,
    maxTopArticles,
    setMaxTopArticles,
    maxBottomArticles,
    setMaxBottomArticles,
    savingMaxArticles,
    tiersByFrequency,
    handleEdit,
    handleCancelEdit,
    handleSaveEdit,
    saveAdsPerNewsletter,
    saveMaxArticles,
  } = useAdsSettings()

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Pricing Configuration */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Advertisement Pricing Tiers</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure pricing for Community Business Spotlight advertisements. Prices are based on frequency type and quantity purchased.
        </p>

        <TierSection title="Single Appearance Pricing" tiers={tiersByFrequency.single} unitLabel="appearances" perLabel="each"
          editingId={editingId} editPrice={editPrice} setEditPrice={setEditPrice} saving={saving}
          onEdit={handleEdit} onSave={handleSaveEdit} onCancel={handleCancelEdit} />

        <TierSection title="Weekly Pricing" subtitle="Ad appears once per week (Sunday-Saturday)"
          tiers={tiersByFrequency.weekly} unitLabel="weeks" perLabel="per week"
          editingId={editingId} editPrice={editPrice} setEditPrice={setEditPrice} saving={saving}
          onEdit={handleEdit} onSave={handleSaveEdit} onCancel={handleCancelEdit} />

        <TierSection title="Monthly Pricing" subtitle="Ad appears once per calendar month"
          tiers={tiersByFrequency.monthly} unitLabel="months" perLabel="per month"
          editingId={editingId} editPrice={editPrice} setEditPrice={setEditPrice} saving={saving}
          onEdit={handleEdit} onSave={handleSaveEdit} onCancel={handleCancelEdit} />

        {message && (
          <div className={`p-4 rounded-md ${message.includes('successfully') ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {message}
          </div>
        )}
      </div>

      {/* Ads Per Publication Configuration */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Publication Ad Settings</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure how many advertisements appear in each publication. Total publication items (ads + articles) = 5.
        </p>
        <div className="flex items-center gap-4">
          <label className="font-medium text-gray-700">Ads per publication:</label>
          <input type="number" min="1" max="4" value={adsPerNewsletter}
            onChange={(e) => setAdsPerNewsletter(parseInt(e.target.value) || 1)}
            className="w-20 px-3 py-2 border border-gray-300 rounded-md" disabled={savingAdsPerNewsletter} />
          <button onClick={saveAdsPerNewsletter} disabled={savingAdsPerNewsletter}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300">
            {savingAdsPerNewsletter ? 'Saving...' : 'Save'}
          </button>
        </div>
        <div className="mt-4 bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Current configuration:</strong> {adsPerNewsletter} {adsPerNewsletter === 1 ? 'ad' : 'ads'} + {5 - adsPerNewsletter} {5 - adsPerNewsletter === 1 ? 'article' : 'articles'} = 5 total items
          </p>
        </div>
      </div>

      {/* Article Limit Settings */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Article Limit Settings</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure the maximum number of articles that can be selected for the Primary Articles and Secondary Articles sections in each newsletter issue.
        </p>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="font-medium text-gray-700 w-56">Max Articles in Primary Section:</label>
            <input type="number" min="1" max="10" value={maxTopArticles}
              onChange={(e) => setMaxTopArticles(parseInt(e.target.value) || 1)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-md" disabled={savingMaxArticles} />
            <span className="text-sm text-gray-500">(1-10)</span>
          </div>
          <div className="flex items-center gap-4">
            <label className="font-medium text-gray-700 w-56">Max Articles in Secondary Section:</label>
            <input type="number" min="1" max="10" value={maxBottomArticles}
              onChange={(e) => setMaxBottomArticles(parseInt(e.target.value) || 1)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-md" disabled={savingMaxArticles} />
            <span className="text-sm text-gray-500">(1-10)</span>
          </div>
          <button onClick={saveMaxArticles} disabled={savingMaxArticles}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300">
            {savingMaxArticles ? 'Saving...' : 'Save Article Limits'}
          </button>
        </div>
        <div className="mt-4 bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Current configuration:</strong> Primary Articles: {maxTopArticles}, Secondary Articles: {maxBottomArticles}
          </p>
          <p className="text-xs text-blue-700 mt-2">
            These limits control how many articles can be selected during RSS processing and on the issue detail page.
          </p>
        </div>
      </div>

      {/* Information Section */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-3">How Advertisement Pricing Works</h4>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>&bull; <strong>Single:</strong> Pay per individual appearance in the newsletter</li>
          <li>&bull; <strong>Weekly:</strong> Ad appears once per week (Sunday-Saturday) for the purchased number of weeks</li>
          <li>&bull; <strong>Monthly:</strong> Ad appears once per calendar month for the purchased number of months</li>
          <li>&bull; Volume discounts apply automatically based on quantity purchased</li>
          <li>&bull; All ads are reviewed before approval and must meet content guidelines</li>
          <li>&bull; Ads appear in the &quot;Community Business Spotlight&quot; section</li>
        </ul>
      </div>
    </div>
  )
}

function TierSection({ title, subtitle, tiers, unitLabel, perLabel, editingId, editPrice, setEditPrice, saving, onEdit, onSave, onCancel }: {
  title: string; subtitle?: string; tiers: any[]; unitLabel: string; perLabel: string
  editingId: string | null; editPrice: string; setEditPrice: (v: string) => void; saving: boolean
  onEdit: (t: any) => void; onSave: (id: string) => void; onCancel: () => void
}) {
  return (
    <div className="mb-6">
      <h4 className="font-medium text-gray-900 mb-3">{title}</h4>
      {subtitle && <p className="text-xs text-gray-500 mb-2">{subtitle}</p>}
      <div className="space-y-2">
        {tiers.map(tier => (
          <div key={tier.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
            <div className="flex-1">
              <span className="font-medium">{getQuantityLabel(tier)} {unitLabel}</span>
            </div>
            <div className="flex items-center gap-3">
              {editingId === tier.id ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">$</span>
                    <input type="number" step="0.01" min="0" value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="w-24 px-2 py-1 border border-gray-300 rounded" disabled={saving} />
                    <span className="text-gray-500">{perLabel}</span>
                  </div>
                  <button onClick={() => onSave(tier.id)} disabled={saving}
                    className="text-green-600 hover:text-green-700 font-medium disabled:text-gray-400">Save</button>
                  <button onClick={onCancel} disabled={saving}
                    className="text-gray-600 hover:text-gray-700 disabled:text-gray-400">Cancel</button>
                </>
              ) : (
                <>
                  <span className="font-semibold">${parseFloat(tier.price_per_unit).toFixed(2)} {perLabel}</span>
                  <button onClick={() => onEdit(tier)} className="text-blue-600 hover:text-blue-700 font-medium">Edit</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
