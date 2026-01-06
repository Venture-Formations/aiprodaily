'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import 'react-quill-new/dist/quill.snow.css'
import { getCroppedImage } from '@/utils/imageCrop'
import type { TextBoxModule, TextBoxBlock } from '@/types/database'

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false })

interface TextBoxModuleSettingsProps {
  module: TextBoxModule
  publicationId: string
  onUpdate: (updates: Partial<TextBoxModule>) => Promise<void>
  onDelete: () => Promise<void>
}

// Quill toolbar configuration
const quillModules = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['link'],
    [{ 'color': [] }]
  ],
}

const quillFormats = [
  'bold', 'italic', 'underline',
  'list',
  'link',
  'color'
]

// Helper to detect AI provider from prompt JSON
function detectProviderFromPrompt(promptJson: any): 'claude' | 'openai' {
  if (!promptJson) return 'openai'
  const str = JSON.stringify(promptJson).toLowerCase()
  if (str.includes('claude') || str.includes('anthropic')) return 'claude'
  return 'openai'
}

export function TextBoxModuleSettings({
  module,
  publicationId,
  onUpdate,
  onDelete
}: TextBoxModuleSettingsProps) {
  const [localName, setLocalName] = useState(module.name)
  const [showName, setShowName] = useState(module.show_name ?? true)
  const [blocks, setBlocks] = useState<TextBoxBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'blocks'>('general')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Block editing states
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null)
  const [editingBlock, setEditingBlock] = useState<string | null>(null)

  // Static text editing
  const [editContent, setEditContent] = useState('')
  const [editTextSize, setEditTextSize] = useState<'small' | 'medium' | 'large'>('medium')

  // AI prompt editing
  const [editPrompt, setEditPrompt] = useState('')
  const [editTiming, setEditTiming] = useState<'before_articles' | 'after_articles'>('after_articles')

  // Image editing
  const [editImageType, setEditImageType] = useState<'static' | 'ai_generated'>('static')
  const [editAiImagePrompt, setEditAiImagePrompt] = useState('')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    setLocalName(module.name)
    setShowName(module.show_name ?? true)
    fetchBlocks()
  }, [module.id])

  const fetchBlocks = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/text-box-modules/${module.id}/blocks`)
      if (res.ok) {
        const data = await res.json()
        setBlocks(data.blocks || [])
      }
    } catch (error) {
      console.error('Failed to fetch blocks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNameChange = async (newName: string) => {
    if (newName.trim() && newName !== module.name) {
      setSaving(true)
      try {
        await onUpdate({ name: newName.trim() })
      } finally {
        setSaving(false)
      }
    }
  }

  const handleShowNameToggle = async () => {
    const newValue = !showName
    setShowName(newValue)
    setSaving(true)
    try {
      await onUpdate({ show_name: newValue })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await onDelete()
    } finally {
      setSaving(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleAddBlock = async (blockType: 'static_text' | 'ai_prompt' | 'image') => {
    setSaving(true)
    try {
      const res = await fetch(`/api/text-box-modules/${module.id}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block_type: blockType,
          display_order: blocks.length
        })
      })
      if (res.ok) {
        const data = await res.json()
        setBlocks(prev => [...prev, data.block])
        // Auto-expand newly added block for editing
        setExpandedBlock(data.block.id)
        handleStartEdit(data.block)
      }
    } catch (error) {
      console.error('Failed to add block:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBlock = async (blockId: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/text-box-modules/${module.id}/blocks/${blockId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setBlocks(prev => prev.filter(b => b.id !== blockId))
        if (expandedBlock === blockId) setExpandedBlock(null)
        if (editingBlock === blockId) setEditingBlock(null)
      }
    } catch (error) {
      console.error('Failed to delete block:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleBlockActive = async (block: TextBoxBlock) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/text-box-modules/${module.id}/blocks/${block.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !block.is_active })
      })
      if (res.ok) {
        const data = await res.json()
        setBlocks(prev => prev.map(b => b.id === block.id ? data.block : b))
      }
    } catch (error) {
      console.error('Failed to toggle block:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleMoveBlock = async (blockId: string, direction: 'up' | 'down') => {
    const index = blocks.findIndex(b => b.id === blockId)
    if (index === -1) return
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === blocks.length - 1) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const newBlocks = [...blocks]
    const [moved] = newBlocks.splice(index, 1)
    newBlocks.splice(newIndex, 0, moved)

    // Update display_order for all blocks
    const updatedBlocks = newBlocks.map((b, i) => ({ ...b, display_order: i }))
    setBlocks(updatedBlocks)

    // Save to server
    setSaving(true)
    try {
      await fetch(`/api/text-box-modules/${module.id}/blocks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: updatedBlocks.map(b => ({ id: b.id, display_order: b.display_order }))
        })
      })
    } catch (error) {
      console.error('Failed to reorder blocks:', error)
      fetchBlocks() // Revert on error
    } finally {
      setSaving(false)
    }
  }

  const handleStartEdit = (block: TextBoxBlock) => {
    setEditingBlock(block.id)
    if (block.block_type === 'static_text') {
      setEditContent(block.static_content || '')
      setEditTextSize((block.text_size as any) || 'medium')
    } else if (block.block_type === 'ai_prompt') {
      const promptJson = block.ai_prompt_json as any
      setEditPrompt(promptJson?.prompt || promptJson?.messages?.[0]?.content || '')
      setEditTiming(block.generation_timing || 'after_articles')
    } else if (block.block_type === 'image') {
      setEditImageType((block.image_type as any) || 'static')
      setEditAiImagePrompt(block.ai_image_prompt || '')
      setSelectedImage(null)
      setCrop(undefined)
      setCompletedCrop(undefined)
    }
  }

  const handleCancelEdit = () => {
    setEditingBlock(null)
    setEditContent('')
    setEditPrompt('')
    setSelectedImage(null)
    setCrop(undefined)
    setCompletedCrop(undefined)
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        setSelectedImage(reader.result as string)
        // Set initial crop (16:9 aspect ratio)
        setCrop({
          unit: '%',
          x: 10,
          y: 10,
          width: 80,
          height: 45
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveBlock = async (block: TextBoxBlock) => {
    setSaving(true)
    try {
      const updateData: Record<string, any> = {}

      if (block.block_type === 'static_text') {
        updateData.static_content = editContent
        updateData.text_size = editTextSize
      } else if (block.block_type === 'ai_prompt') {
        updateData.ai_prompt_json = {
          prompt: editPrompt,
          model: 'gpt-4o-mini',
          max_tokens: 500,
          temperature: 0.7
        }
        updateData.generation_timing = editTiming
      } else if (block.block_type === 'image') {
        updateData.image_type = editImageType

        if (editImageType === 'ai_generated') {
          updateData.ai_image_prompt = editAiImagePrompt
        } else if (selectedImage && completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
          // Upload cropped image
          setUploadingImage(true)
          try {
            const croppedBlob = await getCroppedImage(imgRef.current, completedCrop)
            if (croppedBlob) {
              const imageFormData = new FormData()
              imageFormData.append('image', croppedBlob, 'block-image.jpg')

              const uploadRes = await fetch('/api/ads/upload-image', {
                method: 'POST',
                body: imageFormData
              })

              if (uploadRes.ok) {
                const { url } = await uploadRes.json()
                updateData.static_image_url = url
              } else {
                throw new Error('Failed to upload image')
              }
            }
          } finally {
            setUploadingImage(false)
          }
        }
      }

      const res = await fetch(`/api/text-box-modules/${module.id}/blocks/${block.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      if (res.ok) {
        const data = await res.json()
        setBlocks(prev => prev.map(b => b.id === block.id ? data.block : b))
        setEditingBlock(null)
        setSelectedImage(null)
      }
    } catch (error) {
      console.error('Failed to save block:', error)
      alert('Failed to save block. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const getBlockTypeBadge = (blockType: string) => {
    switch (blockType) {
      case 'static_text':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Static Text</span>
      case 'ai_prompt':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">AI Generated</span>
      case 'image':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Image</span>
      default:
        return null
    }
  }

  const getTextSizeLabel = (size: string) => {
    switch (size) {
      case 'small': return 'Small (14px)'
      case 'medium': return 'Medium (16px)'
      case 'large': return 'Large (20px, semibold)'
      default: return 'Medium'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <input
            type="text"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={(e) => handleNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleNameChange(localName)
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            disabled={saving}
            className="w-full text-xl font-semibold text-gray-900 bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-cyan-500 focus:outline-none transition-colors px-1 py-1"
          />
          <span className="text-xs text-cyan-600 font-medium">Text Box Module</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Active</span>
          <button
            onClick={async () => {
              setSaving(true)
              try {
                await onUpdate({ is_active: !module.is_active })
              } finally {
                setSaving(false)
              }
            }}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              module.is_active ? 'bg-cyan-600' : 'bg-gray-200'
            } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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
            onClick={() => setActiveTab('general')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'general'
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('blocks')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'blocks'
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Blocks ({blocks.length})
          </button>
        </nav>
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Show Section Name Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">Show Section Name</div>
              <div className="text-sm text-gray-500">
                Display the section header in the newsletter. Turn off for sections like "Welcome" that don't need a visible header.
              </div>
            </div>
            <button
              onClick={handleShowNameToggle}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                showName ? 'bg-cyan-600' : 'bg-gray-200'
              } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showName ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Module Info */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500">
              <p className="mb-2">Text Box modules support multiple block types:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Static Text</strong> - Rich text content with formatting (Bold, Italic, Underline)</li>
                <li><strong>AI Prompt</strong> - Content generated by AI each issue</li>
                <li><strong>Image</strong> - Static upload or AI-generated images</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Blocks Tab */}
      {activeTab === 'blocks' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-600"></div>
            </div>
          ) : blocks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-4">No blocks yet. Add your first block to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {blocks.map((block, index) => (
                <div
                  key={block.id}
                  className={`border rounded-lg overflow-hidden ${
                    block.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  {/* Block Header - Collapsed View */}
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedBlock(expandedBlock === block.id ? null : block.id)}
                  >
                    <div className="flex items-center gap-3">
                      {/* Move Buttons */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveBlock(block.id, 'up') }}
                          disabled={index === 0 || saving}
                          className={`p-0.5 rounded ${index === 0 ? 'text-gray-200' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveBlock(block.id, 'down') }}
                          disabled={index === blocks.length - 1 || saving}
                          className={`p-0.5 rounded ${index === blocks.length - 1 ? 'text-gray-200' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${!block.is_active ? 'text-gray-400' : ''}`}>
                          {block.block_type === 'static_text' && 'Static Text'}
                          {block.block_type === 'ai_prompt' && 'AI Prompt'}
                          {block.block_type === 'image' && 'Image'}
                        </span>
                        {getBlockTypeBadge(block.block_type)}
                        {/* AI Provider Badge for ai_prompt blocks */}
                        {block.block_type === 'ai_prompt' && block.ai_prompt_json && (
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            detectProviderFromPrompt(block.ai_prompt_json) === 'claude'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {detectProviderFromPrompt(block.ai_prompt_json) === 'claude' ? 'Claude' : 'OpenAI'}
                          </span>
                        )}
                        {/* Text size badge for static_text */}
                        {block.block_type === 'static_text' && block.text_size && (
                          <span className="text-xs text-gray-400">
                            ({block.text_size})
                          </span>
                        )}
                        {/* Timing badge for ai_prompt */}
                        {block.block_type === 'ai_prompt' && (
                          <span className="text-xs text-gray-400">
                            ({block.generation_timing === 'before_articles' ? 'Before' : 'After'} articles)
                          </span>
                        )}
                        {/* Image type badge */}
                        {block.block_type === 'image' && (
                          <span className="text-xs text-gray-400">
                            ({block.image_type === 'ai_generated' ? 'AI Generated' : 'Static'})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* View/Edit button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedBlock(block.id)
                          if (editingBlock !== block.id) {
                            handleStartEdit(block)
                          }
                        }}
                        className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
                      >
                        View/Edit
                      </button>

                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleBlockActive(block) }}
                        disabled={saving}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          block.is_active ? 'bg-cyan-600' : 'bg-gray-200'
                        } ${saving ? 'opacity-50' : ''}`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            block.is_active ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id) }}
                        disabled={saving}
                        className="text-gray-400 hover:text-red-500 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <svg
                        className={`w-5 h-5 text-gray-400 transform transition-transform ${expandedBlock === block.id ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Block Content - Expanded View */}
                  {expandedBlock === block.id && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      {/* ===== STATIC TEXT BLOCK ===== */}
                      {block.block_type === 'static_text' && (
                        <div>
                          {editingBlock === block.id ? (
                            <div className="space-y-4">
                              {/* Text Size Selector */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Text Size
                                </label>
                                <select
                                  value={editTextSize}
                                  onChange={(e) => setEditTextSize(e.target.value as any)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                                >
                                  <option value="small">Small (14px)</option>
                                  <option value="medium">Medium (16px)</option>
                                  <option value="large">Large (20px, semibold)</option>
                                </select>
                              </div>

                              {/* Rich Text Editor */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Content
                                </label>
                                <div className="border border-gray-300 rounded-lg overflow-hidden">
                                  <ReactQuill
                                    theme="snow"
                                    value={editContent}
                                    onChange={setEditContent}
                                    modules={quillModules}
                                    formats={quillFormats}
                                    placeholder="Enter your text content..."
                                    className="bg-white"
                                  />
                                </div>
                              </div>

                              <div className="flex justify-end gap-2 pt-2">
                                <button
                                  onClick={handleCancelEdit}
                                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveBlock(block)}
                                  disabled={saving}
                                  className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50"
                                >
                                  {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="mb-2 text-xs text-gray-500">
                                Size: {getTextSizeLabel(block.text_size || 'medium')}
                              </div>
                              {block.static_content ? (
                                <div
                                  className="text-sm text-gray-700 prose prose-sm max-w-none bg-white p-3 rounded-lg border border-gray-200"
                                  dangerouslySetInnerHTML={{ __html: block.static_content }}
                                />
                              ) : (
                                <p className="text-sm text-gray-400 italic bg-white p-3 rounded-lg border border-gray-200">
                                  No content yet
                                </p>
                              )}
                              <button
                                onClick={() => handleStartEdit(block)}
                                className="mt-3 px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700"
                              >
                                Edit Content
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ===== AI PROMPT BLOCK (ArticleModulePromptsTab pattern) ===== */}
                      {block.block_type === 'ai_prompt' && (
                        <div>
                          {editingBlock === block.id ? (
                            <div className="space-y-4">
                              {/* Prompt textarea */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  AI Prompt
                                </label>
                                <textarea
                                  value={editPrompt}
                                  onChange={(e) => setEditPrompt(e.target.value)}
                                  placeholder="Enter the AI prompt to generate content. Use placeholders like {{issue_date}}, {{publication_name}}, {{article_1_headline}}, etc."
                                  className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-mono"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                  Available placeholders: {'{{issue_date}}'}, {'{{publication_name}}'}, {'{{subscriber_name}}'},
                                  {'{{article_1_headline}}'}, {'{{article_2_headline}}'}, {'{{ai_app_1_name}}'}, {'{{poll_question}}'}
                                </p>
                              </div>

                              {/* Generation Timing */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Generation Timing
                                </label>
                                <select
                                  value={editTiming}
                                  onChange={(e) => setEditTiming(e.target.value as any)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                                >
                                  <option value="before_articles">Before Articles (basic context only)</option>
                                  <option value="after_articles">After Articles (full newsletter context)</option>
                                </select>
                                <p className="mt-1 text-xs text-gray-500">
                                  "After articles" has access to article headlines, AI apps, polls, and ads for richer content generation.
                                </p>
                              </div>

                              <div className="flex justify-between items-center pt-2">
                                <button
                                  className="px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-lg hover:bg-purple-50"
                                  onClick={() => alert('Test Prompt feature coming soon!')}
                                >
                                  Test Prompt
                                </button>
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleCancelEdit}
                                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleSaveBlock(block)}
                                    disabled={saving}
                                    className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50"
                                  >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="mb-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm font-medium text-gray-700">Prompt Content</span>
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                    detectProviderFromPrompt(block.ai_prompt_json) === 'claude'
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {detectProviderFromPrompt(block.ai_prompt_json) === 'claude' ? 'Claude' : 'OpenAI'}
                                  </span>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-gray-200 font-mono text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">
                                  {(block.ai_prompt_json as any)?.prompt ||
                                   (block.ai_prompt_json as any)?.messages?.[0]?.content ||
                                   <span className="italic text-gray-400">No prompt configured</span>}
                                </div>
                              </div>
                              <div className="text-xs text-gray-500 mb-3">
                                Timing: {block.generation_timing === 'before_articles' ? 'Before Articles' : 'After Articles'}
                              </div>
                              <button
                                onClick={() => handleStartEdit(block)}
                                className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700"
                              >
                                Edit Prompt
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ===== IMAGE BLOCK ===== */}
                      {block.block_type === 'image' && (
                        <div>
                          {editingBlock === block.id ? (
                            <div className="space-y-4">
                              {/* Image Type Toggle */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Image Type
                                </label>
                                <div className="flex gap-4">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`imageType-${block.id}`}
                                      checked={editImageType === 'static'}
                                      onChange={() => setEditImageType('static')}
                                      className="text-cyan-600"
                                    />
                                    <span className="text-sm text-gray-700">Static Upload</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`imageType-${block.id}`}
                                      checked={editImageType === 'ai_generated'}
                                      onChange={() => setEditImageType('ai_generated')}
                                      className="text-cyan-600"
                                    />
                                    <span className="text-sm text-gray-700">AI Generated</span>
                                  </label>
                                </div>
                              </div>

                              {/* Static Upload */}
                              {editImageType === 'static' && (
                                <div>
                                  {/* Current image */}
                                  {block.static_image_url && !selectedImage && (
                                    <div className="mb-3">
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Current Image
                                      </label>
                                      <img
                                        src={block.static_image_url}
                                        alt="Current"
                                        className="max-w-md h-auto rounded border border-gray-200"
                                      />
                                    </div>
                                  )}

                                  {/* Upload button */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      {block.static_image_url ? 'Replace Image' : 'Upload Image'}
                                    </label>
                                    <input
                                      ref={fileInputRef}
                                      type="file"
                                      accept="image/*"
                                      onChange={handleImageSelect}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                      Image will be cropped to 16:9 ratio
                                    </p>
                                  </div>

                                  {/* Crop Tool */}
                                  {selectedImage && (
                                    <div className="mt-4">
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Crop Image (16:9 ratio)
                                      </label>
                                      <ReactCrop
                                        crop={crop}
                                        onChange={(c) => setCrop(c)}
                                        onComplete={(c) => setCompletedCrop(c)}
                                        aspect={16 / 9}
                                      >
                                        <img
                                          ref={imgRef}
                                          src={selectedImage}
                                          alt="Crop preview"
                                          style={{ maxWidth: '100%' }}
                                        />
                                      </ReactCrop>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedImage(null)
                                          setCrop(undefined)
                                          setCompletedCrop(undefined)
                                          if (fileInputRef.current) fileInputRef.current.value = ''
                                        }}
                                        className="mt-2 px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                                      >
                                        Cancel Image Selection
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* AI Generated */}
                              {editImageType === 'ai_generated' && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    AI Image Prompt
                                  </label>
                                  <textarea
                                    value={editAiImagePrompt}
                                    onChange={(e) => setEditAiImagePrompt(e.target.value)}
                                    placeholder="Describe the image to generate... Use placeholders like {{headline}} or {{title}}"
                                    className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                                  />
                                  <p className="mt-1 text-xs text-gray-500">
                                    Available placeholders: {'{{headline}}'}, {'{{content}}'}, {'{{title}}'}
                                  </p>
                                </div>
                              )}

                              <div className="flex justify-end gap-2 pt-2">
                                <button
                                  onClick={handleCancelEdit}
                                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveBlock(block)}
                                  disabled={saving || uploadingImage}
                                  className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50"
                                >
                                  {uploadingImage ? 'Uploading...' : saving ? 'Saving...' : 'Save Changes'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-sm text-gray-500 mb-2">
                                Type: {block.image_type === 'ai_generated' ? 'AI Generated' : 'Static Upload'}
                              </div>
                              {block.static_image_url && (
                                <img
                                  src={block.static_image_url}
                                  alt="Block image"
                                  className="max-w-md rounded border border-gray-200 mb-3"
                                />
                              )}
                              {block.image_type === 'ai_generated' && block.ai_image_prompt && (
                                <div className="mb-3">
                                  <div className="text-xs font-medium text-gray-600 mb-1">AI Prompt:</div>
                                  <div className="bg-white p-2 rounded border border-gray-200 text-sm text-gray-700">
                                    {block.ai_image_prompt}
                                  </div>
                                </div>
                              )}
                              {!block.static_image_url && !block.ai_image_prompt && (
                                <p className="text-sm text-gray-400 italic mb-3">No image configured</p>
                              )}
                              <button
                                onClick={() => handleStartEdit(block)}
                                className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700"
                              >
                                Edit Image
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Block Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <button
              onClick={() => handleAddBlock('static_text')}
              disabled={saving}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 text-gray-700 transition-colors disabled:opacity-50"
            >
              + Static Text
            </button>
            <button
              onClick={() => handleAddBlock('ai_prompt')}
              disabled={saving}
              className="flex-1 px-3 py-2 text-sm border border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 text-purple-700 transition-colors disabled:opacity-50"
            >
              + AI Prompt
            </button>
            <button
              onClick={() => handleAddBlock('image')}
              disabled={saving}
              className="flex-1 px-3 py-2 text-sm border border-green-200 rounded-lg hover:bg-green-50 hover:border-green-300 text-green-700 transition-colors disabled:opacity-50"
            >
              + Image
            </button>
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-red-600 mb-3">Danger Zone</h4>
        {showDeleteConfirm ? (
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-red-700 mb-3">
              Are you sure you want to delete this module? This will also delete all associated blocks.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                {saving ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={saving}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
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
