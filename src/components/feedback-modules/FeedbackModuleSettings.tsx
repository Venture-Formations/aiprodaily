'use client'

import { useFeedbackModuleSettings } from './feedback-settings/useFeedbackModuleSettings'
import { GeneralTab } from './feedback-settings/GeneralTab'
import { BlocksTab } from './feedback-settings/BlocksTab'
import { ResultsPageTab } from './feedback-settings/ResultsPageTab'
import type { FeedbackModuleSettingsProps } from './feedback-settings/types'

export type { FeedbackModuleSettingsProps }

export function FeedbackModuleSettings({
  module,
  publicationId,
  onUpdate,
  onUpdateBlock,
  onReorderBlocks,
  onAddBlock,
  onDeleteBlock,
  onDelete
}: FeedbackModuleSettingsProps) {
  const state = useFeedbackModuleSettings({
    module,
    onUpdate,
    onUpdateBlock,
    onReorderBlocks,
    onAddBlock,
    onDeleteBlock,
    onDelete,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <input
            type="text"
            value={state.localName}
            onChange={(e) => state.setLocalName(e.target.value)}
            onBlur={(e) => state.handleNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                state.handleNameChange(state.localName)
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            disabled={state.saving}
            className="w-full text-xl font-semibold text-gray-900 bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-cyan-500 focus:outline-none transition-colors px-1 py-1"
          />
          <span className="text-xs text-cyan-600 font-medium">Feedback Module</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Active</span>
          <button
            onClick={state.handleToggleActive}
            disabled={state.saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              module.is_active ? 'bg-cyan-600' : 'bg-gray-200'
            } ${state.saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                module.is_active ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {(['general', 'blocks', 'results'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => state.setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                state.activeTab === tab
                  ? 'border-cyan-500 text-cyan-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'general' ? 'General' : tab === 'blocks' ? `Blocks (${state.blocks.length})` : 'Results Page'}
            </button>
          ))}
        </nav>
      </div>

      {/* General Tab */}
      {state.activeTab === 'general' && (
        <GeneralTab
          showName={state.showName}
          saving={state.saving}
          onShowNameToggle={state.handleShowNameToggle}
        />
      )}

      {/* Blocks Tab */}
      {state.activeTab === 'blocks' && (
        <BlocksTab
          blocks={state.blocks}
          saving={state.saving}
          sensors={state.sensors}
          expandedBlock={state.expandedBlock}
          editingBlock={state.editingBlock}
          editTitleText={state.editTitleText}
          setEditTitleText={state.setEditTitleText}
          editStaticContent={state.editStaticContent}
          setEditStaticContent={state.setEditStaticContent}
          editTextSize={state.editTextSize}
          setEditTextSize={state.setEditTextSize}
          editVoteOptions={state.editVoteOptions}
          setEditVoteOptions={state.setEditVoteOptions}
          editTeamPhotos={state.editTeamPhotos}
          setEditTeamPhotos={state.setEditTeamPhotos}
          onDragEnd={state.handleDragEnd}
          onToggleExpand={(id) => state.setExpandedBlock(state.expandedBlock === id ? null : id)}
          onToggleBlockActive={state.handleToggleBlockActive}
          onDeleteBlock={state.handleDeleteBlock}
          onStartEdit={state.handleStartEdit}
          onCancelEdit={state.handleCancelEdit}
          onSaveBlock={state.handleSaveBlock}
          onAddBlock={onAddBlock ? state.handleAddBlock : undefined}
        />
      )}

      {/* Results Page Tab */}
      {state.activeTab === 'results' && (
        <ResultsPageTab
          resultsConfig={state.resultsConfig}
          saving={state.saving}
          onConfigChange={state.handleResultsConfigChange}
          onSave={state.handleSaveResultsConfig}
        />
      )}

      {/* Danger Zone */}
      <div className="pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-red-600 mb-3">Danger Zone</h4>
        {state.showDeleteConfirm ? (
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-red-700 mb-3">
              Are you sure you want to delete this module? This will also delete all associated blocks.
            </p>
            <div className="flex gap-2">
              <button
                onClick={state.handleDelete}
                disabled={state.saving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                {state.saving ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => state.setShowDeleteConfirm(false)}
                disabled={state.saving}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => state.setShowDeleteConfirm(true)}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm"
          >
            Delete Module
          </button>
        )}
      </div>
    </div>
  )
}
