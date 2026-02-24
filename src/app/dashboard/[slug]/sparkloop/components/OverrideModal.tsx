'use client'

import { useState } from 'react'

interface Recommendation {
  id: string
  publication_name: string
  our_cr: number | null
  sparkloop_rcr: number | null
  impressions: number
  effective_cr: number
  effective_rcr: number
  cr_source: string
  rcr_source: string
  override_cr: number | null
  override_rcr: number | null
}

interface Defaults {
  cr: number
  rcr: number
}

interface OverrideModalProps {
  recommendation: Recommendation
  defaults: Defaults
  onClose: () => void
  onRefresh: () => void
}

export default function OverrideModal({ recommendation, defaults, onClose, onRefresh }: OverrideModalProps) {
  const [overrideCrValue, setOverrideCrValue] = useState(
    recommendation.override_cr !== null && recommendation.override_cr !== undefined
      ? String(recommendation.override_cr)
      : ''
  )
  const [overrideRcrValue, setOverrideRcrValue] = useState(
    recommendation.override_rcr !== null && recommendation.override_rcr !== undefined
      ? String(recommendation.override_rcr)
      : ''
  )
  const [saving, setSaving] = useState(false)

  async function saveOverrides() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        id: recommendation.id,
        action: 'set_overrides',
      }
      body.override_cr = overrideCrValue.trim() === '' ? null : parseFloat(overrideCrValue)
      body.override_rcr = overrideRcrValue.trim() === '' ? null : parseFloat(overrideRcrValue)

      const res = await fetch('/api/sparkloop/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        onClose()
        onRefresh()
      } else {
        alert('Save failed: ' + data.error)
      }
    } catch {
      alert('Save failed')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-1">Edit Default Overrides</h3>
        <p className="text-sm text-gray-500 mb-4">{recommendation.publication_name}</p>
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">Overrides take highest priority -- they replace both real data and defaults. Values shown in <span className="text-red-600 font-semibold">red</span> when overriding available real data.</p>

        {/* Current values display */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-gray-500">Our CR (calculated):</span>
            <span className="text-blue-600 font-medium">
              {recommendation.our_cr !== null ? `${recommendation.our_cr.toFixed(1)}%` : '-'}
              {recommendation.impressions < 50 && <span className="text-gray-400 ml-1">(&lt;50 impressions)</span>}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">SparkLoop RCR:</span>
            <span>{recommendation.sparkloop_rcr !== null ? `${recommendation.sparkloop_rcr.toFixed(0)}%` : '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Default CR:</span>
            <span>{defaults.cr}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Default RCR:</span>
            <span>{defaults.rcr}%</span>
          </div>
          <div className="border-t pt-1.5 flex justify-between font-medium">
            <span className="text-gray-700">Current effective CR:</span>
            <span className={recommendation.cr_source === 'override_with_data' ? 'text-red-600' : recommendation.cr_source === 'override' ? 'text-orange-600' : recommendation.cr_source === 'ours' ? 'text-blue-600' : ''}>
              {recommendation.effective_cr.toFixed(1)}% ({recommendation.cr_source.replace('_with_data', '*')})
            </span>
          </div>
          <div className="flex justify-between font-medium">
            <span className="text-gray-700">Current effective RCR:</span>
            <span className={recommendation.rcr_source === 'override_with_sl' ? 'text-red-600' : recommendation.rcr_source === 'override' ? 'text-orange-600' : ''}>
              {recommendation.effective_rcr.toFixed(1)}% ({recommendation.rcr_source.replace('_with_sl', '*')})
            </span>
          </div>
        </div>

        {/* Override inputs */}
        <div className="space-y-3 mb-5">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Override CR (%) <span className="text-gray-400 font-normal">-- always takes priority over all sources</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="Leave empty to use global default"
                value={overrideCrValue}
                onChange={e => setOverrideCrValue(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={() => setOverrideCrValue('')}
                className="px-3 py-2 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-600"
              >
                Clear
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Override RCR (%) <span className="text-gray-400 font-normal">-- always takes priority over all sources</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="Leave empty to use global default"
                value={overrideRcrValue}
                onChange={e => setOverrideRcrValue(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={() => setOverrideRcrValue('')}
                className="px-3 py-2 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-600"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={saveOverrides}
            disabled={saving}
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Overrides'}
          </button>
        </div>
      </div>
    </div>
  )
}
