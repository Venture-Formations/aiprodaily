'use client'

import { useState } from 'react'
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
import type {
  AIAppBlockType,
  ProductCardBlockConfig,
  ProductCardLogoStyle,
  ProductCardLogoPosition,
  ProductCardTextSize
} from '@/types/database'

interface AIAppBlockOrderEditorProps {
  blockOrder: AIAppBlockType[]
  blockConfig: ProductCardBlockConfig
  onOrderChange: (newOrder: AIAppBlockType[]) => void
  onConfigChange: (newConfig: ProductCardBlockConfig) => void
  disabled?: boolean
}

const BLOCK_LABELS: Record<AIAppBlockType, string> = {
  title: 'Title',
  logo: 'Logo',
  image: 'Screenshot',
  tagline: 'Tagline',
  description: 'Description',
  button: 'Button'
}

const ALL_BLOCK_TYPES: AIAppBlockType[] = ['logo', 'title', 'description', 'tagline', 'image', 'button']

const SIZE_OPTIONS: { value: ProductCardTextSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' }
]

const LOGO_STYLE_OPTIONS: { value: ProductCardLogoStyle; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'round', label: 'Round' }
]

const LOGO_POSITION_OPTIONS: { value: ProductCardLogoPosition; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'inline', label: 'Inline' }
]

// Get default config for a block type
function getDefaultBlockConfig(blockType: AIAppBlockType): ProductCardBlockConfig[keyof ProductCardBlockConfig] {
  switch (blockType) {
    case 'logo':
      return { enabled: true, style: 'square' as ProductCardLogoStyle, position: 'left' as ProductCardLogoPosition }
    case 'title':
    case 'description':
    case 'tagline':
      return { enabled: true, size: 'medium' as ProductCardTextSize }
    case 'image':
    case 'button':
      return { enabled: true }
    default:
      return { enabled: true }
  }
}

// Get badge text for a block's settings
function getSettingsBadge(block: AIAppBlockType, config: ProductCardBlockConfig[keyof ProductCardBlockConfig] | undefined): string | null {
  if (!config) return null

  if (block === 'logo' && 'style' in config && 'position' in config) {
    return `${config.style}, ${config.position}`
  }
  if ((block === 'title' || block === 'description' || block === 'tagline') && 'size' in config) {
    return config.size as string
  }
  return null
}

