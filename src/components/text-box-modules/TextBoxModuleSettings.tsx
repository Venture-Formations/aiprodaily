'use client'

import type { TextBoxModuleSettingsProps } from './text-box-settings/types'
import { useTextBoxModuleSettings, GeneralTab, BlocksTab } from './text-box-settings'

export function TextBoxModuleSettings({
  module,
  publicationId,
  onUpdate,
  onDelete
}: TextBoxModuleSettingsProps) {
  const hook = useTextBoxModuleSettings(module, publicationId, onUpdate, onDelete)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <input
            type="text"
            value={hook.localName}
            onChange={(e) => hook.setLocalName(e.target.value)}
            onBlur={(e) => hook.handleNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                hook.handleNameChange(hook.localName)
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            disabled={hook.saving}
            className="w-full text-xl font-semibold text-gray-900 bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-cyan-500 focus:outline-none transition-colors px-1 py-1"
          />
          <span className="text-xs text-cyan-600 font-medium">Text Box Module</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Active</span>
          <button
            onClick={hook.handleToggleModuleActive}
            disabled={hook.saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              module.is_active ? 'bg-cyan-600' : 'bg-gray-200'
            } ${hook.saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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
          <button
            onClick={() => hook.setActiveTab('general')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              hook.activeTab === 'general'
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            General
          </button>
          <button
            onClick={() => hook.setActiveTab('blocks')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              hook.activeTab === 'blocks'
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Blocks ({hook.blocks.length})
          </button>
        </nav>
      </div>

      {/* General Tab */}
      {hook.activeTab === 'general' && (
        <GeneralTab
          showName={hook.showName}
          saving={hook.saving}
          onShowNameToggle={hook.handleShowNameToggle}
        />
      )}

      {/* Blocks Tab */}
      {hook.activeTab === 'blocks' && (
        <BlocksTab
          blocks={hook.blocks}
          loading={hook.loading}
          saving={hook.saving}
          expandedBlock={hook.expandedBlock}
          editingBlock={hook.editingBlock}
          sensors={hook.sensors}
          editContent={hook.editContent}
          setEditContent={hook.setEditContent}
          editTextSize={hook.editTextSize}
          setEditTextSize={hook.setEditTextSize}
          editPrompt={hook.editPrompt}
          setEditPrompt={hook.setEditPrompt}
          editTiming={hook.editTiming}
          setEditTiming={hook.setEditTiming}
          editIsBold={hook.editIsBold}
          setEditIsBold={hook.setEditIsBold}
          editIsItalic={hook.editIsItalic}
          setEditIsItalic={hook.setEditIsItalic}
          editResponseField={hook.editResponseField}
          setEditResponseField={hook.setEditResponseField}
          testingPrompt={hook.testingPrompt}
          testResult={hook.testResult}
          editImageType={hook.editImageType}
          setEditImageType={hook.setEditImageType}
          editAiImagePrompt={hook.editAiImagePrompt}
          setEditAiImagePrompt={hook.setEditAiImagePrompt}
          editImageAlt={hook.editImageAlt}
          setEditImageAlt={hook.setEditImageAlt}
          selectedImage={hook.selectedImage}
          crop={hook.crop}
          setCrop={hook.setCrop}
          completedCrop={hook.completedCrop}
          setCompletedCrop={hook.setCompletedCrop}
          uploadingImage={hook.uploadingImage}
          aspectRatio={hook.aspectRatio}
          fileInputRef={hook.fileInputRef}
          imgRef={hook.imgRef}
          onToggleExpand={(blockId) => hook.setExpandedBlock(hook.expandedBlock === blockId ? null : blockId)}
          onToggleBlockActive={hook.handleToggleBlockActive}
          onDeleteBlock={hook.handleDeleteBlock}
          onStartEdit={hook.handleStartEdit}
          onCancelEdit={hook.handleCancelEdit}
          onSaveBlock={hook.handleSaveBlock}
          onTestPrompt={hook.handleTestPrompt}
          onImageSelect={hook.handleImageSelect}
          onAspectRatioChange={hook.handleAspectRatioChange}
          onDragEnd={hook.handleDragEnd}
          onAddBlock={hook.handleAddBlock}
        />
      )}

      {/* Danger Zone */}
      <div className="pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-red-600 mb-3">Danger Zone</h4>
        {hook.showDeleteConfirm ? (
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-red-700 mb-3">
              Are you sure you want to delete this module? This will also delete all associated blocks.
            </p>
            <div className="flex gap-2">
              <button
                onClick={hook.handleDelete}
                disabled={hook.saving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                {hook.saving ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => hook.setShowDeleteConfirm(false)}
                disabled={hook.saving}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => hook.setShowDeleteConfirm(true)}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm"
          >
            Delete Module
          </button>
        )}
      </div>

      {/* Quill editor styles */}
      <style jsx global>{`
        .ql-container {
          min-height: 150px;
          font-family: inherit;
        }
        .ql-editor {
          min-height: 150px;
        }
        .ql-editor.ql-blank::before {
          color: #9CA3AF;
          font-style: normal;
        }
      `}</style>
    </div>
  )
}
