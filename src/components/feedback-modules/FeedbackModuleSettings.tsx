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
  onDelete: () => Promise<void>
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  title: 'Title',
  static_text: 'Static Text',
  vote_options: 'Vote Options',
  team_photos: 'Team Photos'
}

const BLOCK_TYPE_ICONS: Record<string, string> = {
  title: 'T',
  static_text: 'P',
  vote_options: '★',
  team_photos: '👥'
}

interface SortableBlockItemProps {
  block: FeedbackBlock
  onToggleEnabled: (enabled: boolean) => void
  disabled: boolean
}

function SortableBlockItem({ block, onToggleEnabled, disabled }: SortableBlockItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const displayLabel = block.label || BLOCK_TYPE_LABELS[block.block_type] || block.block_type

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-white rounded-lg border ${
        block.is_enabled ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
      } ${isDragging ? 'shadow-lg' : ''}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        disabled={disabled}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 disabled:opacity-50"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
        </svg>
      </button>

      {/* Block type icon */}
      <span className="w-8 h-8 flex items-center justify-center text-lg bg-yellow-100 rounded-lg">
        {BLOCK_TYPE_ICONS[block.block_type] || '?'}
      </span>

      {/* Block label */}
      <span className={`flex-1 font-medium ${block.is_enabled ? 'text-gray-900' : 'text-gray-400'}`}>
        {displayLabel}
      </span>

      {/* Enabled toggle */}
      <button
        onClick={() => onToggleEnabled(!block.is_enabled)}
        disabled={disabled}
        className={`px-3 py-1 text-sm rounded-full transition-colors ${
          block.is_enabled
            ? 'bg-yellow-500 text-white hover:bg-yellow-600'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        } disabled:opacity-50`}
      >
        {block.is_enabled ? 'Enabled' : 'Disabled'}
      </button>
    </div>
  )
}

