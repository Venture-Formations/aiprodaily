'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { FeedbackBlock } from '@/types/database'

export interface SortableFeedbackBlockItemProps {
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

// Sortable block item component (matches TextBoxModuleSettings pattern)
export function SortableFeedbackBlockItem({
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
}: SortableFeedbackBlockItemProps) {
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
