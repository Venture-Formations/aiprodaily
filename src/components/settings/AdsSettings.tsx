'use client'

import { useState, useEffect } from 'react'

export default function AdsSettings() {
  const [tiers, setTiers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [adsPerNewsletter, setAdsPerNewsletter] = useState<number>(1)
  const [savingAdsPerNewsletter, setSavingAdsPerNewsletter] = useState(false)
  const [maxTopArticles, setMaxTopArticles] = useState<number>(3)
  const [maxBottomArticles, setMaxBottomArticles] = useState<number>(3)
  const [savingMaxArticles, setSavingMaxArticles] = useState(false)

  useEffect(() => {
    loadTiers()
    loadAdsPerNewsletter()
    loadMaxArticles()
  }, [])

  const loadTiers = async () => {
    try {
      const response = await fetch('/api/settings/ad-pricing')
      if (response.ok) {
        const data = await response.json()
        setTiers(data.tiers || [])
      }
    } catch (error) {
      console.error('Failed to load pricing tiers:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAdsPerNewsletter = async () => {
    try {
      const response = await fetch('/api/settings/email')
      if (response.ok) {
        const data = await response.json()
        const setting = data.settings.find((s: any) => s.key === 'ads_per_newsletter')
        if (setting) {
          setAdsPerNewsletter(parseInt(setting.value))
        }
      }
    } catch (error) {
      console.error('Failed to load ads per newsletter:', error)
    }
  }

  const saveAdsPerNewsletter = async () => {
    if (adsPerNewsletter < 1 || adsPerNewsletter > 4) {
      alert('Ads per newsletter must be between 1 and 4')
      return
    }

    setSavingAdsPerNewsletter(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ads_per_newsletter: adsPerNewsletter.toString()
        })
      })

      if (response.ok) {
        setMessage('Ads per newsletter updated successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to update setting')
      }
    } catch (error) {
      setMessage('Failed to update ads per newsletter. Please try again.')
      console.error('Save error:', error)
    } finally {
      setSavingAdsPerNewsletter(false)
    }
  }

  const loadMaxArticles = async () => {
    try {
      const response = await fetch('/api/settings/email')
      if (response.ok) {
        const data = await response.json()

        // Data is a flat object, not { settings: [...] }
        if (data.max_top_articles) {
          setMaxTopArticles(parseInt(data.max_top_articles))
        }
        if (data.max_bottom_articles) {
          setMaxBottomArticles(parseInt(data.max_bottom_articles))
        }
      }
    } catch (error) {
      console.error('Failed to load max articles settings:', error)
    }
  }

  const saveMaxArticles = async () => {
    if (maxTopArticles < 1 || maxTopArticles > 10) {
      alert('Max primary articles must be between 1 and 10')
      return
    }
    if (maxBottomArticles < 1 || maxBottomArticles > 10) {
      alert('Max secondary articles must be between 1 and 10')
      return
    }

    setSavingMaxArticles(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_top_articles: maxTopArticles.toString(),
          max_bottom_articles: maxBottomArticles.toString()
        })
      })

      if (response.ok) {
        setMessage('Max articles settings updated successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to update settings')
      }
    } catch (error) {
      setMessage('Failed to update max articles settings. Please try again.')
      console.error('Save error:', error)
    } finally {
      setSavingMaxArticles(false)
    }
  }

  const handleEdit = (tier: any) => {
    setEditingId(tier.id)
    setEditPrice(tier.price_per_unit.toString())
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditPrice('')
  }

  const handleSaveEdit = async (tierId: string) => {
    if (!editPrice || isNaN(parseFloat(editPrice))) {
      alert('Please enter a valid price')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/ad-pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tierId,
          price_per_unit: parseFloat(editPrice)
        })
      })

      if (response.ok) {
        setMessage('Price updated successfully!')
        setTimeout(() => setMessage(''), 3000)
        setEditingId(null)
        setEditPrice('')
        loadTiers()
      } else {
        throw new Error('Failed to update price')
      }
    } catch (error) {
      setMessage('Failed to update price. Please try again.')
      console.error('Save error:', error)
    } finally {
      setSaving(false)
    }
  }

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'single': return 'Single Appearance'
      case 'weekly': return 'Weekly'
      case 'monthly': return 'Monthly'
      default: return frequency
    }
  }

  const getQuantityLabel = (tier: any) => {
    if (tier.max_quantity === null) {
      return `${tier.min_quantity}+`
    }
    return `${tier.min_quantity}-${tier.max_quantity}`
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  // Group tiers by frequency
  const tiersByFrequency = {
    single: tiers.filter(t => t.frequency === 'single'),
    weekly: tiers.filter(t => t.frequency === 'weekly'),
    monthly: tiers.filter(t => t.frequency === 'monthly')
  }

  return (
    <div className="space-y-6">
      {/* Pricing Configuration */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Advertisement Pricing Tiers</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure pricing for Community Business Spotlight advertisements. Prices are based on frequency type and quantity purchased.
        </p>

        {/* Single Appearance Tiers */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Single Appearance Pricing</h4>
          <div className="space-y-2">
            {tiersByFrequency.single.map(tier => (
              <div key={tier.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                <div className="flex-1">
                  <span className="font-medium">{getQuantityLabel(tier)} appearances</span>
                </div>
                <div className="flex items-center gap-3">
                  {editingId === tier.id ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded"
                          disabled={saving}
                        />
                        <span className="text-gray-500">each</span>
                      </div>
                      <button
                        onClick={() => handleSaveEdit(tier.id)}
                        disabled={saving}
                        className="text-green-600 hover:text-green-700 font-medium disabled:text-gray-400"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="text-gray-600 hover:text-gray-700 disabled:text-gray-400"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">${parseFloat(tier.price_per_unit).toFixed(2)} each</span>
                      <button
                        onClick={() => handleEdit(tier)}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Tiers */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Weekly Pricing</h4>
          <p className="text-xs text-gray-500 mb-2">Ad appears once per week (Sunday-Saturday)</p>
          <div className="space-y-2">
            {tiersByFrequency.weekly.map(tier => (
              <div key={tier.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                <div className="flex-1">
                  <span className="font-medium">{getQuantityLabel(tier)} weeks</span>
                </div>
                <div className="flex items-center gap-3">
                  {editingId === tier.id ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded"
                          disabled={saving}
                        />
                        <span className="text-gray-500">per week</span>
                      </div>
                      <button
                        onClick={() => handleSaveEdit(tier.id)}
                        disabled={saving}
                        className="text-green-600 hover:text-green-700 font-medium disabled:text-gray-400"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="text-gray-600 hover:text-gray-700 disabled:text-gray-400"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">${parseFloat(tier.price_per_unit).toFixed(2)} per week</span>
                      <button
                        onClick={() => handleEdit(tier)}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Tiers */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Monthly Pricing</h4>
          <p className="text-xs text-gray-500 mb-2">Ad appears once per calendar month</p>
          <div className="space-y-2">
            {tiersByFrequency.monthly.map(tier => (
              <div key={tier.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                <div className="flex-1">
                  <span className="font-medium">{getQuantityLabel(tier)} months</span>
                </div>
                <div className="flex items-center gap-3">
                  {editingId === tier.id ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded"
                          disabled={saving}
                        />
                        <span className="text-gray-500">per month</span>
                      </div>
                      <button
                        onClick={() => handleSaveEdit(tier.id)}
                        disabled={saving}
                        className="text-green-600 hover:text-green-700 font-medium disabled:text-gray-400"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="text-gray-600 hover:text-gray-700 disabled:text-gray-400"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">${parseFloat(tier.price_per_unit).toFixed(2)} per month</span>
                      <button
                        onClick={() => handleEdit(tier)}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-md ${
            message.includes('successfully')
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
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
          <input
            type="number"
            min="1"
            max="4"
            value={adsPerNewsletter}
            onChange={(e) => setAdsPerNewsletter(parseInt(e.target.value) || 1)}
            className="w-20 px-3 py-2 border border-gray-300 rounded-md"
            disabled={savingAdsPerNewsletter}
          />
          <button
            onClick={saveAdsPerNewsletter}
            disabled={savingAdsPerNewsletter}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300"
          >
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
            <input
              type="number"
              min="1"
              max="10"
              value={maxTopArticles}
              onChange={(e) => setMaxTopArticles(parseInt(e.target.value) || 1)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-md"
              disabled={savingMaxArticles}
            />
            <span className="text-sm text-gray-500">(1-10)</span>
          </div>

          <div className="flex items-center gap-4">
            <label className="font-medium text-gray-700 w-56">Max Articles in Secondary Section:</label>
            <input
              type="number"
              min="1"
              max="10"
              value={maxBottomArticles}
              onChange={(e) => setMaxBottomArticles(parseInt(e.target.value) || 1)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-md"
              disabled={savingMaxArticles}
            />
            <span className="text-sm text-gray-500">(1-10)</span>
          </div>

          <button
            onClick={saveMaxArticles}
            disabled={savingMaxArticles}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300"
          >
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
          <li>• <strong>Single:</strong> Pay per individual appearance in the newsletter</li>
          <li>• <strong>Weekly:</strong> Ad appears once per week (Sunday-Saturday) for the purchased number of weeks</li>
          <li>• <strong>Monthly:</strong> Ad appears once per calendar month for the purchased number of months</li>
          <li>• Volume discounts apply automatically based on quantity purchased</li>
          <li>• All ads are reviewed before approval and must meet content guidelines</li>
          <li>• Ads appear in the &quot;Community Business Spotlight&quot; section</li>
        </ul>
      </div>
    </div>
  )
}