export function FeedbackModuleSettings({
  module,
  publicationId,
  onUpdate,
  onUpdateBlock,
  onReorderBlocks,
  onDelete
}: FeedbackModuleSettingsProps) {
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [activeTab, setActiveTab] = useState<'blocks' | 'content'>('blocks')
  const [blocks, setBlocks] = useState<FeedbackBlock[]>(module.blocks || [])

  // Form state
  const [name, setName] = useState(module.name)

  // Update state when module changes
  useEffect(() => {
    setName(module.name)
    setBlocks(module.blocks || [])
  }, [module])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const showSaveStatus = (status: 'saved' | 'error') => {
    setSaveStatus(status)
    setTimeout(() => setSaveStatus('idle'), 2000)
  }

  const saveModule = async (updates: Partial<FeedbackModuleWithBlocks>) => {
    setSaving(true)
    try {
      await onUpdate(updates)
      showSaveStatus('saved')
    } catch (error) {
      console.error('Error saving feedback module:', error)
      showSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const saveBlock = async (blockId: string, updates: Partial<FeedbackBlock>) => {
    setSaving(true)
    try {
      await onUpdateBlock(blockId, updates)
      // Update local state
      setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, ...updates } : b))
      showSaveStatus('saved')
    } catch (error) {
      console.error('Error saving block:', error)
      showSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const handleNameBlur = () => {
    if (name.trim() && name !== module.name) {
      saveModule({ name: name.trim() })
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = blocks.findIndex(b => b.id === active.id)
    const newIndex = blocks.findIndex(b => b.id === over.id)

    const newBlocks = arrayMove(blocks, oldIndex, newIndex)
    setBlocks(newBlocks)

    // Save new order
    setSaving(true)
    try {
      await onReorderBlocks(newBlocks.map(b => b.id))
      showSaveStatus('saved')
    } catch (error) {
      console.error('Error reordering blocks:', error)
      setBlocks(blocks) // Revert on error
      showSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleBlockEnabled = async (blockId: string, enabled: boolean) => {
    await saveBlock(blockId, { is_enabled: enabled })
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this feedback module? This cannot be undone.')) {
      await onDelete()
    }
  }

  // Get enabled blocks
  const enabledBlocks = blocks.filter(b => b.is_enabled)

  // Find specific blocks for content editing
  const titleBlock = blocks.find(b => b.block_type === 'title')
  const staticTextBlocks = blocks.filter(b => b.block_type === 'static_text')
  const voteOptionsBlock = blocks.find(b => b.block_type === 'vote_options')
  const teamPhotosBlock = blocks.find(b => b.block_type === 'team_photos')

  return (
    <div className="space-y-6">
      {/* Header with name and save status */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleNameBlur()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            disabled={saving}
            className="w-full text-xl font-semibold text-gray-900 bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-yellow-500 focus:outline-none transition-colors px-1 py-1"
          />
          <span className="text-xs text-yellow-600 font-medium">Feedback Module</span>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saved' && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-sm text-red-600">Error saving</span>
          )}
          {saving && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('blocks')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'blocks'
                ? 'border-yellow-500 text-yellow-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Blocks ({enabledBlocks.length})
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'content'
                ? 'border-yellow-500 text-yellow-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Content
          </button>
        </nav>
      </div>

      {/* Blocks Tab */}
      {activeTab === 'blocks' && (
        <div className="space-y-6">
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-800">
              Configure which blocks appear in your feedback section and in what order.
              Drag to reorder, toggle to enable/disable blocks.
            </p>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={blocks.map(b => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {blocks.map(block => (
                  <SortableBlockItem
                    key={block.id}
                    block={block}
                    onToggleEnabled={(enabled) => handleToggleBlockEnabled(block.id, enabled)}
                    disabled={saving}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Content Tab */}
      {activeTab === 'content' && (
        <div className="space-y-6">
          {/* Title Block */}
          {titleBlock && titleBlock.is_enabled && (
            <TitleBlockEditor
              block={titleBlock}
              onSave={(updates) => saveBlock(titleBlock.id, updates)}
              disabled={saving}
            />
          )}

          {/* Static Text Blocks */}
          {staticTextBlocks.filter(b => b.is_enabled).map(block => (
            <StaticTextBlockEditor
              key={block.id}
              block={block}
              onSave={(updates) => saveBlock(block.id, updates)}
              disabled={saving}
            />
          ))}

          {/* Vote Options Block */}
          {voteOptionsBlock && voteOptionsBlock.is_enabled && (
            <VoteOptionsBlockEditor
              block={voteOptionsBlock}
              onSave={(updates) => saveBlock(voteOptionsBlock.id, updates)}
              disabled={saving}
            />
          )}

          {/* Team Photos Block */}
          {teamPhotosBlock && teamPhotosBlock.is_enabled && (
            <TeamPhotosBlockEditor
              block={teamPhotosBlock}
              onSave={(updates) => saveBlock(teamPhotosBlock.id, updates)}
              disabled={saving}
            />
          )}

          {/* Info when no blocks are enabled */}
          {enabledBlocks.length === 0 && (
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-800">
                No blocks enabled. Go to the Blocks tab to enable blocks for your feedback section.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Danger Zone */}
      <div className="pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-red-600 mb-3">Danger Zone</h4>
        <button
          onClick={handleDelete}
          disabled={saving}
          className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-300 rounded-lg transition-colors disabled:opacity-50"
        >
          Delete Feedback Module
        </button>
      </div>
    </div>
  )
}

// Title Block Editor
function TitleBlockEditor({
  block,
  onSave,
  disabled
}: {
  block: FeedbackBlock
  onSave: (updates: Partial<FeedbackBlock>) => Promise<void>
  disabled: boolean
}) {
  const [text, setText] = useState(block.title_text || '')

  useEffect(() => {
    setText(block.title_text || '')
  }, [block.title_text])

  const handleBlur = () => {
    if (text !== block.title_text) {
      onSave({ title_text: text })
    }
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Title
      </label>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 disabled:bg-gray-100"
        placeholder="That's it for today!"
      />
    </div>
  )
}

// Static Text Block Editor
function StaticTextBlockEditor({
  block,
  onSave,
  disabled
}: {
  block: FeedbackBlock
  onSave: (updates: Partial<FeedbackBlock>) => Promise<void>
  disabled: boolean
}) {
  const [content, setContent] = useState(block.static_content || '')
  const [isItalic, setIsItalic] = useState(block.is_italic || false)
  const [isBold, setIsBold] = useState(block.is_bold || false)

  useEffect(() => {
    setContent(block.static_content || '')
    setIsItalic(block.is_italic || false)
    setIsBold(block.is_bold || false)
  }, [block.static_content, block.is_italic, block.is_bold])

  const handleBlur = () => {
    if (content !== block.static_content || isItalic !== block.is_italic || isBold !== block.is_bold) {
      onSave({ static_content: content || null, is_italic: isItalic, is_bold: isBold })
    }
  }

  const label = block.label || 'Static Text'

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleBlur}
        disabled={disabled}
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 resize-none disabled:bg-gray-100"
        placeholder="Enter text content..."
      />
      <div className="flex items-center gap-4 mt-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isItalic}
            onChange={(e) => {
              setIsItalic(e.target.checked)
              onSave({ static_content: content || null, is_italic: e.target.checked, is_bold: isBold })
            }}
            disabled={disabled}
            className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
          />
          <span className="text-sm text-gray-600 italic">Italic</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isBold}
            onChange={(e) => {
              setIsBold(e.target.checked)
              onSave({ static_content: content || null, is_italic: isItalic, is_bold: e.target.checked })
            }}
            disabled={disabled}
            className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
          />
          <span className="text-sm text-gray-600 font-bold">Bold</span>
        </label>
      </div>
    </div>
  )
}

// Vote Options Block Editor
function VoteOptionsBlockEditor({
  block,
  onSave,
  disabled
}: {
  block: FeedbackBlock
  onSave: (updates: Partial<FeedbackBlock>) => Promise<void>
  disabled: boolean
}) {
  const [options, setOptions] = useState<FeedbackVoteOption[]>(block.vote_options || [])

  useEffect(() => {
    setOptions(block.vote_options || [])
  }, [block.vote_options])

  const saveOptions = (newOptions: FeedbackVoteOption[]) => {
    setOptions(newOptions)
    onSave({ vote_options: newOptions })
  }

  const addOption = () => {
    const newValue = options.length > 0
      ? Math.max(1, ...options.map(o => o.value)) + 1
      : 1
    const newOptions = [
      ...options,
      { value: newValue, label: 'New Option', emoji: 'star' as const }
    ].sort((a, b) => b.value - a.value)
    saveOptions(newOptions)
  }

  const updateOption = (index: number, updates: Partial<FeedbackVoteOption>) => {
    const newOptions = [...options]
    newOptions[index] = { ...newOptions[index], ...updates }
    newOptions.sort((a, b) => b.value - a.value)
    saveOptions(newOptions)
  }

  const removeOption = (index: number) => {
    if (options.length <= 2) {
      alert('You must have at least 2 vote options')
      return
    }
    saveOptions(options.filter((_, i) => i !== index))
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-medium text-gray-700">
          Vote Options
        </label>
        <button
          onClick={addOption}
          disabled={options.length >= 5 || disabled}
          className="text-sm text-yellow-600 hover:text-yellow-700 disabled:text-gray-400"
        >
          + Add Option
        </button>
      </div>
      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 w-20">
              <span className="text-amber-400 text-lg">{'★'.repeat(Math.min(option.value, 5))}</span>
            </div>
            <input
              type="number"
              min="1"
              max="5"
              value={option.value}
              onChange={(e) => updateOption(index, { value: parseInt(e.target.value) || 1 })}
              disabled={disabled}
              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 disabled:bg-gray-100"
            />
            <input
              type="text"
              value={option.label}
              onChange={(e) => updateOption(index, { label: e.target.value })}
              disabled={disabled}
              className="flex-1 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 disabled:bg-gray-100"
              placeholder="Option label"
            />
            <button
              onClick={() => removeOption(index)}
              disabled={disabled}
              className="text-gray-400 hover:text-red-500 disabled:opacity-50"
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
  )
}

// Team Photos Block Editor
function TeamPhotosBlockEditor({
  block,
  onSave,
  disabled
}: {
  block: FeedbackBlock
  onSave: (updates: Partial<FeedbackBlock>) => Promise<void>
  disabled: boolean
}) {
  const [photos, setPhotos] = useState<FeedbackTeamMember[]>(block.team_photos || [])

  useEffect(() => {
    setPhotos(block.team_photos || [])
  }, [block.team_photos])

  const handleChange = (newPhotos: FeedbackTeamMember[]) => {
    setPhotos(newPhotos)
    onSave({ team_photos: newPhotos })
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Team Photos
      </label>
      <p className="text-sm text-gray-500 mb-3">
        Add circular photos of your team (1-10 members). These appear at the bottom of the feedback section.
      </p>
      <TeamPhotoManager
        photos={photos}
        onChange={handleChange}
        maxPhotos={10}
        disabled={disabled}
      />
    </div>
  )
}
