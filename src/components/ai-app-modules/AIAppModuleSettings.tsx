'use client'

import AIAppBlockOrderEditor from './AIAppBlockOrderEditor'
import { useAppModuleSettings } from './app-module-settings/useAppModuleSettings'
import GeneralTab from './app-module-settings/GeneralTab'
import type {
  AIAppModule,
  AIAppBlockType,
} from '@/types/database'

interface AIAppModuleSettingsProps {
  module: AIAppModule
  publicationId: string
  onUpdate: (updates: Partial<AIAppModule>) => Promise<void>
  onDelete: () => void
}

export default function AIAppModuleSettings({
  module,
  publicationId,
  onUpdate,
  onDelete
}: AIAppModuleSettingsProps) {
  const {
    localModule,
    setLocalModule,
    saving,
    deleteConfirm,
    setDeleteConfirm,
    deleteText,
    setDeleteText,
    saveStatus,
    activeTab,
    setActiveTab,
    showName,
    blockConfig,
    enabledBlockCount,
    handleNameChange,
    handleBlockOrderChange,
    handleBlockConfigChange,
    handleSelectionModeChange,
    handleActiveToggle,
    handleShowNameToggle,
    handleSettingChange,
    handleLayoutModeChange,
    handleToggle,
    handleDelete,
  } = useAppModuleSettings(module, onUpdate, onDelete)

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
        <GeneralTab
          localModule={localModule}
          saving={saving}
          showName={showName}
          deleteConfirm={deleteConfirm}
          deleteText={deleteText}
          setDeleteConfirm={setDeleteConfirm}
          setDeleteText={setDeleteText}
          onSelectionModeChange={handleSelectionModeChange}
          onShowNameToggle={handleShowNameToggle}
          onSettingChange={handleSettingChange}
          onLayoutModeChange={handleLayoutModeChange}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
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
