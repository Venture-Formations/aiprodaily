'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { NewsletterSection } from '@/types/database'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SectionsPanel } from '@/components/ad-modules'

function SortableSection({
  section,
  toggleSection,
  saving,
  onEditName
}: {
  section: NewsletterSection
  toggleSection: (id: string, isActive: boolean) => void
  saving: boolean
  onEditName: (id: string, name: string) => Promise<void>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(section.name)
  const [editSaving, setEditSaving] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleSaveName = async () => {
    if (editName.trim() === section.name) {
      setIsEditing(false)
      return
    }

    if (!editName.trim()) {
      alert('Section name cannot be empty')
      return
    }

    setEditSaving(true)
    try {
      await onEditName(section.id, editName.trim())
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update name:', error)
      setEditName(section.name) // Reset on error
    } finally {
      setEditSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditName(section.name)
    setIsEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-4 bg-white border rounded-lg ${
        isDragging ? 'shadow-lg' : 'shadow-sm'
      } ${section.is_active ? 'border-blue-300' : 'border-gray-200'}`}
    >
      <div className="flex items-center space-x-3 flex-1">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="flex-shrink-0 cursor-move p-2 text-gray-400 hover:text-gray-600"
          title="Drag to reorder"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zM6 6h8v2H6V6zm0 4h8v2H6v-2zm0 4h8v2H6v-2z"/>
          </svg>
        </div>

        {/* Section info */}
        <div className="flex-1">
          {isEditing ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Section name"
                disabled={editSaving}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName()
                  if (e.key === 'Escape') handleCancelEdit()
                }}
              />
              <button
                onClick={handleSaveName}
                disabled={editSaving}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {editSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={editSaving}
                className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <h4 className="font-medium text-gray-900">{section.name}</h4>
              <button
                onClick={() => setIsEditing(true)}
                disabled={saving}
                className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                title="Edit section name"
              >
                Edit name
              </button>
            </div>
          )}
          <p className="text-sm text-gray-500">Display Order: {Math.floor(section.display_order / 10)}</p>
        </div>
      </div>

      {/* Active toggle */}
      <div className="flex items-center space-x-3">
        <span className={`text-sm ${section.is_active ? 'text-green-600' : 'text-gray-500'}`}>
          {section.is_active ? 'Active' : 'Inactive'}
        </span>
        <button
          onClick={() => toggleSection(section.id, !section.is_active)}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            section.is_active ? 'bg-blue-600' : 'bg-gray-200'
          } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              section.is_active ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  )
}

function NewsletterSettings() {
  const pathname = usePathname()
  const [sections, setSections] = useState<NewsletterSection[]>([])
  const [publicationId, setPublicationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [message, setMessage] = useState('')

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Fetch publication ID from slug
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/^\/dashboard\/([^\/]+)/)
      if (match && match[1]) {
        const slug = match[1]
        fetch('/api/newsletters')
          .then(res => res.json())
          .then(data => {
            const publication = data.newsletters?.find((n: { slug: string; id: string }) => n.slug === slug)
            if (publication) {
              setPublicationId(publication.id)
            }
          })
          .catch(console.error)
      }
    }
  }, [pathname])

  useEffect(() => {
    fetchSections()
  }, [])

  const fetchSections = async () => {
    try {
      const response = await fetch('/api/settings/newsletter-sections')
      if (response.ok) {
        const data = await response.json()
        setSections(data.sections || [])
      }
    } catch (error) {
      console.error('Failed to fetch newsletter sections:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = sections.findIndex(section => section.id === active.id)
      const newIndex = sections.findIndex(section => section.id === over?.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newSections = arrayMove(sections, oldIndex, newIndex)

        // Update display_order based on new positions
        const updatedSections = newSections.map((section, index) => ({
          ...section,
          display_order: index + 1
        }))

        setSections(updatedSections)

        // Save new order to server
        try {
          await saveSectionOrder(updatedSections)
        } catch (error) {
          // Revert on error
          setSections(sections)
          setMessage('Failed to update section order. Please try again.')
        }
      }
    }
  }

  const saveSectionOrder = async (updatedSections: NewsletterSection[]) => {
    setSaving(true)
    try {
      const response = await fetch('/api/settings/newsletter-sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections: updatedSections.map(s => ({
            id: s.id,
            display_order: s.display_order
          }))
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save section order')
      }

      setMessage('Section order updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      throw error
    } finally {
      setSaving(false)
    }
  }

  const runMigration = async () => {
    setMigrating(true)
    setMessage('')

    try {
      const response = await fetch('/api/debug/migrate-newsletter-sections')
      if (response.ok) {
        const data = await response.json()
        setMessage(`Migration successful! ${data.message}`)
        await fetchSections() // Refresh the sections
      } else {
        const errorData = await response.json()
        setMessage(`Migration failed: ${errorData.message || 'Unknown error'}`)
      }
    } catch (error) {
      setMessage('Migration failed: Network error. Please try again.')
      console.error('Migration error:', error)
    } finally {
      setMigrating(false)
      setTimeout(() => setMessage(''), 5000)
    }
  }


  const toggleSection = async (sectionId: string, isActive: boolean) => {
    setSaving(true)
    try {
      const response = await fetch('/api/settings/newsletter-sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: sectionId,
          is_active: isActive
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update section status')
      }

      // Update local state
      setSections(prev => prev.map(section =>
        section.id === sectionId
          ? { ...section, is_active: isActive }
          : section
      ))

      setMessage(`Section ${isActive ? 'activated' : 'deactivated'} successfully!`)
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage('Failed to update section status. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleEditName = async (sectionId: string, newName: string) => {
    try {
      const response = await fetch('/api/settings/newsletter-sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: sectionId,
          name: newName
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update section name')
      }

      // Update local state
      setSections(prev => prev.map(section =>
        section.id === sectionId
          ? { ...section, name: newName }
          : section
      ))

      setMessage('Section name updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage('Failed to update section name. Please try again.')
      throw error
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading newsletter settings...</div>
  }

  return (
    <div className="space-y-6">
      {/* Section Settings - Unified Section Management */}
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
        <div className={`p-4 rounded-md ${
          message.includes('successfully')
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message}
        </div>
      )}
    </div>
  )
}

export default NewsletterSettings
