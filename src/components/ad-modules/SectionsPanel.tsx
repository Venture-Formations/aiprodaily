'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
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
import AdModuleSettings from './AdModuleSettings'
import type { NewsletterSection, AdModule, AdBlockType } from '@/types/database'

interface SectionsPanelProps {
  publicationId?: string // Optional - will be fetched from URL if not provided
}

type SectionItem =
  | { type: 'section'; data: NewsletterSection }
  | { type: 'ad_module'; data: AdModule }

function SortableSectionItem({
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
  const id = item.type === 'section' ? `section-${item.data.id}` : `module-${item.data.id}`
  const name = item.data.name
  const isActive = item.type === 'section' ? item.data.is_active : item.data.is_active
  const isAdModule = item.type === 'ad_module'

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
          {isAdModule && (
            <span className="flex-shrink-0 text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
              Ad
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

// Section settings component for regular newsletter sections
function SectionSettings({
  section,
  onUpdate,
  saving
}: {
  section: NewsletterSection
  onUpdate: (updates: Partial<NewsletterSection>) => Promise<void>
  saving: boolean
}) {
  const [localName, setLocalName] = useState(section.name)

  // Update local state when section changes
  useEffect(() => {
    setLocalName(section.name)
  }, [section.name])

  const handleNameChange = async (newName: string) => {
    if (newName.trim() && newName !== section.name) {
      await onUpdate({ name: newName.trim() })
    }
  }

  return (
    <div className="space-y-6">
      {/* Section Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Section Name</label>
        <input
          type="text"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={(e) => handleNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleNameChange(localName)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          disabled={saving}
          className="w-full text-xl font-semibold text-gray-900 bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 focus:outline-none transition-colors px-1 py-1"
        />
      </div>

      {/* Section Type Info */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-gray-700">Section Type:</span>
          <span className="text-sm px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full capitalize">
            {section.section_type || 'Standard'}
          </span>
        </div>
        <p className="text-sm text-gray-500">
          This is a standard newsletter section. Use the toggle in the section list to enable or disable it.
        </p>
      </div>
    </div>
  )
}

export default function SectionsPanel({ publicationId: propPublicationId }: SectionsPanelProps) {
  const pathname = usePathname()
  const [publicationId, setPublicationId] = useState<string | null>(propPublicationId || null)
  const [sections, setSections] = useState<NewsletterSection[]>([])
  const [adModules, setAdModules] = useState<AdModule[]>([])
  const [selectedItem, setSelectedItem] = useState<SectionItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cooldownDays, setCooldownDays] = useState(7)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newModuleName, setNewModuleName] = useState('')
  const [newSectionType, setNewSectionType] = useState<'ad' | 'standard'>('ad')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Fetch publication ID from slug if not provided
  useEffect(() => {
    if (propPublicationId) {
      setPublicationId(propPublicationId)
      return
    }

    if (pathname) {
      const match = pathname.match(/^\/dashboard\/([^\/]+)/)
      if (match && match[1]) {
        const slug = match[1]
        fetchPublicationId(slug)
      }
    }
  }, [pathname, propPublicationId])

  const fetchPublicationId = async (slug: string) => {
    try {
      const response = await fetch('/api/newsletters')
      if (!response.ok) throw new Error('Failed to fetch publications')
      const data = await response.json()
      const publication = data.newsletters?.find((n: { slug: string; id: string }) => n.slug === slug)
      if (publication) {
        setPublicationId(publication.id)
      } else {
        console.error('[SectionsPanel] Publication not found for slug:', slug)
        setLoading(false)
      }
    } catch (error) {
      console.error('[SectionsPanel] Error fetching publication:', error)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (publicationId) {
      fetchData()
    }
  }, [publicationId])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch newsletter sections
      const sectionsRes = await fetch('/api/settings/newsletter-sections')
      if (sectionsRes.ok) {
        const sectionsData = await sectionsRes.json()
        setSections(sectionsData.sections || [])
      }

      // Fetch ad modules
      const modulesRes = await fetch(`/api/ad-modules?publication_id=${publicationId}`)
      if (modulesRes.ok) {
        const modulesData = await modulesRes.json()
        setAdModules(modulesData.modules || [])
      }

      // Fetch cooldown setting
      const settingsRes = await fetch(`/api/settings/publication?key=ad_company_cooldown_days`)
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        setCooldownDays(parseInt(settingsData.value) || 7)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Combine and sort all items by display_order
  const allItems: SectionItem[] = [
    ...sections.map(s => ({ type: 'section' as const, data: s })),
    ...adModules.map(m => ({ type: 'ad_module' as const, data: m }))
  ].sort((a, b) => {
    const orderA = a.data.display_order ?? 999
    const orderB = b.data.display_order ?? 999
    return orderA - orderB
  })

  const itemIds = allItems.map(item =>
    item.type === 'section' ? `section-${item.data.id}` : `module-${item.data.id}`
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = itemIds.indexOf(active.id as string)
    const newIndex = itemIds.indexOf(over.id as string)

    if (oldIndex === -1 || newIndex === -1) return

    // Reorder local state
    const reorderedItems = arrayMove(allItems, oldIndex, newIndex)
    const newSections = reorderedItems
      .filter((item): item is { type: 'section'; data: NewsletterSection } => item.type === 'section')
      .map((item, idx) => ({ ...item.data, display_order: idx + 1 }))
    const newModules = reorderedItems
      .filter((item): item is { type: 'ad_module'; data: AdModule } => item.type === 'ad_module')
      .map((item, idx) => ({ ...item.data, display_order: idx + 1 }))

    setSections(newSections)
    setAdModules(newModules)

    // Save to server
    setSaving(true)
    try {
      // Update sections order
      if (newSections.length > 0) {
        await fetch('/api/settings/newsletter-sections', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sections: newSections.map(s => ({ id: s.id, display_order: s.display_order }))
          })
        })
      }

      // Update modules order
      if (newModules.length > 0) {
        await fetch('/api/ad-modules', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modules: newModules.map(m => ({ id: m.id, display_order: m.display_order }))
          })
        })
      }
    } catch (error) {
      console.error('Failed to save order:', error)
      // Revert on error
      fetchData()
    } finally {
      setSaving(false)
    }
  }

  const handleToggleSection = async (item: SectionItem) => {
    const newActive = !item.data.is_active
    setSaving(true)

    try {
      if (item.type === 'section') {
        await fetch('/api/settings/newsletter-sections', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section_id: item.data.id,
            is_active: newActive
          })
        })
        setSections(prev => prev.map(s =>
          s.id === item.data.id ? { ...s, is_active: newActive } : s
        ))
      } else {
        await fetch(`/api/ad-modules/${item.data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: newActive })
        })
        setAdModules(prev => prev.map(m =>
          m.id === item.data.id ? { ...m, is_active: newActive } : m
        ))
      }

      // Update selected item if it's the one being toggled
      if (selectedItem && selectedItem.data.id === item.data.id) {
        if (item.type === 'section') {
          setSelectedItem({
            type: 'section',
            data: { ...item.data, is_active: newActive }
          })
        } else {
          setSelectedItem({
            type: 'ad_module',
            data: { ...item.data, is_active: newActive }
          })
        }
      }
    } catch (error) {
      console.error('Failed to toggle:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleAddSection = async () => {
    if (!newModuleName.trim() || !publicationId) return

    setSaving(true)
    try {
      if (newSectionType === 'ad') {
        // Create ad module
        const res = await fetch('/api/ad-modules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publication_id: publicationId,
            name: newModuleName.trim()
          })
        })

        if (res.ok) {
          const data = await res.json()
          setAdModules(prev => [...prev, data.module])
          setSelectedItem({ type: 'ad_module', data: data.module })
        }
      } else {
        // Create standard section
        const res = await fetch('/api/settings/newsletter-sections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newModuleName.trim(),
            display_order: allItems.length + 1,
            is_active: true
          })
        })

        if (res.ok) {
          const data = await res.json()
          setSections(prev => [...prev, data.section])
          setSelectedItem({ type: 'section', data: data.section })
        }
      }

      setShowAddModal(false)
      setNewModuleName('')
      setNewSectionType('ad')
    } catch (error) {
      console.error('Failed to add section:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateModule = async (updates: Partial<AdModule>) => {
    if (!selectedItem || selectedItem.type !== 'ad_module') return

    const moduleId = selectedItem.data.id
    const res = await fetch(`/api/ad-modules/${moduleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })

    if (res.ok) {
      const data = await res.json()
      setAdModules(prev => prev.map(m => m.id === moduleId ? data.module : m))
      setSelectedItem({ type: 'ad_module', data: data.module })
    } else {
      throw new Error('Failed to update module')
    }
  }

  const handleDeleteModule = async () => {
    if (!selectedItem || selectedItem.type !== 'ad_module') return

    const moduleId = selectedItem.data.id
    const res = await fetch(`/api/ad-modules/${moduleId}`, {
      method: 'DELETE'
    })

    if (res.ok) {
      setAdModules(prev => prev.filter(m => m.id !== moduleId))
      setSelectedItem(null)
    }
  }

  const handleCooldownChange = async (days: number) => {
    try {
      await fetch('/api/settings/publication', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'ad_company_cooldown_days',
          value: days.toString()
        })
      })
      setCooldownDays(days)
    } catch (error) {
      console.error('Failed to update cooldown:', error)
    }
  }

  const handleUpdateSection = async (updates: Partial<NewsletterSection>) => {
    if (!selectedItem || selectedItem.type !== 'section') return

    const sectionId = selectedItem.data.id
    setSaving(true)
    try {
      const res = await fetch('/api/settings/newsletter-sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: sectionId,
          ...updates
        })
      })

      if (res.ok) {
        const data = await res.json()
        // Update local state
        setSections(prev => prev.map(s =>
          s.id === sectionId ? { ...s, ...updates } : s
        ))
        setSelectedItem({
          type: 'section',
          data: { ...selectedItem.data, ...updates } as NewsletterSection
        })
      } else {
        throw new Error('Failed to update section')
      }
    } catch (error) {
      console.error('Failed to update section:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="flex gap-6 h-[600px]">
      {/* Left Panel - Section List */}
      <div className="w-80 flex-shrink-0 flex flex-col">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-medium text-gray-700">Sections</h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Section
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {allItems.map(item => {
                  const id = item.type === 'section' ? `section-${item.data.id}` : `module-${item.data.id}`
                  const isSelected = selectedItem?.data.id === item.data.id && selectedItem?.type === item.type

                  return (
                    <SortableSectionItem
                      key={id}
                      item={item}
                      isSelected={isSelected}
                      onSelect={() => setSelectedItem(item)}
                      onToggle={() => handleToggleSection(item)}
                      disabled={saving}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Right Panel - Settings */}
      <div className="flex-1 bg-gray-50 rounded-lg p-6 overflow-y-auto">
        {selectedItem ? (
          selectedItem.type === 'ad_module' && publicationId ? (
            <AdModuleSettings
              module={selectedItem.data}
              publicationId={publicationId}
              onUpdate={handleUpdateModule}
              onDelete={handleDeleteModule}
              cooldownDays={cooldownDays}
              onCooldownChange={handleCooldownChange}
            />
          ) : selectedItem.type === 'ad_module' ? (
            <div className="text-gray-500">Loading publication...</div>
          ) : (
            <SectionSettings
              section={selectedItem.data}
              onUpdate={handleUpdateSection}
              saving={saving}
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>Select a section to view its settings</p>
          </div>
        )}
      </div>

      {/* Add Section Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Add New Section</h3>

            {/* Section Type Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Section Type</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setNewSectionType('ad')}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                    newSectionType === 'ad'
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <div className="font-medium">Ad Section</div>
                  <div className="text-xs mt-1 opacity-75">Configurable ad placement</div>
                </button>
                <button
                  type="button"
                  onClick={() => setNewSectionType('standard')}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                    newSectionType === 'standard'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <div className="font-medium">Standard</div>
                  <div className="text-xs mt-1 opacity-75">Content section</div>
                </button>
              </div>
            </div>

            {/* Section Name Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Section Name</label>
              <input
                type="text"
                value={newModuleName}
                onChange={(e) => setNewModuleName(e.target.value)}
                placeholder={newSectionType === 'ad' ? "e.g., Sidebar Sponsor" : "e.g., Featured Content"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewModuleName('')
                  setNewSectionType('ad')
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSection}
                disabled={!newModuleName.trim() || saving}
                className={`px-4 py-2 rounded-lg ${
                  newModuleName.trim() && !saving
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {saving ? 'Creating...' : 'Create Section'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