function SortableBlock({
  block,
  config,
  onToggle,
  onDelete,
  onSettingChange,
  disabled
}: {
  block: AIAppBlockType
  config: ProductCardBlockConfig[keyof ProductCardBlockConfig] | undefined
  onToggle: () => void
  onDelete: () => void
  onSettingChange: (key: string, value: string) => void
  disabled?: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isEnabled = config?.enabled ?? true
  const hasSettings = block === 'logo' || block === 'title' || block === 'description' || block === 'tagline'
  const settingsBadge = getSettingsBadge(block, config)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border rounded-lg ${
        isDragging ? 'shadow-lg border-blue-300' : 'border-gray-200'
      } ${disabled ? 'opacity-60' : ''} ${!isEnabled ? 'opacity-50' : ''}`}
    >
      {/* Main row */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className={`text-gray-400 hover:text-gray-600 ${disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
            disabled={disabled}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </button>

          {/* Block name */}
          <span className={`font-medium ${isEnabled ? 'text-gray-900' : 'text-gray-400'}`}>
            {BLOCK_LABELS[block]}
          </span>

          {/* Settings badge(s) */}
          {settingsBadge && (
            <span className={`text-xs px-2 py-0.5 rounded ${isEnabled ? 'bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-400'}`}>
              {settingsBadge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Enable/disable toggle */}
          <button
            onClick={onToggle}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isEnabled ? 'bg-cyan-500' : 'bg-gray-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>

          {/* Delete button */}
          <button
            onClick={onDelete}
            disabled={disabled}
            className="text-gray-400 hover:text-gray-600 p-1"
            title="Remove block"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>

          {/* Expand chevron */}
          {hasSettings && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              disabled={disabled}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <svg
                className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Settings panel (expandable) */}
      {isExpanded && hasSettings && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100">
          <div className="pt-4 space-y-4">
            {/* Logo settings */}
            {block === 'logo' && (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-600">Style</label>
                  <select
                    value={(config as any)?.style || 'square'}
                    onChange={(e) => onSettingChange('style', e.target.value)}
                    disabled={disabled || !isEnabled}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {LOGO_STYLE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-600">Position</label>
                  <select
                    value={(config as any)?.position || 'left'}
                    onChange={(e) => onSettingChange('position', e.target.value)}
                    disabled={disabled || !isEnabled}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {LOGO_POSITION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Text size settings */}
            {(block === 'title' || block === 'description' || block === 'tagline') && (
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-600">Size</label>
                <select
                  value={(config as any)?.size || 'medium'}
                  onChange={(e) => onSettingChange('size', e.target.value)}
                  disabled={disabled || !isEnabled}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {SIZE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AIAppBlockOrderEditor({
  blockOrder,
  blockConfig,
  onOrderChange,
  onConfigChange,
  disabled = false
}: AIAppBlockOrderEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Get blocks that are not in the current order (available to add)
  const availableBlocks = ALL_BLOCK_TYPES.filter(block => !blockOrder.includes(block))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id && over) {
      const activeBlock = active.id as AIAppBlockType
      const overBlock = over.id as AIAppBlockType

      const oldIndex = blockOrder.indexOf(activeBlock)
      const newIndex = blockOrder.indexOf(overBlock)

      if (oldIndex !== -1 && newIndex !== -1) {
        onOrderChange(arrayMove(blockOrder, oldIndex, newIndex))
      }
    }
  }

  const handleToggleBlock = (block: AIAppBlockType) => {
    const currentConfig = blockConfig[block] || getDefaultBlockConfig(block)
    const isCurrentlyEnabled = currentConfig?.enabled ?? true
    const newEnabled = !isCurrentlyEnabled

    const newConfig = {
      ...blockConfig,
      [block]: { ...currentConfig, enabled: newEnabled }
    }
    onConfigChange(newConfig)
  }

  const handleDeleteBlock = (block: AIAppBlockType) => {
    // Remove from block order
    onOrderChange(blockOrder.filter(b => b !== block))
    // Optionally reset config (or keep it for if they re-add)
  }

  const handleAddBlock = (block: AIAppBlockType) => {
    // Add to end of block order
    onOrderChange([...blockOrder, block])
    // Ensure config exists and is enabled
    const currentConfig = blockConfig[block] || getDefaultBlockConfig(block)
    const newConfig = {
      ...blockConfig,
      [block]: { ...currentConfig, enabled: true }
    }
    onConfigChange(newConfig)
  }

  const handleSettingChange = (block: AIAppBlockType, key: string, value: string) => {
    const currentConfig = blockConfig[block] || getDefaultBlockConfig(block)
    const newConfig = {
      ...blockConfig,
      [block]: { ...currentConfig, [key]: value }
    }
    onConfigChange(newConfig)
  }

  return (
    <div className="space-y-4">
      {/* Block list */}
      {blockOrder.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={blockOrder}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {blockOrder.map(block => (
                <SortableBlock
                  key={block}
                  block={block}
                  config={blockConfig[block]}
                  onToggle={() => handleToggleBlock(block)}
                  onDelete={() => handleDeleteBlock(block)}
                  onSettingChange={(key, value) => handleSettingChange(block, key, value)}
                  disabled={disabled}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
          No blocks added. Use the buttons below to add blocks.
        </div>
      )}

      {/* Add block buttons */}
      {availableBlocks.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
          {availableBlocks.map(block => (
            <button
              key={block}
              onClick={() => handleAddBlock(block)}
              disabled={disabled}
              className="px-4 py-2 text-sm font-medium text-purple-600 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + {BLOCK_LABELS[block]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
