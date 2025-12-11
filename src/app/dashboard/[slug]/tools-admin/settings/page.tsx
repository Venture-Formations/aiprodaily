'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import Link from 'next/link'
import { ArrowLeft, DollarSign, Calendar, Save, RotateCcw } from 'lucide-react'

interface PricingSettings {
  paidPlacementPrice: number
  featuredPrice: number
  yearlyDiscountMonths: number
}

export default function ToolsSettingsPage() {
  const [settings, setSettings] = useState<PricingSettings>({
    paidPlacementPrice: 30,
    featuredPrice: 60,
    yearlyDiscountMonths: 2
  })
  const [originalSettings, setOriginalSettings] = useState<PricingSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    setLoading(true)
    try {
      const res = await fetch('/api/tools/settings')
      const data = await res.json()
      if (data.success) {
        setSettings(data.settings)
        setOriginalSettings(data.settings)
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
      setMessage({ type: 'error', text: 'Failed to load settings' })
    }
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/tools/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      const data = await res.json()
      if (data.success) {
        setOriginalSettings(settings)
        setMessage({ type: 'success', text: 'Settings saved successfully!' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' })
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      setMessage({ type: 'error', text: 'Failed to save settings' })
    }
    setSaving(false)
  }

  function handleReset() {
    if (originalSettings) {
      setSettings(originalSettings)
    }
  }

  const hasChanges = originalSettings && (
    settings.paidPlacementPrice !== originalSettings.paidPlacementPrice ||
    settings.featuredPrice !== originalSettings.featuredPrice ||
    settings.yearlyDiscountMonths !== originalSettings.yearlyDiscountMonths
  )

  // Computed yearly prices
  const paidPlacementYearlyPrice = settings.paidPlacementPrice * (12 - settings.yearlyDiscountMonths)
  const featuredYearlyPrice = settings.featuredPrice * (12 - settings.yearlyDiscountMonths)

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="../tools-admin"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Tools Admin
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Directory Pricing Settings
          </h1>
          <p className="text-gray-600">
            Configure pricing for tool listing upgrades. Changes will apply to all pricing displays.
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Settings Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 space-y-8">
            {/* Paid Placement Pricing */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Paid Placement</h2>
                  <p className="text-sm text-gray-500">Page 1 placement in the directory</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-12">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monthly Price ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={settings.paidPlacementPrice}
                      onChange={(e) => setSettings({ ...settings, paidPlacementPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Yearly Price (computed)
                  </label>
                  <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                    ${paidPlacementYearlyPrice}/year
                    <span className="text-sm text-gray-500 ml-2">
                      ({12 - settings.yearlyDiscountMonths} months)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* Featured Pricing */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Featured Listing</h2>
                  <p className="text-sm text-gray-500">#1 position in category with premium styling</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-12">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monthly Price ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={settings.featuredPrice}
                      onChange={(e) => setSettings({ ...settings, featuredPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Yearly Price (computed)
                  </label>
                  <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                    ${featuredYearlyPrice}/year
                    <span className="text-sm text-gray-500 ml-2">
                      ({12 - settings.yearlyDiscountMonths} months)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* Yearly Discount */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Yearly Discount</h2>
                  <p className="text-sm text-gray-500">Number of free months when paying yearly</p>
                </div>
              </div>
              <div className="pl-12">
                <div className="max-w-xs">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Free Months
                  </label>
                  <select
                    value={settings.yearlyDiscountMonths}
                    onChange={(e) => setSettings({ ...settings, yearlyDiscountMonths: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map(n => (
                      <option key={n} value={n}>
                        {n} month{n !== 1 ? 's' : ''} free ({12 - n} months paid)
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Yearly subscribers pay for {12 - settings.yearlyDiscountMonths} months, get {settings.yearlyDiscountMonths} months free.
                </p>
              </div>
            </div>
          </div>

          {/* Footer with Save/Reset */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {hasChanges ? (
                <span className="text-amber-600 font-medium">You have unsaved changes</span>
              ) : (
                <span>All changes saved</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                disabled={!hasChanges || saving}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pricing Preview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Paid Placement Preview */}
            <div className="bg-white rounded-lg border-2 border-blue-500 p-6">
              <h3 className="font-semibold text-gray-900 mb-1">Paid Placement</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900">${settings.paidPlacementPrice}</span>
                <span className="text-gray-500">/mo</span>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                or ${paidPlacementYearlyPrice}/year (save ${settings.paidPlacementPrice * settings.yearlyDiscountMonths})
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>Page 1 placement</li>
                <li>Priority search</li>
                <li>Cancel anytime</li>
              </ul>
            </div>

            {/* Featured Preview */}
            <div className="bg-white rounded-lg border-2 border-amber-500 p-6">
              <h3 className="font-semibold text-gray-900 mb-1">Featured</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900">${settings.featuredPrice}</span>
                <span className="text-gray-500">/mo</span>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                or ${featuredYearlyPrice}/year (save ${settings.featuredPrice * settings.yearlyDiscountMonths})
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>#1 in category</li>
                <li>Featured badge</li>
                <li>Highlighted card</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
