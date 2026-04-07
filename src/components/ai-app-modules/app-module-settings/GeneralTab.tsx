'use client'

import AIAppSelectionModeEditor from '../AIAppSelectionModeEditor'
import type {
  AIAppModule,
  AIAppSelectionMode,
  ProductCardLayoutMode
} from '@/types/database'

interface GeneralTabProps {
  localModule: AIAppModule
  saving: boolean
  showName: boolean
  deleteConfirm: boolean
  deleteText: string
  setDeleteConfirm: (v: boolean) => void
  setDeleteText: (v: string) => void
  onSelectionModeChange: (mode: AIAppSelectionMode) => void
  onShowNameToggle: () => void
  onSettingChange: (key: 'apps_count' | 'max_per_category' | 'affiliate_cooldown_days', value: number) => void
  onLayoutModeChange: (value: ProductCardLayoutMode) => void
  onToggle: (key: 'show_in_directory' | 'include_in_archive' | 'show_emoji' | 'show_numbers') => void
  onDelete: () => void
}

function Toggle({ enabled, onClick, disabled }: { enabled: boolean; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-cyan-500' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export default function GeneralTab({
  localModule,
  saving,
  showName,
  deleteConfirm,
  deleteText,
  setDeleteConfirm,
  setDeleteText,
  onSelectionModeChange,
  onShowNameToggle,
  onSettingChange,
  onLayoutModeChange,
  onToggle,
  onDelete,
}: GeneralTabProps) {
  return (
    <div className="space-y-6">
      {/* Show Section Name Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <div className="font-medium text-gray-900">Show Section Name</div>
          <div className="text-sm text-gray-500">
            Display the section header in the newsletter.
          </div>
        </div>
        <Toggle enabled={showName} onClick={onShowNameToggle} disabled={saving} />
      </div>

      <AIAppSelectionModeEditor
        value={localModule.selection_mode as AIAppSelectionMode}
        onChange={onSelectionModeChange}
        disabled={saving}
      />

      {/* Product Selection Settings */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Product Selection</h3>

        {/* Products per issue */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <label className="text-sm font-medium text-gray-700">Products per Issue</label>
            <p className="text-xs text-gray-500">Number of products to include in this section</p>
          </div>
          <input
            type="number"
            min="1"
            max="20"
            value={localModule.apps_count}
            onChange={(e) => onSettingChange('apps_count', parseInt(e.target.value) || 6)}
            disabled={saving}
            className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        {/* Max per category */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <label className="text-sm font-medium text-gray-700">Max per Category</label>
            <p className="text-xs text-gray-500">Maximum products from any single category</p>
          </div>
          <input
            type="number"
            min="1"
            max="10"
            value={localModule.max_per_category}
            onChange={(e) => onSettingChange('max_per_category', parseInt(e.target.value) || 3)}
            disabled={saving}
            className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        {/* Affiliate cooldown */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <label className="text-sm font-medium text-gray-700">Affiliate Cooldown (Days)</label>
            <p className="text-xs text-gray-500">Days before an affiliate product can repeat</p>
          </div>
          <input
            type="number"
            min="0"
            max="90"
            value={localModule.affiliate_cooldown_days}
            onChange={(e) => onSettingChange('affiliate_cooldown_days', parseInt(e.target.value) || 7)}
            disabled={saving}
            className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        {/* Layout Mode */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <label className="text-sm font-medium text-gray-700">Text Layout Mode</label>
            <p className="text-xs text-gray-500">How title and description are arranged</p>
          </div>
          <select
            value={localModule.layout_mode || 'inline'}
            onChange={(e) => onLayoutModeChange(e.target.value as ProductCardLayoutMode)}
            disabled={saving}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="inline">Inline (title with description)</option>
            <option value="stacked">Stacked (title above description)</option>
          </select>
        </div>

        {/* Show Emoji */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <label className="text-sm font-medium text-gray-700">Show Emoji</label>
            <p className="text-xs text-gray-500">Display category-based emoji icons next to titles</p>
          </div>
          <Toggle enabled={localModule.show_emoji !== false} onClick={() => onToggle('show_emoji')} disabled={saving} />
        </div>

        {/* Show Numbers */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <label className="text-sm font-medium text-gray-700">Show Numbers</label>
            <p className="text-xs text-gray-500">Display numbered list (1. 2. 3.) next to titles</p>
          </div>
          <Toggle enabled={localModule.show_numbers !== false} onClick={() => onToggle('show_numbers')} disabled={saving} />
        </div>

        {/* Show in Directory */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <label className="text-sm font-medium text-gray-700">Show in Tools Directory</label>
            <p className="text-xs text-gray-500">Products in this module appear in the public /tools directory</p>
          </div>
          <Toggle enabled={localModule.show_in_directory !== false} onClick={() => onToggle('show_in_directory')} disabled={saving} />
        </div>

        {/* Include in Archive */}
        <div className="flex items-center justify-between py-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Include in Archive</label>
            <p className="text-xs text-gray-500">Show this module on archived newsletter pages (/news)</p>
          </div>
          <Toggle enabled={localModule.include_in_archive !== false} onClick={() => onToggle('include_in_archive')} disabled={saving} />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border border-red-200 rounded-lg overflow-hidden mt-8">
        <div className="p-4 bg-red-50">
          <h4 className="font-medium text-red-800">Danger Zone</h4>
          <p className="text-sm text-red-600 mt-1">
            Deleting this section will remove it from all future issues.
          </p>
        </div>

        {!deleteConfirm ? (
          <div className="p-4 bg-white">
            <button
              onClick={() => setDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete Section
            </button>
          </div>
        ) : (
          <div className="p-4 bg-white space-y-3">
            <p className="text-sm text-gray-700">
              Type <strong>DELETE</strong> to confirm deletion of &quot;{localModule.name}&quot;
            </p>
            <input
              type="text"
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDeleteConfirm(false)
                  setDeleteText('')
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onDelete}
                disabled={deleteText !== 'DELETE' || saving}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  deleteText === 'DELETE' && !saving
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
