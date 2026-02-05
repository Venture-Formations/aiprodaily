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

function SortableBlock({
  block,
  config,
  onToggle,
  onSettingChange,
  disabled
}: {
  block: AIAppBlockType
  config: ProductCardBlockConfig[keyof ProductCardBlockConfig] | undefined
  onToggle: () => void
  onSettingChange: (key: string, value: string) => void
  disabled?: boolean
}) {
  const [showSettings, setShowSettings] = useState(false)
  const isEnabled = config?.enabled ?? true

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

  const hasSettings = block === 'logo' || block === 'title' || block === 'description' || block === 'tagline'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border rounded-lg ${
        isDragging ? 'shadow-lg border-blue-300' : 'border-gray-200'
      } ${disabled ? 'opacity-60' : ''} ${!isEnabled ? 'bg-gray-50' : ''}`}
    >
      {/* Main row */}
      <div className="flex items-center justify-between p-3">
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
          <span className={`font-medium ${isEnabled ? 'text-gray-700' : 'text-gray-400'}`}>
            {BLOCK_LABELS[block]}
          </span>

          {/* Settings summary badge */}
          {hasSettings && isEnabled && (
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded">
              {block === 'logo' && config && 'style' in config && 'position' in config && (
                <>{config.style}, {config.position}</>
              )}
              {(block === 'title' || block === 'description' || block === 'tagline') && config && 'size' in config && (
                <>{config.size}</>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Settings button */}
          {hasSettings && isEnabled && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              disabled={disabled}
              className={`p-1.5 rounded hover:bg-gray-100 ${showSettings ? 'bg-gray-100 text-blue-600' : 'text-gray-400'}`}
              title="Block settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}

          {/* Enable/disable toggle */}
          <button
            onClick={onToggle}
            disabled={disabled}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              isEnabled ? 'bg-green-600' : 'bg-gray-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                isEnabled ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Settings panel (expandable) */}
      {showSettings && isEnabled && hasSettings && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100">
          <div className="pt-3 space-y-3">
            {/* Logo settings */}
            {block === 'logo' && (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-600">Style</label>
                  <select
                    value={(config as any)?.style || 'square'}
                    onChange={(e) => onSettingChange('style', e.target.value)}
                    disabled={disabled}
                    className="px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                    disabled={disabled}
                    className="px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                  disabled={disabled}
                  className="px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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
  const [isOpen, setIsOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Build full list: blocks in order, then disabled blocks at the end
  const enabledBlocks = blockOrder.filter(block => {
    const cfg = blockConfig[block]
    return cfg?.enabled !== false
  })

  const disabledBlocks = ALL_BLOCK_TYPES.filter(block => {
    const cfg = blockConfig[block]
    return cfg?.enabled === false || !blockOrder.includes(block)
  })

  // For display, show all blocks in order with their enabled state
  const displayBlocks = [...blockOrder, ...ALL_BLOCK_TYPES.filter(b => !blockOrder.includes(b))]

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const activeBlock = active.id as AIAppBlockType
      const overBlock = over?.id as AIAppBlockType

      // Only reorder within enabled blocks
      const currentOrder = [...blockOrder]
      const oldIndex = currentOrder.indexOf(activeBlock)
      const newIndex = currentOrder.indexOf(overBlock)

      if (oldIndex !== -1 && newIndex !== -1) {
        onOrderChange(arrayMove(currentOrder, oldIndex, newIndex))
      } else if (oldIndex === -1 && newIndex !== -1) {
        // Adding a new block by dragging
        const newOrder = [...currentOrder]
        newOrder.splice(newIndex, 0, activeBlock)
        onOrderChange(newOrder)
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

    // If enabling, add to block order if not present
    if (newEnabled && !blockOrder.includes(block)) {
      onOrderChange([...blockOrder, block])
    }
    // If disabling, remove from block order
    if (!newEnabled && blockOrder.includes(block)) {
      onOrderChange(blockOrder.filter(b => b !== block))
    }
  }

  const handleSettingChange = (block: AIAppBlockType, key: string, value: string) => {
    const currentConfig = blockConfig[block] || getDefaultBlockConfig(block)
    const newConfig = {
      ...blockConfig,
      [block]: { ...currentConfig, [key]: value }
    }
    onConfigChange(newConfig)
  }

  // Get enabled blocks summary for header
  const enabledSummary = blockOrder
    .filter(b => blockConfig[b]?.enabled !== false)
    .map(b => BLOCK_LABELS[b])
    .join(' → ')

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">Block Order & Settings</span>
          {enabledSummary && (
            <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full max-w-xs truncate">
              {enabledSummary}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      {isOpen && (
        <div className="p-4 space-y-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={ALL_BLOCK_TYPES}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {ALL_BLOCK_TYPES.map(block => (
                  <SortableBlock
                    key={block}
                    block={block}
                    config={blockConfig[block]}
                    onToggle={() => handleToggleBlock(block)}
                    onSettingChange={(key, value) => handleSettingChange(block, key, value)}
                    disabled={disabled}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <p className="text-xs text-gray-400 mt-2">
            Toggle blocks on/off. Drag to reorder. Click the gear icon to configure block-specific settings.
          </p>
        </div>
      )}
    </div>
  )
}
