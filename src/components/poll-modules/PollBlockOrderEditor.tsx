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
import type { PollBlockType } from '@/types/database'

interface PollBlockOrderEditorProps {
  blockOrder: PollBlockType[]
  onChange: (newOrder: PollBlockType[]) => void
  disabled?: boolean
}

const BLOCK_LABELS: Record<PollBlockType, string> = {
  title: 'Title',
  question: 'Question',
  image: 'Image',
  options: 'Options'
}

const BLOCK_DESCRIPTIONS: Record<PollBlockType, string> = {
  title: 'Poll name/heading',
  question: 'The poll question text',
  image: 'Optional featured image',
  options: 'Voting buttons'
}

const ALL_BLOCK_TYPES: PollBlockType[] = ['title', 'question', 'image', 'options']

function SortableBlock({
  block,
  onRemove,
  disabled
}: {
  block: PollBlockType
  onRemove: () => void
  disabled?: boolean
}) {
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
      className={`flex items-center justify-between p-3 bg-white border rounded-lg ${
        isDragging ? 'shadow-lg border-purple-300' : 'border-gray-200'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-3">
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
        <div>
          <span className="font-medium text-gray-700">{BLOCK_LABELS[block]}</span>
          <span className="ml-2 text-xs text-gray-400">{BLOCK_DESCRIPTIONS[block]}</span>
        </div>
      </div>
      <button
        onClick={onRemove}
        disabled={disabled}
        className={`text-gray-400 hover:text-red-500 ${disabled ? 'cursor-not-allowed' : ''}`}
        title="Remove block"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default function PollBlockOrderEditor({
  blockOrder,
  onChange,
  disabled = false
}: PollBlockOrderEditorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const availableBlocks = ALL_BLOCK_TYPES.filter(
    block => !blockOrder.includes(block)
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = blockOrder.indexOf(active.id as PollBlockType)
      const newIndex = blockOrder.indexOf(over?.id as PollBlockType)

      if (oldIndex !== -1 && newIndex !== -1) {
        onChange(arrayMove(blockOrder, oldIndex, newIndex))
      }
    }
  }

  const handleRemoveBlock = (block: PollBlockType) => {
    onChange(blockOrder.filter(b => b !== block))
  }

  const handleAddBlock = (block: PollBlockType) => {
    onChange([...blockOrder, block])
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">Block Order</span>
          {blockOrder.length > 0 && (
            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
              {blockOrder.map(b => BLOCK_LABELS[b]).join(' → ')}
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
          {blockOrder.length === 0 ? (
            <p className="text-gray-500 text-sm italic">No blocks configured. Add blocks below.</p>
          ) : (
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
                      onRemove={() => handleRemoveBlock(block)}
                      disabled={disabled}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Add Block */}
          {availableBlocks.length > 0 && (
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Add block:</span>
                <div className="flex flex-wrap gap-2">
                  {availableBlocks.map(block => (
                    <button
                      key={block}
                      onClick={() => handleAddBlock(block)}
                      disabled={disabled}
                      className={`px-3 py-1 text-sm rounded-full border border-dashed border-gray-300
                        text-gray-600 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50
                        transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      + {BLOCK_LABELS[block]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-3 p-3 bg-purple-50 rounded-lg text-sm text-purple-700">
            <strong>Note:</strong> Image block only shows if the selected poll has an image uploaded.
          </div>

          <p className="text-xs text-gray-400 mt-2">
            Drag blocks to reorder. Remove unwanted blocks. Add blocks from the available options.
          </p>
        </div>
      )}
    </div>
  )
}
