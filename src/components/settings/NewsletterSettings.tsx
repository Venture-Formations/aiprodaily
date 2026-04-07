'use client'

import { useState } from 'react'
import type { NewsletterSection } from '@/types/database'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SectionsPanel } from '@/components/ad-modules'
import { useNewsletterSettings } from './useNewsletterSettings'

function SortableSection({
  section, toggleSection, saving, onEditName,
}: {
  section: NewsletterSection
  toggleSection: (id: string, isActive: boolean) => void
  saving: boolean
  onEditName: (id: string, name: string) => Promise<void>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(section.name)
  const [editSaving, setEditSaving] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  const handleSaveName = async () => {
    if (editName.trim() === section.name) { setIsEditing(false); return }
    if (!editName.trim()) { alert('Section name cannot be empty'); return }
    setEditSaving(true)
    try {
      await onEditName(section.id, editName.trim())
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update name:', error)
      setEditName(section.name)
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center justify-between p-4 bg-white border rounded-lg ${isDragging ? 'shadow-lg' : 'shadow-sm'} ${section.is_active ? 'border-blue-300' : 'border-gray-200'}`}>
      <div className="flex items-center space-x-3 flex-1">
        <div {...attributes} {...listeners} className="flex-shrink-0 cursor-move p-2 text-gray-400 hover:text-gray-600" title="Drag to reorder">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zM6 6h8v2H6V6zm0 4h8v2H6v-2zm0 4h8v2H6v-2z"/>
          </svg>
        </div>
        <div className="flex-1">
          {isEditing ? (
            <div className="flex items-center space-x-2">
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Section name" disabled={editSaving} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditName(section.name); setIsEditing(false) } }} />
              <button onClick={handleSaveName} disabled={editSaving} className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">{editSaving ? 'Saving...' : 'Save'}</button>
              <button onClick={() => { setEditName(section.name); setIsEditing(false) }} disabled={editSaving} className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <h4 className="font-medium text-gray-900">{section.name}</h4>
              <button onClick={() => setIsEditing(true)} disabled={saving} className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50" title="Edit section name">Edit name</button>
            </div>
          )}
          <p className="text-sm text-gray-500">Display Order: {Math.floor(section.display_order / 10)}</p>
        </div>
      </div>
      <div className="flex items-center space-x-3">
        <span className={`text-sm ${section.is_active ? 'text-green-600' : 'text-gray-500'}`}>{section.is_active ? 'Active' : 'Inactive'}</span>
        <button onClick={() => toggleSection(section.id, !section.is_active)} disabled={saving} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${section.is_active ? 'bg-blue-600' : 'bg-gray-200'} ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${section.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
    </div>
  )
}

function NewsletterSettings() {
  const {
    sections, loading, saving, message, sensors,
    handleDragEnd, toggleSection, handleEditName,
  } = useNewsletterSettings()

  if (loading) {
    return <div className="text-center py-8">Loading newsletter settings...</div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900">Section Settings</h3>
          <p className="text-sm text-gray-600 mt-1">
            Manage newsletter section order and settings. Configure ad sections with block order, selection logic, and company cooldown.
          </p>
        </div>
        <SectionsPanel />
      </div>

      {message && (
        <div className={`p-4 rounded-md ${message.includes('successfully') ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {message}
        </div>
      )}
    </div>
  )
}

export default NewsletterSettings
