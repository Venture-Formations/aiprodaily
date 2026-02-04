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
import type { FeedbackBlockType } from '@/types/database'

interface FeedbackBlockOrderEditorProps {
  blockOrder: FeedbackBlockType[]
  onChange: (newOrder: FeedbackBlockType[]) => void
  disabled?: boolean
}

const BLOCK_LABELS: Record<FeedbackBlockType, string> = {
  title: 'Title',
  body: 'Body Text',
  vote_options: 'Vote Options',
  sign_off: 'Sign-off',
  team_photos: 'Team Photos'
}

const BLOCK_DESCRIPTIONS: Record<FeedbackBlockType, string> = {
  title: 'Section heading (e.g., "That\'s it for today!")',
  body: 'Introductory text asking for feedback',
  vote_options: 'Star rating buttons for voting',
  sign_off: 'Closing message (e.g., "See you tomorrow!")',
  team_photos: 'Circular team member photos'
}

const ALL_BLOCK_TYPES: FeedbackBlockType[] = ['title', 'body', 'vote_options', 'sign_off', 'team_photos']

function SortableBlock({
  block,
  onRemove,
  disabled
}: {
  block: FeedbackBlockType
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
        isDragging ? 'shadow-lg border-yellow-300' : 'border-gray-200'
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
          <p className="text-xs text-gray-500">{BLOCK_DESCRIPTIONS[block]}</p>
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

export function FeedbackBlockOrderEditor({
  blockOrder,
  onChange,
  disabled = false
}: FeedbackBlockOrderEditorProps) {
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
      const oldIndex = blockOrder.indexOf(active.id as FeedbackBlockType)
      const newIndex = blockOrder.indexOf(over?.id as FeedbackBlockType)

      if (oldIndex !== -1 && newIndex !== -1) {
        onChange(arrayMove(blockOrder, oldIndex, newIndex))
      }
    }
  }

  const handleRemoveBlock = (block: FeedbackBlockType) => {
    onChange(blockOrder.filter(b => b !== block))
  }

  const handleAddBlock = (block: FeedbackBlockType) => {
    onChange([...blockOrder, block])
  }

  return (
    <div className="space-y-4">
      {blockOrder.length === 0 ? (
        <p className="text-gray-500 text-sm italic p-4 bg-gray-50 rounded-lg">
          No blocks configured. Add blocks below to build your feedback section.
        </p>
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
          <div className="text-sm text-gray-500 mb-2">Add block:</div>
          <div className="flex flex-wrap gap-2">
            {availableBlocks.map(block => (
              <button
                key={block}
                onClick={() => handleAddBlock(block)}
                disabled={disabled}
                className={`px-3 py-1.5 text-sm rounded-full border border-dashed border-gray-300
                  text-gray-600 hover:border-yellow-400 hover:text-yellow-700 hover:bg-yellow-50
                  transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                + {BLOCK_LABELS[block]}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Drag blocks to reorder. Remove blocks you don't want to show. The vote_options block is required for the feedback to function.
      </p>
    </div>
  )
}
