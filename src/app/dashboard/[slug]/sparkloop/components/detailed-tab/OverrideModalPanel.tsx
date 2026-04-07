'use client'

import type { Recommendation, Defaults } from './types'

interface OverrideModalPanelProps {
  overrideRec: Recommendation
  defaults: Defaults
  overrideCrValue: string
  setOverrideCrValue: (v: string) => void
  overrideRcrValue: string
  setOverrideRcrValue: (v: string) => void
  overrideSlipValue: string
  setOverrideSlipValue: (v: string) => void
  overrideSaving: boolean
  onSave: () => void
  onClose: () => void
}

export function OverrideModalPanel({
  overrideRec,
  defaults,
  overrideCrValue,
  setOverrideCrValue,
  overrideRcrValue,
  setOverrideRcrValue,
  overrideSlipValue,
  setOverrideSlipValue,
  overrideSaving,
  onSave,
  onClose,
}: OverrideModalPanelProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-1">Edit Default Overrides</h3>
        <p className="text-sm text-gray-500 mb-4">{overrideRec.publication_name}</p>
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">Overrides take highest priority — they replace both real data and defaults. Values shown in <span className="text-red-600 font-semibold">red</span> when overriding available real data.</p>

        {/* Current values display */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-gray-500">Our CR (calculated):</span>
            <span className="text-blue-600 font-medium">
              {overrideRec.our_cr !== null ? `${overrideRec.our_cr.toFixed(1)}%` : '-'}
              {overrideRec.impressions < 50 && <span className="text-gray-400 ml-1">(&lt;50 impressions)</span>}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">SparkLoop RCR:</span>
            <span>{overrideRec.sparkloop_rcr !== null ? `${overrideRec.sparkloop_rcr.toFixed(0)}%` : '-'}</span>
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
            <span className={overrideRec.cr_source === 'override_with_data' ? 'text-red-600' : overrideRec.cr_source === 'override' ? 'text-orange-600' : overrideRec.cr_source === 'ours' ? 'text-blue-600' : ''}>
              {overrideRec.effective_cr.toFixed(1)}% ({overrideRec.cr_source.replace('_with_data', '*')})
            </span>
          </div>
          <div className="flex justify-between font-medium">
            <span className="text-gray-700">Current effective RCR:</span>
            <span className={overrideRec.rcr_source === 'override_with_sl' ? 'text-red-600' : overrideRec.rcr_source === 'override' ? 'text-orange-600' : overrideRec.rcr_source === 'sparkloop' ? '' : ''}>
              {overrideRec.effective_rcr.toFixed(1)}% ({overrideRec.rcr_source.replace('_with_sl', '*')})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">All-time Slip (calculated):</span>
            <span className={overrideRec.alltime_slip < 15 ? 'text-green-600' : overrideRec.alltime_slip < 30 ? 'text-yellow-600' : 'text-red-600'}>
              {overrideRec.our_total_subscribes > 0 ? `${overrideRec.alltime_slip.toFixed(1)}%` : '-'}
            </span>
          </div>
          <div className="flex justify-between font-medium">
            <span className="text-gray-700">Current effective Slip:</span>
            <span className={overrideRec.slip_source === 'override_with_data' ? 'text-red-600' : overrideRec.slip_source === 'override' ? 'text-orange-600' : ''}>
              {overrideRec.effective_slip.toFixed(1)}% ({overrideRec.slip_source.replace('_with_data', '*')})
            </span>
          </div>
        </div>

        {/* Override inputs */}
        <div className="space-y-3 mb-5">
          <OverrideInput
            label="Override CR (%)"
            hint="always takes priority over all sources"
            placeholder="Leave empty to use global default"
            value={overrideCrValue}
            onChange={setOverrideCrValue}
            onClear={() => setOverrideCrValue('')}
          />
          <OverrideInput
            label="Override RCR (%)"
            hint="always takes priority over all sources"
            placeholder="Leave empty to use global default"
            value={overrideRcrValue}
            onChange={setOverrideRcrValue}
            onClear={() => setOverrideRcrValue('')}
          />
          <OverrideInput
            label="Override Slip (%)"
            hint="penalizes score for slippage"
            placeholder="Leave empty to use calculated"
            value={overrideSlipValue}
            onChange={setOverrideSlipValue}
            onClear={() => setOverrideSlipValue('')}
          />
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
            onClick={onSave}
            disabled={overrideSaving}
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {overrideSaving ? 'Saving...' : 'Save Overrides'}
          </button>
        </div>
      </div>
    </div>
  )
}

function OverrideInput({
  label,
  hint,
  placeholder,
  value,
  onChange,
  onClear,
}: {
  label: string
  hint: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  onClear: () => void
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">
        {label} <span className="text-gray-400 font-normal">{'\u2014'} {hint}</span>
      </label>
      <div className="flex gap-2">
        <input
          type="number"
          step="0.1"
          min="0"
          max="100"
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          onClick={onClear}
          className="px-3 py-2 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-600"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
