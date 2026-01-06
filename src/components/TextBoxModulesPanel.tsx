'use client'

import { useState, useEffect } from 'react'
import type {
  TextBoxModule,
  TextBoxBlock,
  IssueTextBoxBlock,
  GenerationTiming
} from '@/types/database'

interface TextBoxModulesPanelProps {
  issueId: string
  issueStatus?: string
}

interface TextBoxSelection {
  module: TextBoxModule
  blocks: TextBoxBlock[]
  issueBlocks: IssueTextBoxBlock[]
}

export default function TextBoxModulesPanel({ issueId, issueStatus }: TextBoxModulesPanelProps) {
  const isSent = issueStatus === 'sent'
  const [loading, setLoading] = useState(true)
  const [selections, setSelections] = useState<TextBoxSelection[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [regenerating, setRegenerating] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchTextBoxModules()
  }, [issueId])

  const fetchTextBoxModules = async () => {
    try {
      const response = await fetch(`/api/campaigns/${issueId}/text-box-modules`)
      if (response.ok) {
        const data = await response.json()
        setSelections(data.modules || [])
      }
    } catch (error) {
      console.error('Failed to fetch text box modules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRegenerate = async (blockId: string) => {
    setRegenerating(blockId)
    try {
      const response = await fetch(`/api/campaigns/${issueId}/text-box-modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate', blockId })
      })

      if (response.ok) {
        await fetchTextBoxModules()
      } else {
        const error = await response.json()
        alert(`Failed to regenerate: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to regenerate:', error)
      alert('Failed to regenerate content')
    } finally {
      setRegenerating(null)
    }
  }

  const handleSaveOverride = async (blockId: string, content: string) => {
    try {
      const response = await fetch(`/api/campaigns/${issueId}/text-box-modules`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId, overrideContent: content || null })
      })

      if (response.ok) {
        await fetchTextBoxModules()
        setEditingContent(prev => {
          const updated = { ...prev }
          delete updated[blockId]
          return updated
        })
      } else {
        const error = await response.json()
        alert(`Failed to save: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to save override:', error)
      alert('Failed to save override')
    }
  }

  const toggleExpanded = (moduleId: string) => {
    setExpanded(prev => ({ ...prev, [moduleId]: !prev[moduleId] }))
  }

  const getBlockContent = (block: TextBoxBlock, issueBlock?: IssueTextBoxBlock): string => {
    if (issueBlock?.override_content) return issueBlock.override_content
    if (block.block_type === 'static_text') return block.static_content || ''
    if (block.block_type === 'ai_prompt') return issueBlock?.generated_content || ''
    return ''
  }

  const getBlockImage = (block: TextBoxBlock, issueBlock?: IssueTextBoxBlock): string => {
    if (issueBlock?.override_image_url) return issueBlock.override_image_url
    if (block.image_type === 'static') return block.static_image_url || ''
    return issueBlock?.generated_image_url || ''
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'completed':
        return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Generated</span>
      case 'pending':
        return <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">Pending</span>
      case 'generating':
        return <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Generating...</span>
      case 'failed':
        return <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">Failed</span>
      case 'manual':
        return <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">Manual Override</span>
      default:
        return null
    }
  }

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
          <p className="text-sm text-gray-500 mt-1">
            Configurable text and image sections
          </p>
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
        <p className="text-sm text-gray-500 mt-1">
          Configurable text and image sections
        </p>
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
              {/* Module Header */}
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleExpanded(module.id)}
              >
                <div className="flex items-center space-x-3">
                  <span className="font-medium text-gray-900">{module.name}</span>
                  <span className="text-xs px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-full">
                    Text Box
                  </span>
                  <span className="text-xs text-gray-400">
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
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="mt-4 space-y-4">
                  {activeBlocks.map(block => {
                    const issueBlock = issueBlocks.find(ib => ib.text_box_block_id === block.id)
                    const content = getBlockContent(block, issueBlock)
                    const imageUrl = getBlockImage(block, issueBlock)
                    const isEditing = editingContent[block.id] !== undefined
                    const isRegenerating = regenerating === block.id

                    return (
                      <div
                        key={block.id}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        {/* Block Header */}
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
                            {getStatusBadge(issueBlock?.generation_status)}
                          </div>
                          {!isSent && block.block_type === 'ai_prompt' && (
                            <button
                              onClick={() => handleRegenerate(block.id)}
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

                        {/* Block Content */}
                        {block.block_type !== 'image' && (
                          <>
                            {isEditing ? (
                              <div className="space-y-2">
                                <textarea
                                  value={editingContent[block.id]}
                                  onChange={(e) => setEditingContent(prev => ({
                                    ...prev,
                                    [block.id]: e.target.value
                                  }))}
                                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                  placeholder="Enter override content..."
                                />
                                <div className="flex justify-end space-x-2">
                                  <button
                                    onClick={() => setEditingContent(prev => {
                                      const updated = { ...prev }
                                      delete updated[block.id]
                                      return updated
                                    })}
                                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleSaveOverride(block.id, editingContent[block.id])}
                                    className="px-3 py-1 text-sm bg-cyan-600 text-white rounded hover:bg-cyan-700"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                onClick={() => !isSent && setEditingContent(prev => ({
                                  ...prev,
                                  [block.id]: issueBlock?.override_content || content || ''
                                }))}
                                className={`p-3 rounded-lg ${
                                  !isSent ? 'cursor-pointer hover:bg-gray-50' : ''
                                } ${content ? 'bg-gray-50' : 'bg-yellow-50'}`}
                              >
                                {content ? (
                                  <div
                                    className="text-sm text-gray-700 whitespace-pre-wrap"
                                    dangerouslySetInnerHTML={{ __html: content }}
                                  />
                                ) : (
                                  <p className="text-sm text-yellow-600 italic">
                                    {issueBlock?.generation_status === 'pending'
                                      ? 'Content will be generated when the workflow runs'
                                      : issueBlock?.generation_status === 'failed'
                                        ? `Generation failed: ${issueBlock.generation_error || 'Unknown error'}`
                                        : 'No content yet'}
                                  </p>
                                )}
                                {!isSent && (
                                  <p className="text-xs text-gray-400 mt-2">
                                    Click to edit
                                  </p>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {/* Image Content */}
                        {block.block_type === 'image' && (
                          <div className="text-center">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt="Block image"
                                className="max-w-full h-auto rounded-lg mx-auto"
                                style={{ maxHeight: '200px' }}
                              />
                            ) : (
                              <div className="p-8 bg-gray-100 rounded-lg text-gray-500 text-sm">
                                {block.image_type === 'ai_generated' && issueBlock?.generation_status === 'pending'
                                  ? 'Image will be generated when the workflow runs'
                                  : 'No image'}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Error Display */}
                        {issueBlock?.generation_error && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                            {issueBlock.generation_error}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {activeBlocks.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No active blocks in this module
                    </p>
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
