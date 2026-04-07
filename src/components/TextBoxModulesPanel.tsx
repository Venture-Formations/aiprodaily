'use client'

import type { TextBoxBlock, IssueTextBoxBlock } from '@/types/database'
import {
  useTextBoxModulesPanel,
  getBlockContent,
  getBlockImage,
  getStatusBadge,
  STATUS_BADGE_STYLES,
} from './useTextBoxModulesPanel'

interface TextBoxModulesPanelProps {
  issueId: string
  issueStatus?: string
}

export default function TextBoxModulesPanel({ issueId, issueStatus }: TextBoxModulesPanelProps) {
  const isSent = issueStatus === 'sent'
  const {
    loading,
    selections,
    expanded,
    regenerating,
    editingContent,
    setEditingContent,
    handleRegenerate,
    handleSaveOverride,
    toggleExpanded,
  } = useTextBoxModulesPanel(issueId)

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 mt-8">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-20 bg-gray-100 rounded"></div>
        </div>
      </div>
    )
  }

  if (selections.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow mt-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Text Box Sections</h2>
          <p className="text-sm text-gray-500 mt-1">Configurable text and image sections</p>
        </div>
        <div className="p-6">
          <p className="text-gray-500 text-sm">
            No text box modules configured. Create text box modules in Settings &gt; Sections.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg mt-8">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Text Box Sections</h2>
        <p className="text-sm text-gray-500 mt-1">Configurable text and image sections</p>
      </div>

      <div className="divide-y divide-gray-200">
        {selections.map(selection => {
          const { module, blocks, issueBlocks } = selection
          const isExpanded = expanded[module.id]
          const activeBlocks = blocks.filter(b => b.is_active)
          const allCompleted = activeBlocks.every(b => {
            const ib = issueBlocks.find(ib => ib.text_box_block_id === b.id)
            return ib?.generation_status === 'completed' || ib?.generation_status === 'manual' || b.block_type === 'static_text'
          })

          return (
            <div key={module.id} className="p-4">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleExpanded(module.id)}
              >
                <div className="flex items-center space-x-3">
                  <span className="font-medium text-gray-900">{module.name}</span>
                  <span className="text-xs text-gray-400">Display Order: {module.display_order}</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                    {activeBlocks.length} block{activeBlocks.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  {allCompleted ? (
                    <span className="text-sm text-green-600">Ready</span>
                  ) : (
                    <span className="text-sm text-yellow-600">Pending content</span>
                  )}
                  <svg
                    className={`w-5 h-5 text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-4">
                  {activeBlocks.map(block => (
                    <BlockCard
                      key={block.id}
                      block={block}
                      issueBlock={issueBlocks.find(ib => ib.text_box_block_id === block.id)}
                      isSent={isSent}
                      isRegenerating={regenerating === block.id}
                      editingContent={editingContent[block.id]}
                      onRegenerate={() => handleRegenerate(block.id)}
                      onStartEdit={(content) => setEditingContent(prev => ({ ...prev, [block.id]: content }))}
                      onCancelEdit={() => setEditingContent(prev => { const u = { ...prev }; delete u[block.id]; return u })}
                      onSave={(content) => handleSaveOverride(block.id, content)}
                    />
                  ))}
                  {activeBlocks.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No active blocks in this module</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BlockCard({
  block, issueBlock, isSent, isRegenerating, editingContent,
  onRegenerate, onStartEdit, onCancelEdit, onSave,
}: {
  block: TextBoxBlock
  issueBlock?: IssueTextBoxBlock
  isSent: boolean
  isRegenerating: boolean
  editingContent?: string
  onRegenerate: () => void
  onStartEdit: (content: string) => void
  onCancelEdit: () => void
  onSave: (content: string) => void
}) {
  const content = getBlockContent(block, issueBlock)
  const imageUrl = getBlockImage(block, issueBlock)
  const isEditing = editingContent !== undefined
  const statusLabel = getStatusBadge(issueBlock?.generation_status)
  const statusStyle = issueBlock?.generation_status ? STATUS_BADGE_STYLES[issueBlock.generation_status] : ''

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="font-medium text-sm text-gray-700">
            {block.block_type === 'static_text' && 'Static Text'}
            {block.block_type === 'ai_prompt' && 'AI Generated'}
            {block.block_type === 'image' && 'Image'}
          </span>
          {block.block_type === 'ai_prompt' && (
            <span className="text-xs text-gray-400">
              ({block.generation_timing === 'before_articles' ? 'Before' : 'After'} articles)
            </span>
          )}
          {statusLabel && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyle}`}>{statusLabel}</span>
          )}
        </div>
        {!isSent && block.block_type === 'ai_prompt' && (
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center space-x-1"
          >
            {isRegenerating ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Regenerating...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Regenerate</span>
              </>
            )}
          </button>
        )}
      </div>

      {block.block_type !== 'image' && (
        <>
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editingContent}
                onChange={(e) => onStartEdit(e.target.value)}
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="Enter override content..."
              />
              <div className="flex justify-end space-x-2">
                <button onClick={onCancelEdit} className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                <button onClick={() => onSave(editingContent!)} className="px-3 py-1 text-sm bg-cyan-600 text-white rounded hover:bg-cyan-700">Save</button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => !isSent && onStartEdit(issueBlock?.override_content || content || '')}
              className={`p-3 rounded-lg ${!isSent ? 'cursor-pointer hover:bg-gray-50' : ''} ${content ? 'bg-gray-50' : 'bg-yellow-50'}`}
            >
              {content ? (
                <div className="text-sm text-gray-700 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: content }} />
              ) : (
                <p className="text-sm text-yellow-600 italic">
                  {issueBlock?.generation_status === 'pending'
                    ? 'Content will be generated when the workflow runs'
                    : issueBlock?.generation_status === 'failed'
                      ? `Generation failed: ${issueBlock.generation_error || 'Unknown error'}`
                      : 'No content yet'}
                </p>
              )}
              {!isSent && <p className="text-xs text-gray-400 mt-2">Click to edit</p>}
            </div>
          )}
        </>
      )}

      {block.block_type === 'image' && (
        <div className="text-center">
          {imageUrl ? (
            <img src={imageUrl} alt="Block image" className="max-w-full h-auto rounded-lg mx-auto" style={{ maxHeight: '200px' }} />
          ) : (
            <div className="p-8 bg-gray-100 rounded-lg text-gray-500 text-sm">
              {block.image_type === 'ai_generated' && issueBlock?.generation_status === 'pending'
                ? 'Image will be generated when the workflow runs'
                : 'No image'}
            </div>
          )}
        </div>
      )}

      {issueBlock?.generation_error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {issueBlock.generation_error}
        </div>
      )}
    </div>
  )
}
