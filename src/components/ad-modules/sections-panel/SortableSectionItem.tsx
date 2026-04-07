'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { SectionItem } from './types'
import { getItemId, MODULE_BADGES } from './types'

export default function SortableSectionItem({
  item,
  isSelected,
  onSelect,
  onToggle,
  disabled
}: {
  item: SectionItem
  isSelected: boolean
  onSelect: () => void
  onToggle: () => void
  disabled: boolean
}) {
  const id = getItemId(item)
  const name = item.data.name
  const isActive = item.data.is_active
  const badge = MODULE_BADGES[item.type]

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-100 border-2 border-blue-500'
          : 'bg-white border border-gray-200 hover:border-gray-300'
      } ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </button>

        {/* Name and Badge */}
        <div className="flex items-center gap-2 min-w-0">
          <span className={`font-medium truncate ${!isActive ? 'text-gray-400' : 'text-gray-700'}`}>
            {name}
          </span>
          {badge && (
            <span className={`flex-shrink-0 text-xs px-2 py-0.5 ${badge.bg} ${badge.text} rounded-full`}>
              {badge.label}
            </span>
          )}
        </div>
      </div>

      {/* Active Toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        disabled={disabled}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
          isActive ? 'bg-blue-600' : 'bg-gray-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
            isActive ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
