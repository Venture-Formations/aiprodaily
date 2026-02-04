'use client'

import { useState, useEffect } from 'react'
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
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TeamPhotoManager } from './TeamPhotoManager'
import type { FeedbackModuleWithBlocks, FeedbackBlock, FeedbackVoteOption, FeedbackTeamMember } from '@/types/database'

interface FeedbackModuleSettingsProps {
  module: FeedbackModuleWithBlocks
  publicationId: string
  onUpdate: (updates: Partial<FeedbackModuleWithBlocks>) => Promise<void>
  onUpdateBlock: (blockId: string, updates: Partial<FeedbackBlock>) => Promise<void>
  onReorderBlocks: (blockIds: string[]) => Promise<void>
  onAddBlock?: (blockType: FeedbackBlock['block_type']) => Promise<void>
  onDeleteBlock?: (blockId: string) => Promise<void>
  onDelete: () => Promise<void>
}

// Sortable block item component (matches TextBoxModuleSettings pattern)
interface SortableBlockItemProps {
  block: FeedbackBlock
  isActive: boolean
  isExpanded: boolean
  saving: boolean
  onToggleExpand: () => void
  onToggleActive: () => void
  onDelete: () => void
  onStartEdit: () => void
  getBlockTypeBadge: (blockType: string) => React.ReactNode
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

  const getBlockLabel = (blockType: string) => {
    switch (blockType) {
      case 'title': return 'Title'
      case 'static_text': return 'Static Text'
      case 'vote_options': return 'Vote Options'
      case 'team_photos': return 'Team Photos'
      default: return blockType
    }
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
              {block.label || getBlockLabel(block.block_type)}
            </span>
            {getBlockTypeBadge(block.block_type)}
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
  const [localName, setLocalName] = useState(module.name)
  const [showName, setShowName] = useState(module.show_name ?? true)
  const [blocks, setBlocks] = useState<FeedbackBlock[]>(module.blocks || [])
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'blocks'>('general')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Block editing states
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null)
  const [editingBlock, setEditingBlock] = useState<string | null>(null)

  // Title editing
  const [editTitleText, setEditTitleText] = useState('')

  // Static text editing
  const [editStaticContent, setEditStaticContent] = useState('')
  const [editIsItalic, setEditIsItalic] = useState(false)
  const [editIsBold, setEditIsBold] = useState(false)

  // Vote options editing
  const [editVoteOptions, setEditVoteOptions] = useState<FeedbackVoteOption[]>([])

