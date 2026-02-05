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
  const [activeTab, setActiveTab] = useState<'general' | 'blocks'>('general')

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

  // Count enabled blocks
  const enabledBlockCount = (localModule.block_order as AIAppBlockType[])?.length || 0

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

  const handleShowInDirectoryToggle = async () => {
    setSaving(true)
    try {
      await onUpdate({ show_in_directory: !localModule.show_in_directory })
      setLocalModule(prev => ({ ...prev, show_in_directory: !prev.show_in_directory }))
    } catch (error) {
      console.error('Failed to update show_in_directory:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleIncludeInArchiveToggle = async () => {
    setSaving(true)
    try {
      const newValue = localModule.include_in_archive === false ? true : false
      await onUpdate({ include_in_archive: newValue })
      setLocalModule(prev => ({ ...prev, include_in_archive: newValue }))
    } catch (error) {
      console.error('Failed to update include_in_archive:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleShowEmojiToggle = async () => {
    setSaving(true)
    try {
      const newValue = localModule.show_emoji === false ? true : false
      await onUpdate({ show_emoji: newValue })
      setLocalModule(prev => ({ ...prev, show_emoji: newValue }))
    } catch (error) {
      console.error('Failed to update show_emoji:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleShowNumbersToggle = async () => {
    setSaving(true)
    try {
      const newValue = localModule.show_numbers === false ? true : false
      await onUpdate({ show_numbers: newValue })
      setLocalModule(prev => ({ ...prev, show_numbers: newValue }))
    } catch (error) {
      console.error('Failed to update show_numbers:', error)
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
      <div className="flex items-center justify-between">
        <div className="flex-1">
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
            className="text-2xl font-bold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded px-1 -ml-1 w-full"
          />
          <p className="text-sm text-cyan-600 mt-1">Product Cards Module</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Active</span>
          <button
            onClick={handleActiveToggle}
            disabled={saving}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              localModule.is_active ? 'bg-cyan-500' : 'bg-gray-300'
            } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                localModule.is_active ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Save status */}
      {saveStatus !== 'idle' && (
        <div className={`text-sm flex items-center gap-1 ${
          saveStatus === 'saving' ? 'text-cyan-600' :
          saveStatus === 'saved' ? 'text-green-600' : 'text-red-600'
        }`}>
          {saveStatus === 'saving' && (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Failed to save
            </>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('blocks')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'blocks'
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Blocks ({enabledBlockCount})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <AIAppSelectionModeEditor
            value={localModule.selection_mode as AIAppSelectionMode}
            onChange={handleSelectionModeChange}
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
                onChange={(e) => handleSettingChange('apps_count', parseInt(e.target.value) || 6)}
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
                onChange={(e) => handleSettingChange('max_per_category', parseInt(e.target.value) || 3)}
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
                onChange={(e) => handleSettingChange('affiliate_cooldown_days', parseInt(e.target.value) || 7)}
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
                onChange={(e) => handleLayoutModeChange(e.target.value as ProductCardLayoutMode)}
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
              <button
                onClick={handleShowEmojiToggle}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  localModule.show_emoji !== false ? 'bg-cyan-500' : 'bg-gray-300'
                } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    localModule.show_emoji !== false ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Show Numbers */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <label className="text-sm font-medium text-gray-700">Show Numbers</label>
                <p className="text-xs text-gray-500">Display numbered list (1. 2. 3.) next to titles</p>
              </div>
              <button
                onClick={handleShowNumbersToggle}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  localModule.show_numbers !== false ? 'bg-cyan-500' : 'bg-gray-300'
                } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    localModule.show_numbers !== false ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Show in Directory */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <label className="text-sm font-medium text-gray-700">Show in Tools Directory</label>
                <p className="text-xs text-gray-500">Products in this module appear in the public /tools directory</p>
              </div>
              <button
                onClick={handleShowInDirectoryToggle}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  localModule.show_in_directory !== false ? 'bg-cyan-500' : 'bg-gray-300'
                } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    localModule.show_in_directory !== false ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Include in Archive */}
            <div className="flex items-center justify-between py-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Include in Archive</label>
                <p className="text-xs text-gray-500">Show this module on archived newsletter pages (/news)</p>
              </div>
              <button
                onClick={handleIncludeInArchiveToggle}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  localModule.include_in_archive !== false ? 'bg-cyan-500' : 'bg-gray-300'
                } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    localModule.include_in_archive !== false ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
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
        </div>
      )}

      {activeTab === 'blocks' && (
        <AIAppBlockOrderEditor
          blockOrder={localModule.block_order as AIAppBlockType[]}
          blockConfig={blockConfig}
          onOrderChange={handleBlockOrderChange}
          onConfigChange={handleBlockConfigChange}
          disabled={saving}
        />
      )}

      {/* Saving indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-cyan-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
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
