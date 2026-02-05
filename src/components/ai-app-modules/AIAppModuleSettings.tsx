'use client'

import { useState, useEffect } from 'react'
import AIAppBlockOrderEditor from './AIAppBlockOrderEditor'
import AIAppSelectionModeEditor from './AIAppSelectionModeEditor'
import type {
  AIAppModule,
  AIAppBlockType,
  AIAppSelectionMode,
  ProductCardBlockConfig,
  ProductCardLayoutMode
} from '@/types/database'

interface AIAppModuleSettingsProps {
  module: AIAppModule
  publicationId: string
  onUpdate: (updates: Partial<AIAppModule>) => Promise<void>
  onDelete: () => void
}

// Default block config when none exists
const DEFAULT_BLOCK_CONFIG: ProductCardBlockConfig = {
  logo: { enabled: true, style: 'square', position: 'left' },
  title: { enabled: true, size: 'medium' },
  description: { enabled: true, size: 'medium' },
  tagline: { enabled: false, size: 'medium' },
  image: { enabled: false },
  button: { enabled: false }
}

export default function AIAppModuleSettings({
  module,
  publicationId,
  onUpdate,
  onDelete
}: AIAppModuleSettingsProps) {
  const [localModule, setLocalModule] = useState(module)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Update local state when module prop changes
  useEffect(() => {
    setLocalModule(module)
    setDeleteConfirm(false)
    setDeleteText('')
  }, [module.id])

  // Ensure block_config has defaults merged
  const blockConfig: ProductCardBlockConfig = {
    ...DEFAULT_BLOCK_CONFIG,
    ...(localModule.block_config || {})
  }

  const handleNameChange = async (newName: string) => {
    if (newName.trim() === module.name) return

    setSaving(true)
    setSaveStatus('saving')
    try {
      await onUpdate({ name: newName.trim() })
      setLocalModule(prev => ({ ...prev, name: newName.trim() }))
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      console.error('Failed to update name:', error)
      setSaveStatus('error')
      setLocalModule(prev => ({ ...prev, name: module.name }))
    } finally {
      setSaving(false)
    }
  }

  const handleBlockOrderChange = async (newOrder: AIAppBlockType[]) => {
    setSaving(true)
    try {
      await onUpdate({ block_order: newOrder })
      setLocalModule(prev => ({ ...prev, block_order: newOrder }))
    } catch (error) {
      console.error('Failed to update block order:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleBlockConfigChange = async (newConfig: ProductCardBlockConfig) => {
    setSaving(true)
    try {
      await onUpdate({ block_config: newConfig })
      setLocalModule(prev => ({ ...prev, block_config: newConfig }))
    } catch (error) {
      console.error('Failed to update block config:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleSelectionModeChange = async (mode: AIAppSelectionMode) => {
    setSaving(true)
    try {
      await onUpdate({ selection_mode: mode })
      setLocalModule(prev => ({ ...prev, selection_mode: mode }))
    } catch (error) {
      console.error('Failed to update selection mode:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleActiveToggle = async () => {
    setSaving(true)
    try {
      await onUpdate({ is_active: !localModule.is_active })
      setLocalModule(prev => ({ ...prev, is_active: !prev.is_active }))
    } catch (error) {
      console.error('Failed to update active status:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleSettingChange = async (key: 'apps_count' | 'max_per_category' | 'affiliate_cooldown_days', value: number) => {
    setSaving(true)
    try {
      await onUpdate({ [key]: value })
      setLocalModule(prev => ({ ...prev, [key]: value }))
    } catch (error) {
      console.error(`Failed to update ${key}:`, error)
    } finally {
      setSaving(false)
    }
  }

  const handleLayoutModeChange = async (value: ProductCardLayoutMode) => {
    setSaving(true)
    try {
      await onUpdate({ layout_mode: value })
      setLocalModule(prev => ({ ...prev, layout_mode: value }))
    } catch (error) {
      console.error('Failed to update layout mode:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (deleteText !== 'DELETE') return

    setSaving(true)
    try {
      await onDelete()
    } catch (error) {
      console.error('Failed to delete module:', error)
    } finally {
      setSaving(false)
      setDeleteConfirm(false)
      setDeleteText('')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with name and active toggle */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={localModule.name}
            onChange={(e) => setLocalModule(prev => ({ ...prev, name: e.target.value }))}
            onBlur={(e) => handleNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleNameChange(localModule.name)
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            disabled={saving}
            className="text-xl font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-green-500 rounded px-1 -ml-1"
          />
          {saveStatus === 'saving' && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-red-600 flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Failed to save
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {localModule.is_active ? 'Active' : 'Inactive'}
          </span>
          <button
            onClick={handleActiveToggle}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              localModule.is_active ? 'bg-green-600' : 'bg-gray-200'
            } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                localModule.is_active ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-4">
        {/* Block Order & Settings - now includes per-block config */}
        <AIAppBlockOrderEditor
          blockOrder={localModule.block_order as AIAppBlockType[]}
          blockConfig={blockConfig}
          onOrderChange={handleBlockOrderChange}
          onConfigChange={handleBlockConfigChange}
          disabled={saving}
        />

        <AIAppSelectionModeEditor
          value={localModule.selection_mode as AIAppSelectionMode}
          onChange={handleSelectionModeChange}
          disabled={saving}
        />

        {/* Product Selection Settings */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 bg-gray-50">
            <span className="font-medium text-gray-700">Product Selection Settings</span>
          </div>
          <div className="p-4 space-y-4">
            {/* Products per issue */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Products per Issue</label>
                <p className="text-xs text-gray-500">Number of products to include in this section</p>
              </div>
              <input
                type="number"
                min="1"
                max="20"
                value={localModule.apps_count}
                onChange={(e) => handleSettingChange('apps_count', parseInt(e.target.value) || 6)}
                disabled={saving}
                className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Max per category */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Max per Category</label>
                <p className="text-xs text-gray-500">Maximum apps from any single category</p>
              </div>
              <input
                type="number"
                min="1"
                max="10"
                value={localModule.max_per_category}
                onChange={(e) => handleSettingChange('max_per_category', parseInt(e.target.value) || 3)}
                disabled={saving}
                className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Affiliate cooldown */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Affiliate Cooldown (Days)</label>
                <p className="text-xs text-gray-500">Days before an affiliate app can repeat</p>
              </div>
              <input
                type="number"
                min="0"
                max="90"
                value={localModule.affiliate_cooldown_days}
                onChange={(e) => handleSettingChange('affiliate_cooldown_days', parseInt(e.target.value) || 7)}
                disabled={saving}
                className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        </div>

        {/* Layout Mode (stacked vs inline for text) */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 bg-gray-50">
            <span className="font-medium text-gray-700">Text Layout</span>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Layout Mode</label>
                <p className="text-xs text-gray-500">How title and description are arranged</p>
              </div>
              <select
                value={localModule.layout_mode || 'inline'}
                onChange={(e) => handleLayoutModeChange(e.target.value as ProductCardLayoutMode)}
                disabled={saving}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="inline">Inline (title with description)</option>
                <option value="stacked">Stacked (title above description)</option>
              </select>
            </div>
          </div>
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
                onClick={handleDelete}
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

      {/* Saving indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Saving...
        </div>
      )}
    </div>
  )
}
