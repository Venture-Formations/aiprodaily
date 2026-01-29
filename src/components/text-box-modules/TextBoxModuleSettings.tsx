'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import 'react-quill-new/dist/quill.snow.css'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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

// Sortable block item component
interface SortableBlockItemProps {
  block: TextBoxBlock
  isActive: boolean
  isExpanded: boolean
  isEditing: boolean
  saving: boolean
  onToggleExpand: () => void
  onToggleActive: () => void
  onDelete: () => void
  onStartEdit: () => void
  getBlockTypeBadge: (blockType: string) => React.ReactNode
  detectProviderFromPrompt: (promptJson: any) => 'claude' | 'openai'
  children: React.ReactNode
}

function SortableBlockItem({
  block,
  isActive,
  isExpanded,
  saving,
  onToggleExpand,
  onToggleActive,
  onDelete,
  onStartEdit,
  getBlockTypeBadge,
  detectProviderFromPrompt,
  children
}: SortableBlockItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg overflow-hidden ${
        isDragging ? 'shadow-lg' : ''
      } ${isActive ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'}`}
    >
      {/* Block Header - Collapsed View */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${!isActive ? 'text-gray-400' : ''}`}>
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
              onStartEdit()
            }}
            className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
          >
            View/Edit
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onToggleActive() }}
            disabled={saving}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              isActive ? 'bg-cyan-600' : 'bg-gray-200'
            } ${saving ? 'opacity-50' : ''}`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                isActive ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            disabled={saving}
            className="text-gray-400 hover:text-red-500 p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
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

      {/* Expanded Content (passed as children) */}
      {children}
    </div>
  )
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
  const [editIsBold, setEditIsBold] = useState(false)
  const [editResponseField, setEditResponseField] = useState('')
  const [testingPrompt, setTestingPrompt] = useState(false)
  const [testResult, setTestResult] = useState<{ result?: string; injectedPrompt?: string; error?: string } | null>(null)

  // Image editing
  const [editImageType, setEditImageType] = useState<'static' | 'ai_generated'>('static')
  const [editAiImagePrompt, setEditAiImagePrompt] = useState('')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [uploadingImage, setUploadingImage] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '5:4' | 'free'>('16:9')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Helper to get numeric aspect ratio
  const getAspectRatioValue = (ratio: '16:9' | '5:4' | 'free'): number | undefined => {
    switch (ratio) {
      case '16:9': return 16 / 9
      case '5:4': return 5 / 4
      case 'free': return undefined
    }
  }

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const oldIndex = blocks.findIndex(b => b.id === active.id)
    const newIndex = blocks.findIndex(b => b.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const newBlocks = arrayMove(blocks, oldIndex, newIndex)
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
      setEditIsBold(block.is_bold || false)
      setEditResponseField(promptJson?.response_field || '')
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
    setEditIsBold(false)
    setEditResponseField('')
    setSelectedImage(null)
    setCrop(undefined)
    setCompletedCrop(undefined)
    setTestResult(null)
  }

  const handleTestPrompt = async () => {
    if (!editPrompt.trim()) {
      setTestResult({ error: 'Please enter a prompt to test' })
      return
    }

    setTestingPrompt(true)
    setTestResult(null)

    try {
      const res = await fetch('/api/text-box-modules/test-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicationId,
          prompt: editPrompt,
          timing: editTiming
        })
      })

      const data = await res.json()

      if (data.success) {
        setTestResult({
          result: data.result,
          injectedPrompt: data.injectedPrompt
        })
      } else {
        setTestResult({ error: data.error || 'Test failed' })
      }
    } catch (error) {
      setTestResult({ error: 'Failed to test prompt. Please try again.' })
    } finally {
      setTestingPrompt(false)
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        setSelectedImage(reader.result as string)
        // Set initial crop based on aspect ratio
        const ratio = getAspectRatioValue(aspectRatio)
        if (ratio) {
          // Calculate height based on aspect ratio (width 80%)
          const height = 80 / ratio
          setCrop({
            unit: '%',
            x: 10,
            y: Math.max(5, (100 - height) / 2),
            width: 80,
            height: Math.min(90, height)
          })
        } else {
          // Free crop - default square-ish
          setCrop({
            unit: '%',
            x: 10,
            y: 10,
            width: 80,
            height: 80
          })
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAspectRatioChange = (newRatio: '16:9' | '5:4' | 'free') => {
    setAspectRatio(newRatio)
    // Reset crop when ratio changes
    if (selectedImage) {
      const ratio = getAspectRatioValue(newRatio)
      if (ratio) {
        const height = 80 / ratio
        setCrop({
          unit: '%',
          x: 10,
          y: Math.max(5, (100 - height) / 2),
          width: 80,
          height: Math.min(90, height)
        })
      } else {
        setCrop({
          unit: '%',
          x: 10,
          y: 10,
          width: 80,
          height: 80
        })
      }
      setCompletedCrop(undefined)
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
          temperature: 0.7,
          ...(editResponseField.trim() && { response_field: editResponseField.trim() })
        }
        updateData.generation_timing = editTiming
        updateData.is_bold = editIsBold
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

  // Render expanded content for a block
  const renderBlockExpandedContent = (block: TextBoxBlock) => (
    <div className="border-t border-gray-200 p-4 bg-gray-50">
      {/* ===== STATIC TEXT BLOCK ===== */}
      {block.block_type === 'static_text' && (
        <div>
          {editingBlock === block.id ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Text Size</label>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
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
                <button onClick={handleCancelEdit} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={() => handleSaveBlock(block)} disabled={saving} className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-2 text-xs text-gray-500">Size: {getTextSizeLabel(block.text_size || 'medium')}</div>
              {block.static_content ? (
                <div className="text-sm text-gray-700 prose prose-sm max-w-none bg-white p-3 rounded-lg border border-gray-200" dangerouslySetInnerHTML={{ __html: block.static_content }} />
              ) : (
                <p className="text-sm text-gray-400 italic bg-white p-3 rounded-lg border border-gray-200">No content yet</p>
              )}
              <button onClick={() => handleStartEdit(block)} className="mt-3 px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700">Edit Content</button>
            </div>
          )}
        </div>
      )}

      {/* ===== AI PROMPT BLOCK ===== */}
      {block.block_type === 'ai_prompt' && (
        <div>
          {editingBlock === block.id ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">AI Prompt</label>
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="Enter the AI prompt to generate content..."
                  className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-mono"
                />
                <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-xs font-medium text-gray-700 mb-2">Available Placeholders:</div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p><strong>Basic:</strong> {'{{issue_date}}'}, {'{{publication_name}}'}, {'{{random_X-Y}}'} <span className="text-gray-400">(random integer)</span></p>
                    <p><strong>Section Articles:</strong> {'{{section_1_all_articles}}'}, {'{{section_2_all_articles}}'}</p>
                    <p><strong>Individual:</strong> {'{{section_1_article_1_headline}}'}, {'{{section_1_article_1_content}}'}</p>
                    <p><strong>Other:</strong> {'{{ai_app_1_name}}'}, {'{{poll_question}}'}, {'{{ad_1_title}}'}</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Generation Timing</label>
                <select value={editTiming} onChange={(e) => setEditTiming(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm">
                  <option value="before_articles">Before Articles (basic context only)</option>
                  <option value="after_articles">After Articles (full newsletter context)</option>
                </select>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id={`bold-${editingBlock}`}
                  checked={editIsBold}
                  onChange={(e) => setEditIsBold(e.target.checked)}
                  className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
                />
                <label htmlFor={`bold-${editingBlock}`} className="text-sm text-gray-700">
                  <span className="font-medium">Make content bold</span>
                  <span className="text-gray-500 ml-1">- Renders the entire AI-generated content in bold</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Response Field (optional)</label>
                <input
                  type="text"
                  value={editResponseField}
                  onChange={(e) => setEditResponseField(e.target.value)}
                  placeholder="e.g., Summary, content, joke_text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
                {!editResponseField.trim() && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    Expects: Plain text OR JSON with lowercase field: <code className="bg-gray-100 px-1 rounded">summary</code>, <code className="bg-gray-100 px-1 rounded">content</code>, <code className="bg-gray-100 px-1 rounded">text</code>, <code className="bg-gray-100 px-1 rounded">body</code>, <code className="bg-gray-100 px-1 rounded">raw</code>, <code className="bg-gray-100 px-1 rounded">response</code>, <code className="bg-gray-100 px-1 rounded">output</code>, <code className="bg-gray-100 px-1 rounded">result</code>, or <code className="bg-gray-100 px-1 rounded">message</code>
                  </p>
                )}
              </div>
              {testResult && (
                <div className={`p-4 rounded-lg border ${testResult.error ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                  {testResult.error ? <div className="text-sm text-red-700">{testResult.error}</div> : (
                    <div className="space-y-3">
                      <div><div className="text-xs font-medium text-gray-600 mb-1">Injected Prompt:</div><div className="bg-white p-2 rounded border border-gray-200 text-xs font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">{testResult.injectedPrompt}</div></div>
                      <div><div className="text-xs font-medium text-gray-600 mb-1">AI Response:</div><div className="bg-white p-2 rounded border border-gray-200 text-sm max-h-48 overflow-y-auto whitespace-pre-wrap">{testResult.result}</div></div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-between items-center pt-2">
                <button onClick={handleTestPrompt} disabled={testingPrompt || !editPrompt.trim()} className="px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-lg hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed">{testingPrompt ? 'Testing...' : 'Test Prompt'}</button>
                <div className="flex gap-2">
                  <button onClick={handleCancelEdit} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button onClick={() => handleSaveBlock(block)} disabled={saving} className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-700">Prompt Content</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${detectProviderFromPrompt(block.ai_prompt_json) === 'claude' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>{detectProviderFromPrompt(block.ai_prompt_json) === 'claude' ? 'Claude' : 'OpenAI'}</span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-gray-200 font-mono text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">{(block.ai_prompt_json as any)?.prompt || (block.ai_prompt_json as any)?.messages?.[0]?.content || <span className="italic text-gray-400">No prompt configured</span>}</div>
              </div>
              <div className="flex items-center flex-wrap gap-3 text-xs text-gray-500 mb-3">
                <span>Timing: {block.generation_timing === 'before_articles' ? 'Before Articles' : 'After Articles'}</span>
                {block.is_bold && (
                  <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded font-medium">Bold</span>
                )}
                {(block.ai_prompt_json as any)?.response_field && (
                  <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded font-medium">
                    Response Field: {(block.ai_prompt_json as any).response_field}
                  </span>
                )}
              </div>
              <button onClick={() => handleStartEdit(block)} className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700">Edit Prompt</button>
            </div>
          )}
        </div>
      )}

      {/* ===== IMAGE BLOCK ===== */}
      {block.block_type === 'image' && (
        <div>
          {editingBlock === block.id ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Image Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name={`imageType-${block.id}`} checked={editImageType === 'static'} onChange={() => setEditImageType('static')} className="text-cyan-600" />
                    <span className="text-sm text-gray-700">Static Upload</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name={`imageType-${block.id}`} checked={editImageType === 'ai_generated'} onChange={() => setEditImageType('ai_generated')} className="text-cyan-600" />
                    <span className="text-sm text-gray-700">AI Generated</span>
                  </label>
                </div>
              </div>
              {editImageType === 'static' && (
                <div>
                  {block.static_image_url && !selectedImage && <div className="mb-3"><label className="block text-sm font-medium text-gray-700 mb-2">Current Image</label><img src={block.static_image_url} alt="Current" className="max-w-md h-auto rounded border border-gray-200" /></div>}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Aspect Ratio</label>
                    <div className="flex gap-2">
                      {(['16:9', '5:4', 'free'] as const).map((ratio) => (
                        <button key={ratio} type="button" onClick={() => handleAspectRatioChange(ratio)} className={`px-4 py-2 text-sm rounded-lg border transition-colors ${aspectRatio === ratio ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}>{ratio === 'free' ? 'Free' : ratio}</button>
                      ))}
                    </div>
                  </div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-2">{block.static_image_url ? 'Replace Image' : 'Upload Image'}</label><input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                  {selectedImage && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Crop Image {aspectRatio !== 'free' ? `(${aspectRatio})` : '(Free)'}</label>
                      <ReactCrop crop={crop} onChange={(c) => setCrop(c)} onComplete={(c) => setCompletedCrop(c)} aspect={getAspectRatioValue(aspectRatio)}><img ref={imgRef} src={selectedImage} alt="Crop preview" style={{ maxWidth: '100%' }} /></ReactCrop>
                      <button type="button" onClick={() => { setSelectedImage(null); setCrop(undefined); setCompletedCrop(undefined); if (fileInputRef.current) fileInputRef.current.value = '' }} className="mt-2 px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Cancel Image Selection</button>
                    </div>
                  )}
                </div>
              )}
              {editImageType === 'ai_generated' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">AI Image Prompt</label>
                  <textarea value={editAiImagePrompt} onChange={(e) => setEditAiImagePrompt(e.target.value)} placeholder="Describe the image to generate..." className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm" />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={handleCancelEdit} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={() => handleSaveBlock(block)} disabled={saving || uploadingImage} className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50">{uploadingImage ? 'Uploading...' : saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-sm text-gray-500 mb-2">Type: {block.image_type === 'ai_generated' ? 'AI Generated' : 'Static Upload'}</div>
              {block.static_image_url && <img src={block.static_image_url} alt="Block image" className="max-w-md rounded border border-gray-200 mb-3" />}
              {block.image_type === 'ai_generated' && block.ai_image_prompt && <div className="mb-3"><div className="text-xs font-medium text-gray-600 mb-1">AI Prompt:</div><div className="bg-white p-2 rounded border border-gray-200 text-sm text-gray-700">{block.ai_image_prompt}</div></div>}
              {!block.static_image_url && !block.ai_image_prompt && <p className="text-sm text-gray-400 italic mb-3">No image configured</p>}
              <button onClick={() => handleStartEdit(block)} className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700">Edit Image</button>
            </div>
          )}
        </div>
      )}
    </div>
  )

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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={blocks.map(b => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {blocks.map((block) => (
                    <SortableBlockItem
                      key={block.id}
                      block={block}
                      isActive={block.is_active}
                      isExpanded={expandedBlock === block.id}
                      isEditing={editingBlock === block.id}
                      saving={saving}
                      onToggleExpand={() => setExpandedBlock(expandedBlock === block.id ? null : block.id)}
                      onToggleActive={() => handleToggleBlockActive(block)}
                      onDelete={() => handleDeleteBlock(block.id)}
                      onStartEdit={() => {
                        setExpandedBlock(block.id)
                        if (editingBlock !== block.id) {
                          handleStartEdit(block)
                        }
                      }}
                      getBlockTypeBadge={getBlockTypeBadge}
                      detectProviderFromPrompt={detectProviderFromPrompt}
                    >
                      {/* Expanded content rendered as children */}
                      {expandedBlock === block.id && renderBlockExpandedContent(block)}
                    </SortableBlockItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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
