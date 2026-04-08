'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ArticleModuleCriteria } from '@/types/database'

interface EvaluationOrderListProps {
  criteria: ArticleModuleCriteria[]
  saving: string | null
  onReorder: (orderedCriteriaIds: string[]) => void
}

function SortableOrderItem({ criterion, position }: { criterion: ArticleModuleCriteria; position: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: criterion.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-1.5 rounded border text-sm ${
        isDragging
          ? 'bg-blue-50 border-blue-300 shadow-sm z-10'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none"
        aria-label={`Drag to reorder ${criterion.name}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </button>
      <span className="w-5 text-center font-semibold text-blue-600">{position}</span>
      <span className="text-gray-700 truncate">{criterion.name}</span>
    </div>
  )
}

export function EvaluationOrderList({ criteria, saving, onReorder }: EvaluationOrderListProps) {
  const sorted = useMemo(() =>
    [...criteria]
      .filter(c => c.is_active)
      .sort((a, b) => (a.evaluation_order || a.criteria_number) - (b.evaluation_order || b.criteria_number)),
    [criteria]
  )

  const [items, setItems] = useState(sorted)
  const pendingSave = useRef(false)

  // Sync from props only when not in the middle of a save
  useEffect(() => {
    if (!pendingSave.current) {
      setItems(sorted)
    }
  }, [sorted])

  // Clear pending flag when save completes
  useEffect(() => {
    if (saving !== 'eval_order' && pendingSave.current) {
      pendingSave.current = false
    }
  }, [saving])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex(c => c.id === active.id)
    const newIndex = items.findIndex(c => c.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)
    pendingSave.current = true
    setItems(reordered)
    onReorder(reordered.map(c => c.id))
  }

  return (
    <div className="p-4 border-b border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h5 className="text-xs font-medium text-gray-500 uppercase">Evaluation Order</h5>
        <span className="text-xs text-gray-400">Drag to reorder</span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {items.map((criterion, index) => (
              <SortableOrderItem key={criterion.id} criterion={criterion} position={index + 1} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {saving === 'eval_order' && (
        <p className="mt-2 text-xs text-gray-500">Saving order...</p>
      )}
    </div>
  )
}