  // Team photos editing
  const [editTeamPhotos, setEditTeamPhotos] = useState<FeedbackTeamMember[]>([])

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    setLocalName(module.name)
    setShowName(module.show_name ?? true)
    setBlocks(module.blocks || [])
  }, [module])

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

  const handleAddBlock = async (blockType: FeedbackBlock['block_type']) => {
    if (!onAddBlock) return
    setSaving(true)
    try {
      await onAddBlock(blockType)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBlock = async (blockId: string) => {
    if (!onDeleteBlock) return
    setSaving(true)
    try {
      await onDeleteBlock(blockId)
      setBlocks(prev => prev.filter(b => b.id !== blockId))
      if (expandedBlock === blockId) setExpandedBlock(null)
      if (editingBlock === blockId) setEditingBlock(null)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleBlockActive = async (block: FeedbackBlock) => {
    setSaving(true)
    try {
      await onUpdateBlock(block.id, { is_enabled: !block.is_enabled })
      setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, is_enabled: !b.is_enabled } : b))
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
      await onReorderBlocks(updatedBlocks.map(b => b.id))
    } catch (error) {
      console.error('Failed to reorder blocks:', error)
      setBlocks(blocks) // Revert on error
    } finally {
      setSaving(false)
    }
  }

  const handleStartEdit = (block: FeedbackBlock) => {
    setEditingBlock(block.id)
    if (block.block_type === 'title') {
      setEditTitleText(block.title_text || '')
    } else if (block.block_type === 'static_text') {
      setEditStaticContent(block.static_content || '')
      setEditIsItalic(block.is_italic || false)
      setEditIsBold(block.is_bold || false)
    } else if (block.block_type === 'vote_options') {
      setEditVoteOptions(block.vote_options || [])
    } else if (block.block_type === 'team_photos') {
      setEditTeamPhotos(block.team_photos || [])
    }
  }

  const handleCancelEdit = () => {
    setEditingBlock(null)
    setEditTitleText('')
    setEditStaticContent('')
    setEditIsItalic(false)
    setEditIsBold(false)
    setEditVoteOptions([])
    setEditTeamPhotos([])
  }

  const handleSaveBlock = async (block: FeedbackBlock) => {
    setSaving(true)
    try {
      const updateData: Partial<FeedbackBlock> = {}

      if (block.block_type === 'title') {
        updateData.title_text = editTitleText
      } else if (block.block_type === 'static_text') {
        updateData.static_content = editStaticContent
        updateData.is_italic = editIsItalic
        updateData.is_bold = editIsBold
      } else if (block.block_type === 'vote_options') {
        updateData.vote_options = editVoteOptions
      } else if (block.block_type === 'team_photos') {
        updateData.team_photos = editTeamPhotos
      }

      await onUpdateBlock(block.id, updateData)
      setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, ...updateData } : b))
      setEditingBlock(null)
    } catch (error) {
      console.error('Failed to save block:', error)
      alert('Failed to save block. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const getBlockTypeBadge = (blockType: string) => {
    switch (blockType) {
      case 'title':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Title</span>
      case 'static_text':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Static Text</span>
      case 'vote_options':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Voting</span>
      case 'team_photos':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Team Photos</span>
      default:
        return null
    }
  }

  // Render expanded content for a block
  const renderBlockExpandedContent = (block: FeedbackBlock) => (
    <div className="border-t border-gray-200 p-4 bg-gray-50">
      {/* ===== TITLE BLOCK ===== */}
      {block.block_type === 'title' && (
        <div>
          {editingBlock === block.id ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title Text</label>
                <input
                  type="text"
                  value={editTitleText}
                  onChange={(e) => setEditTitleText(e.target.value)}
                  placeholder="That's it for today!"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={handleCancelEdit} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={() => handleSaveBlock(block)} disabled={saving} className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          ) : (
            <div>
              {block.title_text ? (
                <div className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200 font-medium">{block.title_text}</div>
              ) : (
                <p className="text-sm text-gray-400 italic bg-white p-3 rounded-lg border border-gray-200">No title text set</p>
              )}
              <button onClick={() => handleStartEdit(block)} className="mt-3 px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700">Edit Title</button>
            </div>
          )}
        </div>
      )}

      {/* ===== STATIC TEXT BLOCK ===== */}
      {block.block_type === 'static_text' && (
        <div>
          {editingBlock === block.id ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                <textarea
                  value={editStaticContent}
                  onChange={(e) => setEditStaticContent(e.target.value)}
                  placeholder="Enter your text content..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm resize-none"
                />
              </div>
              <div className="flex flex-wrap items-center gap-4 p-3 bg-gray-100 rounded-lg">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`bold-${block.id}`}
                    checked={editIsBold}
                    onChange={(e) => setEditIsBold(e.target.checked)}
                    className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
                  />
                  <label htmlFor={`bold-${block.id}`} className="text-sm text-gray-700">
                    <span className="font-bold">Bold</span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`italic-${block.id}`}
                    checked={editIsItalic}
                    onChange={(e) => setEditIsItalic(e.target.checked)}
                    className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
                  />
                  <label htmlFor={`italic-${block.id}`} className="text-sm text-gray-700">
                    <span className="italic">Italic</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={handleCancelEdit} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={() => handleSaveBlock(block)} disabled={saving} className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                {block.is_bold && <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded font-medium">Bold</span>}
                {block.is_italic && <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded font-medium">Italic</span>}
              </div>
              {block.static_content ? (
                <div className={`text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200 ${block.is_bold ? 'font-bold' : ''} ${block.is_italic ? 'italic' : ''}`}>{block.static_content}</div>
              ) : (
                <p className="text-sm text-gray-400 italic bg-white p-3 rounded-lg border border-gray-200">No content yet</p>
              )}
              <button onClick={() => handleStartEdit(block)} className="mt-3 px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700">Edit Content</button>
            </div>
          )}
        </div>
      )}

      {/* ===== VOTE OPTIONS BLOCK ===== */}
      {block.block_type === 'vote_options' && (
        <div>
          {editingBlock === block.id ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">Vote Options</label>
                  <button
                    onClick={() => {
                      const newValue = editVoteOptions.length > 0
                        ? Math.max(1, ...editVoteOptions.map(o => o.value)) + 1
                        : 1
                      setEditVoteOptions([
                        ...editVoteOptions,
                        { value: Math.min(newValue, 5), label: 'New Option', emoji: 'star' as const }
                      ].sort((a, b) => b.value - a.value))
                    }}
                    disabled={editVoteOptions.length >= 5}
                    className="text-sm text-cyan-600 hover:text-cyan-700 disabled:text-gray-400"
                  >
                    + Add Option
                  </button>
                </div>
                <div className="space-y-2">
                  {editVoteOptions.map((option, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2 w-20">
                        <span className="text-amber-400 text-lg">{'★'.repeat(Math.min(option.value, 5))}</span>
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={option.value}
                        onChange={(e) => {
                          const newOptions = [...editVoteOptions]
                          newOptions[index] = { ...newOptions[index], value: parseInt(e.target.value) || 1 }
                          newOptions.sort((a, b) => b.value - a.value)
                          setEditVoteOptions(newOptions)
                        }}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                      <input
                        type="text"
                        value={option.label}
                        onChange={(e) => {
                          const newOptions = [...editVoteOptions]
                          newOptions[index] = { ...newOptions[index], label: e.target.value }
                          setEditVoteOptions(newOptions)
                        }}
                        className="flex-1 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        placeholder="Option label"
                      />
                      <button
                        onClick={() => {
                          if (editVoteOptions.length <= 2) {
                            alert('You must have at least 2 vote options')
                            return
                          }
                          setEditVoteOptions(editVoteOptions.filter((_, i) => i !== index))
                        }}
                        className="text-gray-400 hover:text-red-500"
                        title="Remove option"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Options are sorted by star count (highest first). Min 2, max 5 options.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={handleCancelEdit} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={() => handleSaveBlock(block)} disabled={saving} className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          ) : (
            <div>
              {block.vote_options && block.vote_options.length > 0 ? (
                <div className="space-y-2">
                  {block.vote_options.map((option, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                      <span className="text-amber-400 text-lg w-20">{'★'.repeat(Math.min(option.value, 5))}</span>
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic bg-white p-3 rounded-lg border border-gray-200">No vote options configured</p>
              )}
              <button onClick={() => handleStartEdit(block)} className="mt-3 px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700">Edit Options</button>
            </div>
          )}
        </div>
      )}

      {/* ===== TEAM PHOTOS BLOCK ===== */}
      {block.block_type === 'team_photos' && (
        <div>
          {editingBlock === block.id ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Team Photos</label>
                <p className="text-sm text-gray-500 mb-3">
                  Add circular photos of your team (1-10 members). These appear at the bottom of the feedback section.
                </p>
                <TeamPhotoManager
                  photos={editTeamPhotos}
                  onChange={setEditTeamPhotos}
                  maxPhotos={10}
                  disabled={saving}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={handleCancelEdit} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={() => handleSaveBlock(block)} disabled={saving} className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          ) : (
            <div>
              {block.team_photos && block.team_photos.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {block.team_photos.map((photo, index) => (
                    <div key={index} className="text-center">
                      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100">
                        <img
                          src={photo.image_url}
                          alt={photo.name || 'Team member'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {photo.name && <p className="mt-1 text-xs text-gray-600 truncate w-16">{photo.name}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic bg-white p-3 rounded-lg border border-gray-200">No team photos added</p>
              )}
              <button onClick={() => handleStartEdit(block)} className="mt-3 px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700">Edit Photos</button>
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
          <span className="text-xs text-cyan-600 font-medium">Feedback Module</span>
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
                Display the section header in the newsletter.
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
              <p className="mb-2">Feedback modules support multiple block types:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Title</strong> - Section heading text</li>
                <li><strong>Static Text</strong> - Body or sign-off text with formatting</li>
                <li><strong>Vote Options</strong> - Star-based rating options</li>
                <li><strong>Team Photos</strong> - Circular photos of your team</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Blocks Tab */}
      {activeTab === 'blocks' && (
        <div className="space-y-4">
          {blocks.length === 0 ? (
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
                      isActive={block.is_enabled}
                      isExpanded={expandedBlock === block.id}
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
          {onAddBlock && (
            <div className="flex gap-2 pt-4 border-t">
              <button
                onClick={() => handleAddBlock('static_text')}
                disabled={saving}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 text-gray-700 transition-colors disabled:opacity-50"
              >
                + Static Text
              </button>
              <button
                onClick={() => handleAddBlock('vote_options')}
                disabled={saving}
                className="flex-1 px-3 py-2 text-sm border border-amber-200 rounded-lg hover:bg-amber-50 hover:border-amber-300 text-amber-700 transition-colors disabled:opacity-50"
              >
                + Vote Options
              </button>
              <button
                onClick={() => handleAddBlock('team_photos')}
                disabled={saving}
                className="flex-1 px-3 py-2 text-sm border border-green-200 rounded-lg hover:bg-green-50 hover:border-green-300 text-green-700 transition-colors disabled:opacity-50"
              >
                + Team Photos
              </button>
            </div>
          )}
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
    </div>
  )
}
