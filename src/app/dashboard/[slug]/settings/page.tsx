'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Layout from '@/components/Layout'
import type { NewsletterSection } from '@/types/database'
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
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import {
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SectionsPanel } from '@/components/ad-modules'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('system')

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Settings
          </h1>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'system', name: 'System Status' },
                { id: 'business', name: 'Publication Settings' },
                { id: 'newsletter', name: 'Sections' },
                { id: 'email', name: 'Email' },
                { id: 'ai-prompts', name: 'AI Prompts' },
                { id: 'ai-apps', name: 'AI Apps' },
                { id: 'rss', name: 'RSS Feeds' },
                { id: 'blocked-domains', name: 'Blocked Domains' },
                { id: 'notifications', name: 'Notifications' },
                { id: 'users', name: 'Users' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-brand-primary text-brand-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'system' && <SystemStatus />}
          {activeTab === 'business' && <BusinessSettings />}
          {activeTab === 'newsletter' && <NewsletterSettings />}
          {activeTab === 'email' && <EmailSettings />}
          {activeTab === 'ai-prompts' && <AIPromptsSettings />}
          {activeTab === 'ai-apps' && <AIAppsSettings />}
          {activeTab === 'rss' && <RSSFeeds />}
          {activeTab === 'blocked-domains' && <BlockedDomainsSettings />}
          {activeTab === 'notifications' && <Notifications />}
          {activeTab === 'users' && <Users />}
        </div>
      </div>
    </Layout>
  )
}

// Sortable Section Component
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
  const [sections, setSections] = useState<NewsletterSection[]>([])
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

function SystemStatus() {
  const [status, setStatus] = useState<any>(null)
  const [scheduleDisplay, setScheduleDisplay] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Get newsletter slug from pathname
  const pathname = usePathname()
  const newsletterSlug = pathname ? pathname.match(/^\/dashboard\/([^\/]+)/)?.[1] : null

  useEffect(() => {
    fetchSystemStatus()
    fetchScheduleDisplay()
  }, [])

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/health')
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error('Failed to fetch system status:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchScheduleDisplay = async () => {
    if (!newsletterSlug) return

    try {
      const response = await fetch(`/api/settings/schedule-display?publication_id=${newsletterSlug}`)
      if (response.ok) {
        const data = await response.json()
        setScheduleDisplay(data)
      }
    } catch (error) {
      console.error('Failed to fetch schedule display:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading system status...</div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">System Health</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 border rounded-lg">
            <div className={`text-2xl font-bold mb-1 ${
              status?.status === 'healthy' ? 'text-green-600' : 'text-red-600'
            }`}>
              {status?.status === 'healthy' ? '✓' : '✗'}
            </div>
            <div className="text-sm text-gray-600">Overall Status</div>
            <div className="text-xs text-gray-500 mt-1">
              {status?.status || 'Unknown'}
            </div>
          </div>

          <div className="text-center p-4 border rounded-lg">
            <div className={`text-2xl font-bold mb-1 ${
              status?.checks?.database?.healthy ? 'text-green-600' : 'text-red-600'
            }`}>
              {status?.checks?.database?.healthy ? '✓' : '✗'}
            </div>
            <div className="text-sm text-gray-600">Database</div>
            <div className="text-xs text-gray-500 mt-1">Connection</div>
          </div>

          <div className="text-center p-4 border rounded-lg">
            <div className={`text-2xl font-bold mb-1 ${
              status?.checks?.rssFeeds?.healthy ? 'text-green-600' : 'text-red-600'
            }`}>
              {status?.checks?.rssFeeds?.healthy ? '✓' : '✗'}
            </div>
            <div className="text-sm text-gray-600">RSS Feeds</div>
            <div className="text-xs text-gray-500 mt-1">Processing</div>
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Last checked: {status?.timestamp ? new Date(status.timestamp).toLocaleString() : 'Never'}
        </div>

        <button
          onClick={fetchSystemStatus}
          className="mt-4 bg-brand-primary hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
        >
          Refresh Status
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Cron Jobs</h3>

        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b">
            <div>
              <div className="font-medium">RSS Processing</div>
              <div className="text-sm text-gray-600">
                Daily at {scheduleDisplay?.rssProcessing || '20:30'} CT
              </div>
            </div>
            <span className={`text-sm ${scheduleDisplay?.reviewEnabled ? 'text-green-600' : 'text-gray-500'}`}>
              {scheduleDisplay?.reviewEnabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <div>
              <div className="font-medium">Subject Line Generation</div>
              <div className="text-sm text-gray-600">
                Daily at {scheduleDisplay?.subjectGeneration || '20:45'} CT
              </div>
            </div>
            <span className={`text-sm ${scheduleDisplay?.reviewEnabled ? 'text-green-600' : 'text-gray-500'}`}>
              {scheduleDisplay?.reviewEnabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <div>
              <div className="font-medium">Issue Creation</div>
              <div className="text-sm text-gray-600">
                Daily at {scheduleDisplay?.issueCreation || '20:50'} CT
              </div>
            </div>
            <span className={`text-sm ${scheduleDisplay?.reviewEnabled ? 'text-green-600' : 'text-gray-500'}`}>
              {scheduleDisplay?.reviewEnabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <div>
              <div className="font-medium">Final Publication Send</div>
              <div className="text-sm text-gray-600">
                Daily at {scheduleDisplay?.finalSend || '04:55'} CT
              </div>
            </div>
            <span className={`text-sm ${scheduleDisplay?.dailyEnabled ? 'text-green-600' : 'text-gray-500'}`}>
              {scheduleDisplay?.dailyEnabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <div>
              <div className="font-medium">Metrics Import</div>
              <div className="text-sm text-gray-600">Daily at 6:00 AM CT</div>
            </div>
            <span className="text-green-600 text-sm">Active</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <div>
              <div className="font-medium">Health Checks</div>
              <div className="text-sm text-gray-600">Every 5 minutes (8 AM - 10 PM CT)</div>
            </div>
            <span className="text-green-600 text-sm">Active</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function RSSFeeds() {
  const [feeds, setFeeds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({
    url: '',
    name: '',
    description: '',
    active: true,
    use_for_primary_section: true,
    use_for_secondary_section: false
  })

  useEffect(() => {
    fetchFeeds()
  }, [])

  const fetchFeeds = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/rss-feeds')
      if (response.ok) {
        const data = await response.json()
        setFeeds(data.feeds || [])
      }
    } catch (error) {
      console.error('Failed to fetch RSS feeds:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (feed: any) => {
    setEditingId(feed.id)
    setEditForm({ ...feed })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const handleSave = async (id: string) => {
    try {
      const response = await fetch(`/api/rss-feeds/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })

      if (response.ok) {
        await fetchFeeds()
        setEditingId(null)
        setEditForm({})
      }
    } catch (error) {
      console.error('Failed to update feed:', error)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return

    try {
      const response = await fetch(`/api/rss-feeds/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchFeeds()
      }
    } catch (error) {
      console.error('Failed to delete feed:', error)
    }
  }

  const handleAddFeed = async () => {
    if (!addForm.url || !addForm.name) {
      alert('Please fill in required fields: URL and Name')
      return
    }

    try {
      const response = await fetch('/api/rss-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm)
      })

      if (response.ok) {
        await fetchFeeds()
        setShowAddForm(false)
        setAddForm({
          url: '',
          name: '',
          description: '',
          active: true,
          use_for_primary_section: true,
          use_for_secondary_section: false
        })
      }
    } catch (error) {
      console.error('Failed to add feed:', error)
    }
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">RSS Feed Configuration</h3>
          <p className="text-sm text-gray-600 mt-1">Manage RSS feeds and assign them to Primary (top) and Secondary (bottom) article sections</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-brand-primary hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
        >
          + Add Feed
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Add New RSS Feed</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Feed URL *
              </label>
              <input
                type="url"
                value={addForm.url}
                onChange={(e) => setAddForm({ ...addForm, url: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="https://example.com/feed.xml"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Feed Name *
              </label>
              <input
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="Accounting Today"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={addForm.description}
                onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                rows={2}
                placeholder="Latest accounting news and updates"
              />
            </div>
            <div>
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={addForm.active}
                  onChange={(e) => setAddForm({ ...addForm, active: e.target.checked })}
                  className="mr-2"
                />
                <span className="font-medium text-gray-700">Active (process this feed)</span>
              </label>
            </div>
            <div className="border-t pt-3 mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Use for Article Sections:
              </label>
              <div className="space-y-2 pl-2">
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={addForm.use_for_primary_section}
                    onChange={(e) => setAddForm({ ...addForm, use_for_primary_section: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-gray-700">Primary Section (Top Articles)</span>
                </label>
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={addForm.use_for_secondary_section}
                    onChange={(e) => setAddForm({ ...addForm, use_for_secondary_section: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-gray-700">Secondary Section (Additional Articles)</span>
                </label>
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAddFeed}
              className="px-4 py-2 bg-brand-primary hover:bg-blue-700 text-white rounded text-sm"
            >
              Add Feed
            </button>
          </div>
        </div>
      )}

      {/* Feeds Table */}
      {feeds.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-3">📡</div>
          <div className="font-medium">No RSS feeds configured</div>
          <div className="text-sm">Click "Add Feed" to get started with Breaking News</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Feed Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  URL
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sections
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Processed
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {feeds.map((feed) => (
                <tr key={feed.id} className={!feed.active ? 'bg-gray-50' : ''}>
                  {editingId === feed.id ? (
                    <>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editForm.name || ''}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="url"
                          value={editForm.url || ''}
                          onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <label className="flex items-center text-xs">
                            <input
                              type="checkbox"
                              checked={editForm.use_for_primary_section ?? false}
                              onChange={(e) => setEditForm({ ...editForm, use_for_primary_section: e.target.checked })}
                              className="mr-1"
                            />
                            Primary
                          </label>
                          <label className="flex items-center text-xs">
                            <input
                              type="checkbox"
                              checked={editForm.use_for_secondary_section ?? false}
                              onChange={(e) => setEditForm({ ...editForm, use_for_secondary_section: e.target.checked })}
                              className="mr-1"
                            />
                            Secondary
                          </label>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <label className="flex items-center text-sm">
                          <input
                            type="checkbox"
                            checked={editForm.active}
                            onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                            className="mr-1"
                          />
                          Active
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        {feed.last_processed ? new Date(feed.last_processed).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleSave(feed.id)}
                          className="text-green-600 hover:text-green-900 mr-3"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{feed.name}</div>
                        {feed.description && (
                          <div className="text-xs text-gray-500 mt-1">{feed.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                        {feed.url}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        {feed.use_for_primary_section && (
                          <div className="text-blue-600">✓ Primary</div>
                        )}
                        {feed.use_for_secondary_section && (
                          <div className="text-purple-600">✓ Secondary</div>
                        )}
                        {!feed.use_for_primary_section && !feed.use_for_secondary_section && (
                          <span className="text-gray-400 italic">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {feed.active ? (
                          <span className="text-green-600">✓ Active</span>
                        ) : (
                          <span className="text-gray-400">Inactive</span>
                        )}
                        {feed.processing_errors > 0 && (
                          <div className="text-xs text-red-600 mt-1">
                            {feed.processing_errors} error{feed.processing_errors > 1 ? 's' : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {feed.last_processed ? new Date(feed.last_processed).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleEdit(feed)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(feed.id, feed.name)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stats */}
      {feeds.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{feeds.length}</div>
            <div className="text-sm text-gray-600">Total Feeds</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {feeds.filter(f => f.active).length}
            </div>
            <div className="text-sm text-gray-600">Active</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {feeds.filter(f => f.processing_errors > 0).length}
            </div>
            <div className="text-sm text-gray-600">With Errors</div>
          </div>
        </div>
      )}
    </div>
  )
}

function Notifications() {
  const [settings, setSettings] = useState({
    campaignStatusUpdates: true,
    workflowFailure: true,
    systemErrors: true,
    rssProcessingUpdates: true,
    rssProcessingIncomplete: true,
    lowArticleCount: true,
    scheduledSendFailure: true,
    scheduledSendTiming: true,
    healthCheckAlerts: true,
    emailDeliveryUpdates: true
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/slack')
      if (response.ok) {
        const data = await response.json()
        setSettings(prev => ({ ...prev, ...data }))
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        setMessage('Notification settings saved successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (error) {
      console.error('Failed to save notification settings:', error)
      setMessage('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = (field: string, value: boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const notificationTypes = [
    {
      id: 'campaignStatusUpdates',
      name: 'Issue Status Updates',
      description: 'Notifications when campaigns are marked as "Changes Made" by reviewers',
      examples: [
        'issue marked as "Changes Made" for Dec 15 by John Doe',
        'issue requires review before proceeding to send',
        'Manual edits detected - status updated to "Changes Made"'
      ]
    },
    {
      id: 'workflowFailure',
      name: 'Workflow Failures',
      description: 'Critical alerts when automated workflows fail after all retry attempts',
      examples: [
        'Workflow failed after retries - issue ID: abc123',
        'RSS processing workflow terminated due to repeated errors',
        'issue creation workflow failed - manual intervention required'
      ]
    },
    {
      id: 'rssProcessingUpdates',
      name: 'RSS Processing Completion',
      description: 'Success notifications when RSS processing completes',
      examples: [
        'RSS Processing Complete - issue abc123 - 8 articles generated',
        'Archive: 12 articles, 45 posts preserved',
        'Ready for review and scheduling'
      ]
    },
    {
      id: 'rssProcessingIncomplete',
      name: 'RSS Processing Incomplete',
      description: 'Alerts when RSS processing fails partway through steps',
      examples: [
        'RSS Processing Incomplete - Completed: Archive, Fetch - Failed at: Score Posts',
        'issue may be missing content or in invalid state',
        'Error: OpenAI API timeout during article generation'
      ]
    },
    {
      id: 'lowArticleCount',
      name: 'Low Article Count (≤6 articles)',
      description: 'Alerts when article count is too low for quality delivery',
      examples: [
        'Low Article Count Alert - 4 articles (≤6 threshold)',
        'Newsletter may not have enough content for quality delivery',
        'Action Required: Manual review before sending'
      ]
    },
    {
      id: 'scheduledSendFailure',
      name: 'Scheduled Send Failures',
      description: 'Alerts when scheduled sends fail to deliver to SendGrid',
      examples: [
        'Scheduled Send Failed - issue abc123',
        'Send triggered but no email delivered to SendGrid',
        'SendGrid API authentication failed during scheduled send'
      ]
    },
    {
      id: 'scheduledSendTiming',
      name: 'Scheduled Send Timing Issues',
      description: 'Warnings when scheduling logic detects configuration problems',
      examples: [
        'Found 2 issues with ready_to_send status but shouldRun returned false',
        'Timing configuration issue detected',
        'Send window may be misconfigured'
      ]
    },
    {
      id: 'emailDeliveryUpdates',
      name: 'Email Delivery Success',
      description: 'SendGrid campaign delivery confirmations',
      examples: [
        'Review issue sent successfully for issue abc123',
        'Final issue sent successfully for issue xyz789',
        'SendGrid delivery confirmed'
      ]
    },
    {
      id: 'healthCheckAlerts',
      name: 'Health Check Alerts',
      description: 'System health monitoring alerts for degraded or down services',
      examples: [
        'Health Check: RSS Feeds is degraded - 3 feeds have multiple errors',
        'Health Check: Database is down - Unable to connect',
        'System health check failed - some components not healthy'
      ]
    },
    {
      id: 'systemErrors',
      name: 'System Errors',
      description: 'Critical system-wide errors from various components',
      examples: [
        'Critical error in rss_processor during article generation',
        'System Alert: Database connection lost',
        'Authentication system failure detected'
      ]
    }
  ]

  return (
    <div className="space-y-6">
      {/* Slack Notification Types */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Slack Notification Types</h3>
        <p className="text-sm text-gray-600 mb-6">
          Control which types of notifications are sent to your Slack channel.
        </p>

        <div className="space-y-6">
          {notificationTypes.map((type) => (
            <div key={type.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 mb-1">{type.name}</div>
                  <div className="text-sm text-gray-600 mb-3">{type.description}</div>

                  {/* Examples Section */}
                  <div className="bg-white rounded-md p-3 border border-gray-100">
                    <div className="text-xs font-medium text-gray-500 mb-2">Example notifications:</div>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {type.examples.map((example, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-gray-400 mr-2">•</span>
                          <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-xs">{example}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex flex-col items-end ml-4">
                  <button
                    onClick={() => handleToggle(type.id, !settings[type.id as keyof typeof settings])}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings[type.id as keyof typeof settings] ? 'bg-brand-primary' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings[type.id as keyof typeof settings] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className={`mt-2 text-sm font-medium ${
                    settings[type.id as keyof typeof settings] ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {settings[type.id as keyof typeof settings] ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-brand-primary hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-md font-medium"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {message && (
        <div className={`mt-4 p-4 rounded-md ${
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

function EmailSettings() {
  const [settings, setSettings] = useState({
    // Email Provider Toggle
    emailProvider: 'mailerlite' as 'mailerlite' | 'sendgrid',

    // MailerLite Settings
    mailerliteReviewGroupId: '',
    mailerliteMainGroupId: '',
    mailerliteSecondaryGroupId: '',

    // SendGrid Settings
    sendgridReviewListId: '',
    sendgridMainListId: '',
    sendgridSecondaryListId: '',
    sendgridSenderId: '',
    sendgridUnsubscribeGroupId: '',

    // Common Email Settings
    fromEmail: 'scoop@stcscoop.com',
    senderName: 'St. Cloud Scoop',

    // Review Schedule Settings (Central Time)
    reviewScheduleEnabled: true,
    rssProcessingTime: '20:30',  // 8:30 PM
    issueCreationTime: '20:50',  // 8:50 PM
    scheduledSendTime: '21:00',  // 9:00 PM

    // Daily Newsletter Settings (Central Time)
    dailyScheduleEnabled: false,
    dailyissueCreationTime: '04:30',  // 4:30 AM
    dailyScheduledSendTime: '04:55',  // 4:55 AM

    // Secondary Newsletter Settings (Central Time)
    secondaryScheduleEnabled: false,
    secondaryissueCreationTime: '04:30',  // 4:30 AM
    secondaryScheduledSendTime: '04:55',  // 4:55 AM
    secondarySendDays: [1, 2, 3, 4, 5]  // Mon-Fri by default
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [maxTopArticles, setMaxTopArticles] = useState<number>(3)
  const [maxBottomArticles, setMaxBottomArticles] = useState<number>(3)
  const [savingMaxArticles, setSavingMaxArticles] = useState(false)
  const [primaryLookbackHours, setPrimaryLookbackHours] = useState<number>(72)
  const [secondaryLookbackHours, setSecondaryLookbackHours] = useState<number>(36)
  const [savingLookbackHours, setSavingLookbackHours] = useState(false)
  const [dedupLookbackDays, setDedupLookbackDays] = useState<number>(3)
  const [dedupStrictnessThreshold, setDedupStrictnessThreshold] = useState<number>(0.80)
  const [savingDedupSettings, setSavingDedupSettings] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    loadSettings()
    loadMaxArticles()
    loadLookbackHours()
    loadDedupSettings()
  }, [])

  const loadSettings = async () => {
    try {
      console.log('FRONTEND: Loading email settings...')
      const response = await fetch('/api/settings/email')
      if (response.ok) {
        const data = await response.json()
        console.log('FRONTEND: Loaded settings from API:', data)

        // Exclude max articles fields - they have their own state and save button
        const { max_top_articles, max_bottom_articles, ...emailSettings } = data

        // Convert string boolean values back to actual booleans
        const processedData = {
          ...emailSettings,
          reviewScheduleEnabled: emailSettings.reviewScheduleEnabled === 'true',
          dailyScheduleEnabled: emailSettings.dailyScheduleEnabled === 'true',
          secondaryScheduleEnabled: emailSettings.secondaryScheduleEnabled === 'true'
        }
        console.log('FRONTEND: Processed settings with boolean conversion (max articles excluded):', processedData)
        setSettings(processedData)  // Don't merge with prev - use fresh data from API
        setIsLoaded(true)
        console.log('FRONTEND: Settings state updated')
      }
    } catch (error) {
      console.error('FRONTEND: Failed to load email settings:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    // Exclude lookback hours and dedup settings from email settings save (they have their own save buttons)
    const emailSettings: any = { ...settings }
    delete emailSettings.primary_article_lookback_hours
    delete emailSettings.secondary_article_lookback_hours
    delete emailSettings.dedup_historical_lookback_days
    delete emailSettings.dedup_strictness_threshold

    console.log('FRONTEND: Saving email settings:', emailSettings)

    try {
      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailSettings)
      })

      console.log('FRONTEND: Response status:', response.status)

      if (response.ok) {
        const result = await response.json()
        console.log('FRONTEND: Save successful:', result)
        setMessage('Settings saved successfully!')
        // Don't reload - keep current state to avoid clearing user's input
        setTimeout(() => setMessage(''), 3000)
      } else {
        const errorData = await response.json()
        console.error('FRONTEND: Save failed:', errorData)
        throw new Error('Failed to save settings')
      }
    } catch (error) {
      setMessage('Failed to save settings. Please try again.')
      console.error('FRONTEND: Save error:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: string, value: string | boolean | number[]) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const loadMaxArticles = async () => {
    try {
      const response = await fetch('/api/settings/email')
      if (response.ok) {
        const data = await response.json()

        // Data is a flat object, not { settings: [...] }
        if (data.max_top_articles) {
          setMaxTopArticles(parseInt(data.max_top_articles))
        }
        if (data.max_bottom_articles) {
          setMaxBottomArticles(parseInt(data.max_bottom_articles))
        }
      }
    } catch (error) {
      console.error('Failed to load max articles settings:', error)
    }
  }

  const saveMaxArticles = async () => {
    if (maxTopArticles < 1 || maxTopArticles > 10) {
      alert('Max primary articles must be between 1 and 10')
      return
    }
    if (maxBottomArticles < 1 || maxBottomArticles > 10) {
      alert('Max secondary articles must be between 1 and 10')
      return
    }

    setSavingMaxArticles(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_top_articles: maxTopArticles.toString(),
          max_bottom_articles: maxBottomArticles.toString()
        })
      })

      if (response.ok) {
        setMessage('Max articles settings updated successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to update settings')
      }
    } catch (error) {
      setMessage('Failed to update max articles settings. Please try again.')
      console.error('Save error:', error)
    } finally {
      setSavingMaxArticles(false)
    }
  }

  const loadLookbackHours = async () => {
    try {
      const response = await fetch('/api/settings/email')
      if (response.ok) {
        const data = await response.json()

        if (data.primary_article_lookback_hours) {
          setPrimaryLookbackHours(parseInt(data.primary_article_lookback_hours))
        }
        if (data.secondary_article_lookback_hours) {
          setSecondaryLookbackHours(parseInt(data.secondary_article_lookback_hours))
        }
      }
    } catch (error) {
      console.error('Failed to load lookback hours settings:', error)
    }
  }

  const saveLookbackHours = async () => {
    if (primaryLookbackHours < 1 || primaryLookbackHours > 168) {
      alert('Primary article lookback hours must be between 1 and 168 (1 week)')
      return
    }
    if (secondaryLookbackHours < 1 || secondaryLookbackHours > 168) {
      alert('Secondary article lookback hours must be between 1 and 168 (1 week)')
      return
    }

    setSavingLookbackHours(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_article_lookback_hours: primaryLookbackHours.toString(),
          secondary_article_lookback_hours: secondaryLookbackHours.toString()
        })
      })

      if (response.ok) {
        setMessage('Article lookback hours updated successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to update settings')
      }
    } catch (error) {
      setMessage('Failed to update lookback hours. Please try again.')
      console.error('Save error:', error)
    } finally {
      setSavingLookbackHours(false)
    }
  }

  const loadDedupSettings = async () => {
    try {
      const response = await fetch('/api/settings/email')
      if (response.ok) {
        const data = await response.json()

        if (data.dedup_historical_lookback_days) {
          setDedupLookbackDays(parseInt(data.dedup_historical_lookback_days))
        }
        if (data.dedup_strictness_threshold) {
          setDedupStrictnessThreshold(parseFloat(data.dedup_strictness_threshold))
        }
      }
    } catch (error) {
      console.error('Failed to load deduplication settings:', error)
    }
  }

  const saveDedupSettings = async () => {
    if (dedupLookbackDays < 1 || dedupLookbackDays > 14) {
      alert('Historical lookback days must be between 1 and 14')
      return
    }
    if (dedupStrictnessThreshold < 0.5 || dedupStrictnessThreshold > 1.0) {
      alert('Strictness threshold must be between 0.5 and 1.0')
      return
    }

    setSavingDedupSettings(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dedup_historical_lookback_days: dedupLookbackDays.toString(),
          dedup_strictness_threshold: dedupStrictnessThreshold.toString()
        })
      })

      if (response.ok) {
        setMessage('Deduplication settings updated successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to update settings')
      }
    } catch (error) {
      setMessage('Failed to update deduplication settings. Please try again.')
      console.error('Save error:', error)
    } finally {
      setSavingDedupSettings(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Email Provider Selection */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Email Service Provider</h3>
        <p className="text-sm text-gray-600 mb-4">
          Choose which email service provider to use for sending newsletters. Configure both providers below to enable easy switching.
        </p>

        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={() => handleChange('emailProvider', 'mailerlite')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
              settings.emailProvider === 'mailerlite'
                ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-medium'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
              <span>MailerLite</span>
            </div>
            {settings.emailProvider === 'mailerlite' && (
              <div className="text-xs mt-1 text-brand-primary">Active Provider</div>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleChange('emailProvider', 'sendgrid')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
              settings.emailProvider === 'sendgrid'
                ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-medium'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
              <span>SendGrid</span>
            </div>
            {settings.emailProvider === 'sendgrid' && (
              <div className="text-xs mt-1 text-brand-primary">Active Provider</div>
            )}
          </button>
        </div>
      </div>

      {/* Common Email Settings */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Sender Settings</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Email
            </label>
            <input
              type="email"
              value={settings.fromEmail}
              onChange={(e) => handleChange('fromEmail', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sender Name
            </label>
            <input
              type="text"
              value={settings.senderName}
              onChange={(e) => handleChange('senderName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>
        </div>
      </div>

      {/* MailerLite Configuration */}
      <div className={`bg-white shadow rounded-lg p-6 ${settings.emailProvider !== 'mailerlite' ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">MailerLite Configuration</h3>
          {settings.emailProvider === 'mailerlite' && (
            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
              Active
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Review Group ID
            </label>
            <input
              type="text"
              value={settings.mailerliteReviewGroupId}
              onChange={(e) => handleChange('mailerliteReviewGroupId', e.target.value)}
              placeholder="MailerLite group ID for review emails"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Main Group ID
            </label>
            <input
              type="text"
              value={settings.mailerliteMainGroupId}
              onChange={(e) => handleChange('mailerliteMainGroupId', e.target.value)}
              placeholder="MailerLite group ID for main newsletter"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Secondary Group ID
            </label>
            <input
              type="text"
              value={settings.mailerliteSecondaryGroupId}
              onChange={(e) => handleChange('mailerliteSecondaryGroupId', e.target.value)}
              placeholder="MailerLite group ID for secondary sends"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>
        </div>
      </div>

      {/* SendGrid Configuration */}
      <div className={`bg-white shadow rounded-lg p-6 ${settings.emailProvider !== 'sendgrid' ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">SendGrid Configuration</h3>
          {settings.emailProvider === 'sendgrid' && (
            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
              Active
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Review List ID
            </label>
            <input
              type="text"
              value={settings.sendgridReviewListId}
              onChange={(e) => handleChange('sendgridReviewListId', e.target.value)}
              placeholder="SendGrid list ID for review emails"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Main List ID
            </label>
            <input
              type="text"
              value={settings.sendgridMainListId}
              onChange={(e) => handleChange('sendgridMainListId', e.target.value)}
              placeholder="SendGrid list ID for main newsletter"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Secondary List ID
            </label>
            <input
              type="text"
              value={settings.sendgridSecondaryListId}
              onChange={(e) => handleChange('sendgridSecondaryListId', e.target.value)}
              placeholder="SendGrid list ID for secondary sends"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sender ID
            </label>
            <input
              type="text"
              value={settings.sendgridSenderId}
              onChange={(e) => handleChange('sendgridSenderId', e.target.value)}
              placeholder="SendGrid verified sender ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unsubscribe Group ID
            </label>
            <input
              type="text"
              value={settings.sendgridUnsubscribeGroupId}
              onChange={(e) => handleChange('sendgridUnsubscribeGroupId', e.target.value)}
              placeholder="SendGrid unsubscribe group ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>
        </div>
      </div>

      {/* Automated Publication Review Schedule */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Automated Publication Review Schedule</h3>
          <div className="flex items-center">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.reviewScheduleEnabled}
                onChange={(e) => handleChange('reviewScheduleEnabled', e.target.checked)}
                className="sr-only"
              />
              <div className={`relative w-11 h-6 rounded-full transition-colors ${
                settings.reviewScheduleEnabled ? 'bg-brand-primary' : 'bg-gray-300'
              }`}>
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.reviewScheduleEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}></div>
              </div>
              <span className="ml-3 text-sm font-medium text-gray-700">
                {settings.reviewScheduleEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Configure the automated review workflow times (Central Time Zone).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Issue Processing Time
            </label>
            <div className="flex space-x-2 items-center">
              <select
                value={(() => {
                  const hour24 = parseInt(settings.rssProcessingTime.split(':')[0])
                  return hour24 === 0 ? '12' : hour24 > 12 ? (hour24 - 12).toString() : hour24.toString()
                })()}
                onChange={(e) => {
                  const minutes = settings.rssProcessingTime.split(':')[1] || '00'
                  const hour12 = parseInt(e.target.value)
                  const currentHour24 = parseInt(settings.rssProcessingTime.split(':')[0])
                  const isAM = currentHour24 < 12
                  let hour24
                  if (hour12 === 12) {
                    hour24 = isAM ? 0 : 12
                  } else {
                    hour24 = isAM ? hour12 : hour12 + 12
                  }
                  handleChange('rssProcessingTime', `${hour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.reviewScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const hour = i + 1
                  return (
                    <option key={hour} value={hour.toString()}>
                      {hour}
                    </option>
                  )
                })}
              </select>
              <span>:</span>
              <select
                value={settings.rssProcessingTime.split(':')[1] || '00'}
                onChange={(e) => {
                  const hour24 = parseInt(settings.rssProcessingTime.split(':')[0])
                  handleChange('rssProcessingTime', `${hour24.toString().padStart(2, '0')}:${e.target.value}`)
                }}
                disabled={!settings.reviewScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="00">00</option>
                <option value="05">05</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="35">35</option>
                <option value="40">40</option>
                <option value="45">45</option>
                <option value="50">50</option>
                <option value="55">55</option>
              </select>
              <select
                value={parseInt(settings.rssProcessingTime.split(':')[0]) < 12 ? 'AM' : 'PM'}
                onChange={(e) => {
                  const minutes = settings.rssProcessingTime.split(':')[1] || '00'
                  const currentHour24 = parseInt(settings.rssProcessingTime.split(':')[0])
                  const currentHour12 = currentHour24 === 0 ? 12 : currentHour24 > 12 ? currentHour24 - 12 : currentHour24
                  let newHour24
                  if (e.target.value === 'AM') {
                    newHour24 = currentHour12 === 12 ? 0 : currentHour12
                  } else {
                    newHour24 = currentHour12 === 12 ? 12 : currentHour12 + 12
                  }
                  handleChange('rssProcessingTime', `${newHour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.reviewScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">Daily issue creation and processing</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Campaign Creation Time
            </label>
            <div className="flex space-x-2 items-center">
              <select
                value={(() => {
                  const hour24 = parseInt(settings.issueCreationTime.split(':')[0])
                  return hour24 === 0 ? '12' : hour24 > 12 ? (hour24 - 12).toString() : hour24.toString()
                })()}
                onChange={(e) => {
                  const minutes = settings.issueCreationTime.split(':')[1] || '00'
                  const hour12 = parseInt(e.target.value)
                  const currentHour24 = parseInt(settings.issueCreationTime.split(':')[0])
                  const isAM = currentHour24 < 12
                  let hour24
                  if (hour12 === 12) {
                    hour24 = isAM ? 0 : 12
                  } else {
                    hour24 = isAM ? hour12 : hour12 + 12
                  }
                  handleChange('issueCreationTime', `${hour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.reviewScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const hour = i + 1
                  return (
                    <option key={hour} value={hour.toString()}>
                      {hour}
                    </option>
                  )
                })}
              </select>
              <span>:</span>
              <select
                value={settings.issueCreationTime.split(':')[1] || '00'}
                onChange={(e) => {
                  const hour24 = parseInt(settings.issueCreationTime.split(':')[0])
                  handleChange('issueCreationTime', `${hour24.toString().padStart(2, '0')}:${e.target.value}`)
                }}
                disabled={!settings.reviewScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="00">00</option>
                <option value="05">05</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="35">35</option>
                <option value="40">40</option>
                <option value="45">45</option>
                <option value="50">50</option>
                <option value="55">55</option>
              </select>
              <select
                value={parseInt(settings.issueCreationTime.split(':')[0]) < 12 ? 'AM' : 'PM'}
                onChange={(e) => {
                  const minutes = settings.issueCreationTime.split(':')[1] || '00'
                  const currentHour24 = parseInt(settings.issueCreationTime.split(':')[0])
                  const currentHour12 = currentHour24 === 0 ? 12 : currentHour24 > 12 ? currentHour24 - 12 : currentHour24
                  let newHour24
                  if (e.target.value === 'AM') {
                    newHour24 = currentHour12 === 12 ? 0 : currentHour12
                  } else {
                    newHour24 = currentHour12 === 12 ? 12 : currentHour12 + 12
                  }
                  handleChange('issueCreationTime', `${newHour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.reviewScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">SendGrid campaign setup and review</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scheduled Send Time
            </label>
            <div className="flex space-x-2 items-center">
              <select
                value={(() => {
                  const hour24 = parseInt(settings.scheduledSendTime.split(':')[0])
                  return hour24 === 0 ? '12' : hour24 > 12 ? (hour24 - 12).toString() : hour24.toString()
                })()}
                onChange={(e) => {
                  const minutes = settings.scheduledSendTime.split(':')[1] || '00'
                  const hour12 = parseInt(e.target.value)
                  const currentHour24 = parseInt(settings.scheduledSendTime.split(':')[0])
                  const isAM = currentHour24 < 12
                  let hour24
                  if (hour12 === 12) {
                    hour24 = isAM ? 0 : 12
                  } else {
                    hour24 = isAM ? hour12 : hour12 + 12
                  }
                  handleChange('scheduledSendTime', `${hour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.reviewScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const hour = i + 1
                  return (
                    <option key={hour} value={hour.toString()}>
                      {hour}
                    </option>
                  )
                })}
              </select>
              <span>:</span>
              <select
                value={settings.scheduledSendTime.split(':')[1] || '00'}
                onChange={(e) => {
                  const hour24 = parseInt(settings.scheduledSendTime.split(':')[0])
                  handleChange('scheduledSendTime', `${hour24.toString().padStart(2, '0')}:${e.target.value}`)
                }}
                disabled={!settings.reviewScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="00">00</option>
                <option value="05">05</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="35">35</option>
                <option value="40">40</option>
                <option value="45">45</option>
                <option value="50">50</option>
                <option value="55">55</option>
              </select>
              <select
                value={parseInt(settings.scheduledSendTime.split(':')[0]) < 12 ? 'AM' : 'PM'}
                onChange={(e) => {
                  const minutes = settings.scheduledSendTime.split(':')[1] || '00'
                  const currentHour24 = parseInt(settings.scheduledSendTime.split(':')[0])
                  const currentHour12 = currentHour24 === 0 ? 12 : currentHour24 > 12 ? currentHour24 - 12 : currentHour24
                  let newHour24
                  if (e.target.value === 'AM') {
                    newHour24 = currentHour12 === 12 ? 0 : currentHour12
                  } else {
                    newHour24 = currentHour12 === 12 ? 12 : currentHour12 + 12
                  }
                  handleChange('scheduledSendTime', `${newHour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.reviewScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">Review newsletter delivery (5-minute increments)</p>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Review Workflow Overview</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <div>1. <strong>{settings.rssProcessingTime}</strong> - Create tomorrow's issue, process RSS feeds, and generate AI subject line</div>
            <div>2. <strong>{settings.issueCreationTime}</strong> - Create review campaign and schedule for delivery</div>
            <div>3. <strong>{settings.scheduledSendTime}</strong> - SendGrid sends review to review list only</div>
          </div>
        </div>
      </div>

      {/* Automated Daily Publication Schedule */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Automated Daily Publication Schedule</h3>
          <div className="flex items-center">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.dailyScheduleEnabled}
                onChange={(e) => handleChange('dailyScheduleEnabled', e.target.checked)}
                className="sr-only"
              />
              <div className={`relative w-11 h-6 rounded-full transition-colors ${
                settings.dailyScheduleEnabled ? 'bg-brand-primary' : 'bg-gray-300'
              }`}>
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.dailyScheduleEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}></div>
              </div>
              <span className="ml-3 text-sm font-medium text-gray-700">
                {settings.dailyScheduleEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Configure the automated daily newsletter delivery times (Central Time Zone).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Campaign Creation Time
            </label>
            <div className="flex space-x-2 items-center">
              <select
                value={(() => {
                  const hour24 = parseInt(settings.dailyissueCreationTime.split(':')[0])
                  return hour24 === 0 ? '12' : hour24 > 12 ? (hour24 - 12).toString() : hour24.toString()
                })()}
                onChange={(e) => {
                  const minutes = settings.dailyissueCreationTime.split(':')[1] || '00'
                  const hour12 = parseInt(e.target.value)
                  const currentHour24 = parseInt(settings.dailyissueCreationTime.split(':')[0])
                  const isAM = currentHour24 < 12
                  let hour24
                  if (hour12 === 12) {
                    hour24 = isAM ? 0 : 12
                  } else {
                    hour24 = isAM ? hour12 : hour12 + 12
                  }
                  handleChange('dailyissueCreationTime', `${hour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.dailyScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const hour = i + 1
                  return (
                    <option key={hour} value={hour.toString()}>
                      {hour}
                    </option>
                  )
                })}
              </select>
              <span>:</span>
              <select
                value={settings.dailyissueCreationTime.split(':')[1] || '00'}
                onChange={(e) => {
                  const hour24 = parseInt(settings.dailyissueCreationTime.split(':')[0])
                  handleChange('dailyissueCreationTime', `${hour24.toString().padStart(2, '0')}:${e.target.value}`)
                }}
                disabled={!settings.dailyScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="00">00</option>
                <option value="05">05</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="35">35</option>
                <option value="40">40</option>
                <option value="45">45</option>
                <option value="50">50</option>
                <option value="55">55</option>
              </select>
              <select
                value={parseInt(settings.dailyissueCreationTime.split(':')[0]) < 12 ? 'AM' : 'PM'}
                onChange={(e) => {
                  const minutes = settings.dailyissueCreationTime.split(':')[1] || '00'
                  const currentHour24 = parseInt(settings.dailyissueCreationTime.split(':')[0])
                  const currentHour12 = currentHour24 === 0 ? 12 : currentHour24 > 12 ? currentHour24 - 12 : currentHour24
                  let newHour24
                  if (e.target.value === 'AM') {
                    newHour24 = currentHour12 === 12 ? 0 : currentHour12
                  } else {
                    newHour24 = currentHour12 === 12 ? 12 : currentHour12 + 12
                  }
                  handleChange('dailyissueCreationTime', `${newHour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.dailyScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">Final campaign creation with any review changes</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scheduled Send Time
            </label>
            <div className="flex space-x-2 items-center">
              <select
                value={(() => {
                  const hour24 = parseInt(settings.dailyScheduledSendTime.split(':')[0])
                  return hour24 === 0 ? '12' : hour24 > 12 ? (hour24 - 12).toString() : hour24.toString()
                })()}
                onChange={(e) => {
                  const minutes = settings.dailyScheduledSendTime.split(':')[1] || '00'
                  const hour12 = parseInt(e.target.value)
                  const currentHour24 = parseInt(settings.dailyScheduledSendTime.split(':')[0])
                  const isAM = currentHour24 < 12
                  let hour24
                  if (hour12 === 12) {
                    hour24 = isAM ? 0 : 12
                  } else {
                    hour24 = isAM ? hour12 : hour12 + 12
                  }
                  handleChange('dailyScheduledSendTime', `${hour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.dailyScheduleEnabled}
                className="w-16 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const hour = i + 1
                  return (
                    <option key={hour} value={hour.toString()}>
                      {hour}
                    </option>
                  )
                })}
              </select>
              <span>:</span>
              <select
                value={settings.dailyScheduledSendTime.split(':')[1] || '00'}
                onChange={(e) => {
                  const hour24 = parseInt(settings.dailyScheduledSendTime.split(':')[0])
                  handleChange('dailyScheduledSendTime', `${hour24.toString().padStart(2, '0')}:${e.target.value}`)
                }}
                disabled={!settings.dailyScheduleEnabled}
                className="w-16 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="00">00</option>
                <option value="05">05</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="35">35</option>
                <option value="40">40</option>
                <option value="45">45</option>
                <option value="50">50</option>
                <option value="55">55</option>
              </select>
              <select
                value={parseInt(settings.dailyScheduledSendTime.split(':')[0]) < 12 ? 'AM' : 'PM'}
                onChange={(e) => {
                  const minutes = settings.dailyScheduledSendTime.split(':')[1] || '00'
                  const currentHour24 = parseInt(settings.dailyScheduledSendTime.split(':')[0])
                  const currentHour12 = currentHour24 === 0 ? 12 : currentHour24 > 12 ? currentHour24 - 12 : currentHour24
                  let newHour24
                  if (e.target.value === 'AM') {
                    newHour24 = currentHour12 === 12 ? 0 : currentHour12
                  } else {
                    newHour24 = currentHour12 === 12 ? 12 : currentHour12 + 12
                  }
                  handleChange('dailyScheduledSendTime', `${newHour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.dailyScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">Final publication delivery to main subscriber group (5-minute increments)</p>
          </div>
        </div>

        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-medium text-green-900 mb-2">Daily Publication Workflow</h4>
          <div className="text-sm text-green-800 space-y-1">
            <div>1. <strong>{settings.dailyissueCreationTime}</strong> - Create final campaign with any changes made to issue during review</div>
            <div>2. <strong>{settings.dailyScheduledSendTime}</strong> - Send final issue to main subscriber group</div>
          </div>
        </div>
      </div>

      {/* Automated Secondary Publication Schedule */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Automated Secondary Publication Schedule</h3>
          <div className="flex items-center">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.secondaryScheduleEnabled}
                onChange={(e) => handleChange('secondaryScheduleEnabled', e.target.checked)}
                className="sr-only"
              />
              <div className={`relative w-11 h-6 rounded-full transition-colors ${
                settings.secondaryScheduleEnabled ? 'bg-brand-primary' : 'bg-gray-300'
              }`}>
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.secondaryScheduleEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}></div>
              </div>
              <span className="ml-3 text-sm font-medium text-gray-700">
                {settings.secondaryScheduleEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Configure secondary newsletter delivery to a different subscriber group on selected days (Central Time Zone).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Campaign Creation Time
            </label>
            <div className="flex space-x-2 items-center">
              <select
                value={(() => {
                  const hour24 = parseInt(settings.secondaryissueCreationTime.split(':')[0])
                  return hour24 === 0 ? '12' : hour24 > 12 ? (hour24 - 12).toString() : hour24.toString()
                })()}
                onChange={(e) => {
                  const minutes = settings.secondaryissueCreationTime.split(':')[1] || '00'
                  const hour12 = parseInt(e.target.value)
                  const currentHour24 = parseInt(settings.secondaryissueCreationTime.split(':')[0])
                  const isAM = currentHour24 < 12
                  let hour24
                  if (hour12 === 12) {
                    hour24 = isAM ? 0 : 12
                  } else {
                    hour24 = isAM ? hour12 : hour12 + 12
                  }
                  handleChange('secondaryissueCreationTime', `${hour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.secondaryScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const hour = i + 1
                  return (
                    <option key={hour} value={hour.toString()}>
                      {hour}
                    </option>
                  )
                })}
              </select>
              <span>:</span>
              <select
                value={settings.secondaryissueCreationTime.split(':')[1] || '00'}
                onChange={(e) => {
                  const hour24 = parseInt(settings.secondaryissueCreationTime.split(':')[0])
                  handleChange('secondaryissueCreationTime', `${hour24.toString().padStart(2, '0')}:${e.target.value}`)
                }}
                disabled={!settings.secondaryScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="00">00</option>
                <option value="05">05</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="35">35</option>
                <option value="40">40</option>
                <option value="45">45</option>
                <option value="50">50</option>
                <option value="55">55</option>
              </select>
              <select
                value={parseInt(settings.secondaryissueCreationTime.split(':')[0]) < 12 ? 'AM' : 'PM'}
                onChange={(e) => {
                  const minutes = settings.secondaryissueCreationTime.split(':')[1] || '00'
                  const currentHour24 = parseInt(settings.secondaryissueCreationTime.split(':')[0])
                  const currentHour12 = currentHour24 === 0 ? 12 : currentHour24 > 12 ? currentHour24 - 12 : currentHour24
                  let newHour24
                  if (e.target.value === 'AM') {
                    newHour24 = currentHour12 === 12 ? 0 : currentHour12
                  } else {
                    newHour24 = currentHour12 === 12 ? 12 : currentHour12 + 12
                  }
                  handleChange('secondaryissueCreationTime', `${newHour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.secondaryScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">Secondary campaign creation with existing issue content</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scheduled Send Time
            </label>
            <div className="flex space-x-2 items-center">
              <select
                value={(() => {
                  const hour24 = parseInt(settings.secondaryScheduledSendTime.split(':')[0])
                  return hour24 === 0 ? '12' : hour24 > 12 ? (hour24 - 12).toString() : hour24.toString()
                })()}
                onChange={(e) => {
                  const minutes = settings.secondaryScheduledSendTime.split(':')[1] || '00'
                  const hour12 = parseInt(e.target.value)
                  const currentHour24 = parseInt(settings.secondaryScheduledSendTime.split(':')[0])
                  const isAM = currentHour24 < 12
                  let hour24
                  if (hour12 === 12) {
                    hour24 = isAM ? 0 : 12
                  } else {
                    hour24 = isAM ? hour12 : hour12 + 12
                  }
                  handleChange('secondaryScheduledSendTime', `${hour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.secondaryScheduleEnabled}
                className="w-16 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const hour = i + 1
                  return (
                    <option key={hour} value={hour.toString()}>
                      {hour}
                    </option>
                  )
                })}
              </select>
              <span>:</span>
              <select
                value={settings.secondaryScheduledSendTime.split(':')[1] || '00'}
                onChange={(e) => {
                  const hour24 = parseInt(settings.secondaryScheduledSendTime.split(':')[0])
                  handleChange('secondaryScheduledSendTime', `${hour24.toString().padStart(2, '0')}:${e.target.value}`)
                }}
                disabled={!settings.secondaryScheduleEnabled}
                className="w-16 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="00">00</option>
                <option value="05">05</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="35">35</option>
                <option value="40">40</option>
                <option value="45">45</option>
                <option value="50">50</option>
                <option value="55">55</option>
              </select>
              <select
                value={parseInt(settings.secondaryScheduledSendTime.split(':')[0]) < 12 ? 'AM' : 'PM'}
                onChange={(e) => {
                  const minutes = settings.secondaryScheduledSendTime.split(':')[1] || '00'
                  const currentHour24 = parseInt(settings.secondaryScheduledSendTime.split(':')[0])
                  const currentHour12 = currentHour24 === 0 ? 12 : currentHour24 > 12 ? currentHour24 - 12 : currentHour24
                  let newHour24
                  if (e.target.value === 'AM') {
                    newHour24 = currentHour12 === 12 ? 0 : currentHour12
                  } else {
                    newHour24 = currentHour12 === 12 ? 12 : currentHour12 + 12
                  }
                  handleChange('secondaryScheduledSendTime', `${newHour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.secondaryScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">Delivery to secondary subscriber group (5-minute increments)</p>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Send Days
          </label>
          <div className="grid grid-cols-7 gap-2">
            {[
              { day: 0, label: 'Sun' },
              { day: 1, label: 'Mon' },
              { day: 2, label: 'Tue' },
              { day: 3, label: 'Wed' },
              { day: 4, label: 'Thu' },
              { day: 5, label: 'Fri' },
              { day: 6, label: 'Sat' }
            ].map(({ day, label }) => (
              <label
                key={day}
                className={`flex items-center justify-center p-3 border rounded-md cursor-pointer transition-colors ${
                  settings.secondarySendDays.includes(day)
                    ? 'bg-brand-primary border-brand-primary text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-brand-primary'
                } ${!settings.secondaryScheduleEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={settings.secondarySendDays.includes(day)}
                  onChange={(e) => {
                    const days = settings.secondarySendDays
                    if (e.target.checked) {
                      handleChange('secondarySendDays', [...days, day].sort())
                    } else {
                      handleChange('secondarySendDays', days.filter(d => d !== day))
                    }
                  }}
                  disabled={!settings.secondaryScheduleEnabled}
                  className="sr-only"
                />
                <span className="text-sm font-medium">{label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">Select the days when the secondary newsletter should be sent</p>
        </div>

        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h4 className="font-medium text-purple-900 mb-2">Secondary Publication Workflow</h4>
          <div className="text-sm text-purple-800 space-y-1">
            <div>1. <strong>{settings.secondaryissueCreationTime}</strong> - Create campaign using existing issue content</div>
            <div>2. <strong>{settings.secondaryScheduledSendTime}</strong> - Send to secondary subscriber group (on selected days only)</div>
          </div>
        </div>
      </div>

      {/* Save Email & Schedule Settings Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-brand-primary hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-md font-medium"
        >
          {saving ? 'Saving...' : 'Save Email & Schedule Settings'}
        </button>
      </div>

      {message && (
        <div className={`mt-4 p-4 rounded-md ${
          message.includes('successfully')
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* Article Limit Settings */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Article Limit Settings</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure the maximum number of articles that can be selected for the Primary Articles and Secondary Articles sections in each newsletter issue.
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="font-medium text-gray-700 w-56">Max Articles in Primary Section:</label>
            <input
              type="number"
              min="1"
              max="10"
              value={maxTopArticles}
              onChange={(e) => setMaxTopArticles(parseInt(e.target.value) || 1)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-md"
              disabled={savingMaxArticles}
            />
            <span className="text-sm text-gray-500">(1-10)</span>
          </div>

          <div className="flex items-center gap-4">
            <label className="font-medium text-gray-700 w-56">Max Articles in Secondary Section:</label>
            <input
              type="number"
              min="1"
              max="10"
              value={maxBottomArticles}
              onChange={(e) => setMaxBottomArticles(parseInt(e.target.value) || 1)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-md"
              disabled={savingMaxArticles}
            />
            <span className="text-sm text-gray-500">(1-10)</span>
          </div>

          <button
            onClick={saveMaxArticles}
            disabled={savingMaxArticles}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300"
          >
            {savingMaxArticles ? 'Saving...' : 'Save Article Limits'}
          </button>
        </div>

        <div className="mt-4 bg-blue-50 p-4 rounded-lg">

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h4 className="font-medium text-gray-900 mb-4">Article Lookback Time Window</h4>
            <p className="text-sm text-gray-600 mb-4">
              The system will ALWAYS search the past X hours for the highest-rated unused articles. This ensures you get the best content available, not just today's articles. Articles already used in sent newsletters are automatically excluded.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="font-medium text-gray-700 w-56">Primary RSS Lookback Hours:</label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={primaryLookbackHours}
                  onChange={(e) => setPrimaryLookbackHours(parseInt(e.target.value) || 1)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md"
                  disabled={savingLookbackHours}
                />
                <span className="text-sm text-gray-500">(1-168 hours / 1 week)</span>
              </div>

              <div className="flex items-center gap-4">
                <label className="font-medium text-gray-700 w-56">Secondary RSS Lookback Hours:</label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={secondaryLookbackHours}
                  onChange={(e) => setSecondaryLookbackHours(parseInt(e.target.value) || 1)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md"
                  disabled={savingLookbackHours}
                />
                <span className="text-sm text-gray-500">(1-168 hours / 1 week)</span>
              </div>

              <button
                onClick={saveLookbackHours}
                disabled={savingLookbackHours}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300"
              >
                {savingLookbackHours ? 'Saving...' : 'Save Lookback Hours'}
              </button>
            </div>

            <div className="mt-4 bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Current configuration:</strong> Primary: {primaryLookbackHours} hours ({(primaryLookbackHours/24).toFixed(1)} days), Secondary: {secondaryLookbackHours} hours ({(secondaryLookbackHours/24).toFixed(1)} days)
              </p>
              <p className="text-xs text-blue-700 mt-2">
                The system selects the top-rated articles from all available content in the lookback window, ensuring quality over recency. Already-sent articles are excluded.
              </p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h4 className="font-medium text-gray-900 mb-4">Deduplication Settings</h4>
            <p className="text-sm text-gray-600 mb-4">
              Configure how the system detects and prevents duplicate articles from appearing in your newsletters. The system uses a 4-stage detection process: historical checking, exact content matching, title similarity, and AI semantic analysis.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="font-medium text-gray-700 w-56">Historical Lookback Days:</label>
                <input
                  type="number"
                  min="1"
                  max="14"
                  value={dedupLookbackDays}
                  onChange={(e) => setDedupLookbackDays(parseInt(e.target.value) || 1)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md"
                  disabled={savingDedupSettings}
                />
                <span className="text-sm text-gray-500">(1-14 days)</span>
              </div>

              <div className="flex items-center gap-4">
                <label className="font-medium text-gray-700 w-56">Strictness Threshold:</label>
                <input
                  type="number"
                  min="0.5"
                  max="1.0"
                  step="0.05"
                  value={dedupStrictnessThreshold}
                  onChange={(e) => setDedupStrictnessThreshold(parseFloat(e.target.value) || 0.8)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md"
                  disabled={savingDedupSettings}
                />
                <span className="text-sm text-gray-500">(0.5-1.0, lower = stricter)</span>
              </div>

              <button
                onClick={saveDedupSettings}
                disabled={savingDedupSettings}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300"
              >
                {savingDedupSettings ? 'Saving...' : 'Save Deduplication Settings'}
              </button>
            </div>

            <div className="mt-4 bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Current configuration:</strong> Checking {dedupLookbackDays} days of past newsletters with {Math.round(dedupStrictnessThreshold * 100)}% similarity threshold
              </p>
              <p className="text-xs text-blue-700 mt-2">
                <strong>How it works:</strong> Stage 1 checks against articles used in the last {dedupLookbackDays} sent newsletters. Stages 2-4 check exact content matches (100% similarity), title similarity (&gt;{Math.round(dedupStrictnessThreshold * 100)}%), and AI semantic analysis (&gt;{Math.round(dedupStrictnessThreshold * 100)}%) within the current issue's articles.
              </p>
            </div>
          </div>
          </div>
      </div>
    </div>
  )
}

function AIPromptsSettings() {
  const [prompts, setPrompts] = useState<any[]>([])
  const [grouped, setGrouped] = useState<Record<string, any[]>>({})
  const [primaryCriteria, setPrimaryCriteria] = useState<any[]>([])
  const [secondaryCriteria, setSecondaryCriteria] = useState<any[]>([])
  const [primaryEnabledCount, setPrimaryEnabledCount] = useState(3)
  const [secondaryEnabledCount, setSecondaryEnabledCount] = useState(3)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null)
  const [editingPrompt, setEditingPrompt] = useState<{key: string, value: string} | null>(null)
  const [editingWeight, setEditingWeight] = useState<{key: string, value: string} | null>(null)
  const [editingPrimaryName, setEditingPrimaryName] = useState<{number: number, value: string} | null>(null)
  const [editingSecondaryName, setEditingSecondaryName] = useState<{number: number, value: string} | null>(null)
  const [rssPosts, setRssPosts] = useState<any[]>([])
  const [selectedRssPost, setSelectedRssPost] = useState<string>('')
  const [loadingRssPosts, setLoadingRssPosts] = useState(false)
  const [primaryRssPosts, setPrimaryRssPosts] = useState<any[]>([])
  const [selectedPrimaryRssPost, setSelectedPrimaryRssPost] = useState<string>('')
  const [loadingPrimaryRssPosts, setLoadingPrimaryRssPosts] = useState(false)
  const [secondaryRssPosts, setSecondaryRssPosts] = useState<any[]>([])
  const [selectedSecondaryRssPost, setSelectedSecondaryRssPost] = useState<string>('')
  const [loadingSecondaryRssPosts, setLoadingSecondaryRssPosts] = useState(false)
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [testResults, setTestResults] = useState<any>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [prettyPrint, setPrettyPrint] = useState(true)

  // Get newsletter slug from pathname
  const pathname = usePathname()
  const newsletterSlug = pathname ? pathname.match(/^\/dashboard\/([^\/]+)/)?.[1] : null

  useEffect(() => {
    loadPrompts()
    loadCriteria()
    loadRssPosts()
    loadPrimaryRssPosts()
    loadSecondaryRssPosts()
  }, [])

  const loadPrompts = async () => {
    try {
      const response = await fetch('/api/settings/ai-prompts')
      if (response.ok) {
        const data = await response.json()
        setPrompts(data.prompts || [])
        setGrouped(data.grouped || {})
      }
    } catch (error) {
      console.error('Failed to load AI prompts:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCriteria = async () => {
    if (!newsletterSlug) return

    try {
      const response = await fetch(`/api/settings/criteria?publication_id=${newsletterSlug}`)
      if (response.ok) {
        const data = await response.json()
        setPrimaryCriteria(data.primaryCriteria || [])
        setSecondaryCriteria(data.secondaryCriteria || [])
        setPrimaryEnabledCount(data.primaryEnabledCount || 3)
        setSecondaryEnabledCount(data.secondaryEnabledCount || 3)
      }
    } catch (error) {
      console.error('Failed to load criteria:', error)
    }
  }

  const loadRssPosts = async () => {
    setLoadingRssPosts(true)
    try {
      const response = await fetch('/api/rss-posts/recent?limit=50')
      if (response.ok) {
        const data = await response.json()
        setRssPosts(data.posts || [])
        // Select first post by default if available
        if (data.posts && data.posts.length > 0) {
          setSelectedRssPost(data.posts[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to load RSS posts:', error)
    } finally {
      setLoadingRssPosts(false)
    }
  }

  const loadPrimaryRssPosts = async () => {
    setLoadingPrimaryRssPosts(true)
    try {
      const response = await fetch('/api/rss-posts/recent?limit=50&section=primary')
      if (response.ok) {
        const data = await response.json()
        setPrimaryRssPosts(data.posts || [])
        // Select first post by default if available
        if (data.posts && data.posts.length > 0) {
          setSelectedPrimaryRssPost(data.posts[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to load primary RSS posts:', error)
    } finally {
      setLoadingPrimaryRssPosts(false)
    }
  }

  const loadSecondaryRssPosts = async () => {
    setLoadingSecondaryRssPosts(true)
    try {
      const response = await fetch('/api/rss-posts/recent?limit=50&section=secondary')
      if (response.ok) {
        const data = await response.json()
        setSecondaryRssPosts(data.posts || [])
        // Select first post by default if available
        if (data.posts && data.posts.length > 0) {
          setSelectedSecondaryRssPost(data.posts[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to load secondary RSS posts:', error)
    } finally {
      setLoadingSecondaryRssPosts(false)
    }
  }

  // Helper function to detect AI provider from prompt value (auto-detect from model name)
  const detectProviderFromPrompt = (value: any): 'openai' | 'claude' => {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value
      const model = (parsed?.model || '').toLowerCase()
      if (model.includes('claude') || model.includes('sonnet') || model.includes('opus') || model.includes('haiku')) {
        return 'claude'
      }
    } catch (e) {
      // Not valid JSON, default to openai
    }
    return 'openai'
  }

  // Helper function to format JSON with actual newlines
  const formatJSON = (value: any, prettyPrint: boolean): string => {
    // If value is a string, try to parse it as JSON first
    if (typeof value === 'string') {
      try {
        // Try to parse as JSON
        const parsed = JSON.parse(value)
        // If successful, format the parsed object
        const jsonStr = prettyPrint ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed)
        if (prettyPrint) {
          return jsonStr.replace(/\\n/g, '\n')
        }
        return jsonStr
      } catch (e) {
        // Not valid JSON, treat as plain string
        if (prettyPrint) {
          return value.replace(/\\n/g, '\n')
        }
        return value
      }
    }

    // Handle object values (already parsed JSON)
    if (typeof value === 'object' && value !== null) {
      const jsonStr = prettyPrint ? JSON.stringify(value, null, 2) : JSON.stringify(value)
      if (prettyPrint) {
        return jsonStr.replace(/\\n/g, '\n')
      }
      return jsonStr
    }

    return String(value)
  }

  const handleEdit = (prompt: any) => {
    let valueStr: string
    if (typeof prompt.value === 'object') {
      valueStr = JSON.stringify(prompt.value, null, 2)
    } else if (typeof prompt.value === 'string') {
      // Try to parse as JSON to pretty-print it
      try {
        const parsed = JSON.parse(prompt.value)
        valueStr = JSON.stringify(parsed, null, 2)
      } catch (e) {
        // Not JSON, use as-is
        valueStr = prompt.value
      }
    } else {
      valueStr = String(prompt.value)
    }
    setEditingPrompt({ key: prompt.key, value: valueStr })
    setExpandedPrompt(prompt.key)
  }

  const handleCancel = () => {
    setEditingPrompt(null)
  }

  const handleSave = async (key: string) => {
    if (!editingPrompt || editingPrompt.key !== key) return

    setSaving(key)
    setMessage('')

    try {
      const response = await fetch('/api/settings/ai-prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: editingPrompt.key,
          value: editingPrompt.value
        })
      })

      if (response.ok) {
        setMessage('Prompt saved successfully!')
        setEditingPrompt(null)
        await loadPrompts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to save prompt')
      }
    } catch (error) {
      setMessage('Error: Failed to save prompt')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  const handleReset = async (key: string) => {
    if (!confirm('Are you sure you want to reset this prompt to its default value? This cannot be undone.')) {
      return
    }

    setSaving(key)
    setMessage('')

    try {
      const response = await fetch('/api/settings/ai-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      })

      if (response.ok) {
        const data = await response.json()
        const message = data.used_custom_default
          ? 'Prompt reset to your custom default!'
          : 'Prompt reset to original code default!'
        setMessage(message)
        await loadPrompts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to reset prompt')
      }
    } catch (error) {
      setMessage('Error: Failed to reset prompt')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  const handleSaveAsDefault = async (key: string) => {
    if (!confirm('Are you sure you want to save the current prompt as your custom default?\n\nThis will replace any previous custom default. When you click "Reset to Default", it will restore to this version instead of the original code default.')) {
      return
    }

    if (!confirm('Double confirmation: Save current prompt as default? This action will be permanent.')) {
      return
    }

    setSaving(key)
    setMessage('')

    try {
      const response = await fetch('/api/settings/ai-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, action: 'save_as_default' })
      })

      if (response.ok) {
        setMessage('✓ Current prompt saved as your custom default!')
        await loadPrompts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to save as default')
      }
    } catch (error) {
      setMessage('Error: Failed to save as default')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  const handleTestPrompt = async (key: string) => {
    // Get the prompt's expected outputs
    const prompt = prompts.find(p => p.key === key)
    const expectedOutputs = prompt?.expected_outputs || null

    // Map prompt keys to their test endpoint type parameter
    const promptTypeMap: Record<string, string> = {
      'ai_prompt_content_evaluator': 'contentEvaluator',
      'ai_prompt_newsletter_writer': 'newsletterWriter',
      'ai_prompt_subject_line': 'subjectLineGenerator',
      'ai_prompt_event_summary': 'eventSummarizer',
      'ai_prompt_road_work': 'roadWorkGenerator',
      'ai_prompt_image_analyzer': 'imageAnalyzer',
      'ai_prompt_primary_article_title': 'primaryArticleTitle',
      'ai_prompt_primary_article_body': 'primaryArticleBody',
      'ai_prompt_secondary_article_title': 'secondaryArticleTitle',
      'ai_prompt_secondary_article_body': 'secondaryArticleBody',
      'ai_prompt_fact_checker': 'factChecker',
      'ai_prompt_welcome_section': 'welcomeSection',
      'ai_prompt_topic_deduper': 'topicDeduper'
    }

    let testType = promptTypeMap[key]

    // Handle criteria prompts (ai_prompt_criteria_1, ai_prompt_criteria_2, etc.)
    if (!testType && (key.startsWith('ai_prompt_criteria_') || key.startsWith('ai_prompt_secondary_criteria_'))) {
      testType = 'contentEvaluator'
    }

    if (!testType) {
      alert('Test not available for this prompt type')
      return
    }

    // Determine which RSS post to use based on prompt type
    let rssPostId = selectedPrimaryRssPost // Default to primary for general prompts

    if (key.startsWith('ai_prompt_secondary_')) {
      // Use secondary RSS post for secondary prompts and secondary criteria
      rssPostId = selectedSecondaryRssPost
    }
    // Primary, criteria, subject line, newsletter writer, content evaluator, etc. all use primary RSS post

    // Open modal and fetch results
    setTestModalOpen(true)
    setTestLoading(true)
    setTestError(null)
    setTestResults(null)

    try {
      let testUrl = `/api/debug/test-ai-prompts?type=${testType}&promptKey=${key}`
      if (rssPostId) {
        testUrl += `&rssPostId=${rssPostId}`
      }
      if (newsletterSlug) {
        testUrl += `&publicationId=${newsletterSlug}`
      }

      // If currently editing this prompt, use the current content from the text box
      if (editingPrompt?.key === key && editingPrompt?.value) {
        testUrl += `&promptContent=${encodeURIComponent(editingPrompt.value)}`
        // Auto-detect provider from the model in the prompt JSON
        const detectedProvider = detectProviderFromPrompt(editingPrompt.value)
        testUrl += `&provider=${detectedProvider}`
      }

      const response = await fetch(testUrl)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Test failed')
      }

      // Parse response against expected outputs
      if (expectedOutputs && data.results) {
        data.parsedOutputs = parseResponseOutputs(data.results, expectedOutputs)
      }

      setTestResults(data)
    } catch (error: any) {
      setTestError(error.message || 'Failed to run test')
    } finally {
      setTestLoading(false)
    }
  }

  // Helper function to parse AI response against expected outputs
  const parseResponseOutputs = (results: any, expectedOutputs: any): any => {
    const parsed: any = {}

    for (const [fieldName, fieldType] of Object.entries(expectedOutputs)) {
      try {
        // Get the response (could be in various formats)
        let responseText = ''
        if (results && typeof results === 'object') {
          const firstResult = Object.values(results)[0] as any
          if (firstResult?.response) {
            // Check if response has a 'raw' property (common for OpenAI responses)
            if (typeof firstResult.response === 'object' && firstResult.response.raw) {
              responseText = firstResult.response.raw
            } else if (typeof firstResult.response === 'string') {
              responseText = firstResult.response
            } else {
              responseText = JSON.stringify(firstResult.response)
            }
          }
        }

        // Try JSON parsing first
        try {
          const jsonResponse = JSON.parse(responseText)
          if (fieldName in jsonResponse) {
            parsed[fieldName] = { value: jsonResponse[fieldName], error: false }
            continue
          }
        } catch (e) {
          // Not JSON, continue to regex parsing
        }

        // Fallback to regex parsing
        const patterns = [
          new RegExp(`"${fieldName}"\\s*:\\s*([^,}]+)`, 'i'),
          new RegExp(`${fieldName}\\s*:\\s*(.+?)(?:\\n|$)`, 'i'),
          new RegExp(`${fieldName}\\s*=\\s*(.+?)(?:\\n|$)`, 'i')
        ]

        let found = false
        for (const pattern of patterns) {
          const match = responseText.match(pattern)
          if (match && match[1]) {
            parsed[fieldName] = { value: match[1].trim().replace(/^["']|["']$/g, ''), error: false }
            found = true
            break
          }
        }

        if (!found) {
          parsed[fieldName] = { value: null, error: true }
        }
      } catch (e) {
        parsed[fieldName] = { value: null, error: true }
      }
    }

    return parsed
  }

  const handleWeightEdit = (prompt: any) => {
    setEditingWeight({ key: prompt.key, value: prompt.weight || '1.0' })
  }

  const handleWeightCancel = () => {
    setEditingWeight(null)
  }

  const handleWeightSave = async (key: string) => {
    if (!editingWeight || editingWeight.key !== key || !newsletterSlug) return

    // Match both primary and secondary criteria and extract type
    const secondaryMatch = key.match(/ai_prompt_secondary_criteria_(\d+)/)
    const primaryMatch = key.match(/ai_prompt_criteria_(\d+)/)

    const isSecondary = !!secondaryMatch
    const criteriaNumber = isSecondary ? secondaryMatch[1] : primaryMatch?.[1]

    if (!criteriaNumber) return

    setSaving(key)
    setMessage('')

    try {
      const response = await fetch('/api/settings/criteria-weights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criteriaNumber,
          weight: parseFloat(editingWeight.value),
          type: isSecondary ? 'secondary' : 'primary',
          newsletterSlug
      })
      })

      if (response.ok) {
        setMessage('Weight updated successfully!')
        setEditingWeight(null)
        await loadPrompts()
        await loadCriteria()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to update weight')
      }
    } catch (error) {
      setMessage('Error: Failed to update weight')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  // Primary criteria name handlers
  const handlePrimaryNameEdit = (criteriaNumber: number, currentName: string) => {
    setEditingPrimaryName({ number: criteriaNumber, value: currentName })
  }

  const handlePrimaryNameCancel = () => {
    setEditingPrimaryName(null)
  }

  const handlePrimaryNameSave = async (criteriaNumber: number) => {
    if (!editingPrimaryName || editingPrimaryName.number !== criteriaNumber || !newsletterSlug) return

    setSaving(`criteria_${criteriaNumber}_name`)
    setMessage('')

    try {
      const response = await fetch('/api/settings/criteria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_name',
          criteriaNumber,
          name: editingPrimaryName.value,
          isSecondary: false,
          newsletterSlug
        })
      })

      if (response.ok) {
        setMessage('Criteria name updated successfully!')
        setEditingPrimaryName(null)
        await loadCriteria()
        await loadPrompts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to update name')
      }
    } catch (error) {
      setMessage('Error: Failed to update criteria name')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  // Secondary criteria name handlers
  const handleSecondaryNameEdit = (criteriaNumber: number, currentName: string) => {
    setEditingSecondaryName({ number: criteriaNumber, value: currentName })
  }

  const handleSecondaryNameCancel = () => {
    setEditingSecondaryName(null)
  }

  const handleSecondaryNameSave = async (criteriaNumber: number) => {
    if (!editingSecondaryName || editingSecondaryName.number !== criteriaNumber || !newsletterSlug) return

    setSaving(`criteria_${criteriaNumber}_name`)
    setMessage('')

    try {
      const response = await fetch('/api/settings/criteria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_name',
          criteriaNumber,
          name: editingSecondaryName.value,
          isSecondary: true,
          newsletterSlug
        })
      })

      if (response.ok) {
        setMessage('Criteria name updated successfully!')
        setEditingSecondaryName(null)
        await loadCriteria()
        await loadPrompts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to update name')
      }
    } catch (error) {
      setMessage('Error: Failed to update criteria name')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  const handleAddPrimaryCriteria = async () => {
    if (!newsletterSlug) return

    if (primaryEnabledCount >= 5) {
      setMessage('Maximum of 5 primary criteria reached')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setSaving('add_primary_criteria')
    setMessage('')

    try {
      const response = await fetch('/api/settings/criteria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_enabled_count',
          enabledCount: primaryEnabledCount + 1,
          isSecondary: false,
          newsletterSlug
        })
      })

      if (response.ok) {
        setMessage(`Enabled ${primaryEnabledCount + 1} primary criteria`)
        await loadCriteria()
        await loadPrompts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to add primary criteria')
      }
    } catch (error) {
      setMessage('Error: Failed to add primary criteria')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  const handleRemovePrimaryCriteria = async () => {
    if (!newsletterSlug) return

    if (primaryEnabledCount <= 1) {
      setMessage('At least 1 primary criteria must remain enabled')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    if (!confirm(`Remove primary criteria ${primaryEnabledCount}? This will disable it from scoring.`)) {
      return
    }

    setSaving('remove_primary_criteria')
    setMessage('')

    try {
      const response = await fetch('/api/settings/criteria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_enabled_count',
          enabledCount: primaryEnabledCount - 1,
          isSecondary: false,
          newsletterSlug
        })
      })

      if (response.ok) {
        setMessage(`Reduced to ${primaryEnabledCount - 1} primary criteria`)
        await loadCriteria()
        await loadPrompts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to remove primary criteria')
      }
    } catch (error) {
      setMessage('Error: Failed to remove primary criteria')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  const handleAddSecondaryCriteria = async () => {
    if (!newsletterSlug) return

    if (secondaryEnabledCount >= 5) {
      setMessage('Maximum of 5 secondary criteria reached')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setSaving('add_secondary_criteria')
    setMessage('')

    try {
      const response = await fetch('/api/settings/criteria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_enabled_count',
          enabledCount: secondaryEnabledCount + 1,
          isSecondary: true,
          newsletterSlug
        })
      })

      if (response.ok) {
        setMessage(`Enabled ${secondaryEnabledCount + 1} secondary criteria`)
        await loadCriteria()
        await loadPrompts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to add secondary criteria')
      }
    } catch (error) {
      setMessage('Error: Failed to add secondary criteria')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  const handleRemoveSecondaryCriteria = async () => {
    if (!newsletterSlug) return

    if (secondaryEnabledCount <= 1) {
      setMessage('At least 1 secondary criteria must remain enabled')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    if (!confirm(`Remove secondary criteria ${secondaryEnabledCount}? This will disable it from scoring.`)) {
      return
    }

    setSaving('remove_secondary_criteria')
    setMessage('')

    try {
      const response = await fetch('/api/settings/criteria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_enabled_count',
          enabledCount: secondaryEnabledCount - 1,
          isSecondary: true,
          newsletterSlug
        })
      })

      if (response.ok) {
        setMessage(`Reduced to ${secondaryEnabledCount - 1} secondary criteria`)
        await loadCriteria()
        await loadPrompts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to remove secondary criteria')
      }
    } catch (error) {
      setMessage('Error: Failed to remove secondary criteria')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  // Filter criteria prompts from other prompts
  const criteriaPrompts = prompts.filter(p => p.key.startsWith('ai_prompt_criteria_') && !p.key.startsWith('ai_prompt_secondary_'))
  const secondaryCriteriaPrompts = prompts.filter(p => p.key.startsWith('ai_prompt_secondary_criteria_'))

  // Filter primary article title/body prompts
  const primaryTitlePrompt = prompts.find(p => p.key === 'ai_prompt_primary_article_title')
  const primaryBodyPrompt = prompts.find(p => p.key === 'ai_prompt_primary_article_body')

  // Filter secondary article title/body prompts
  const secondaryTitlePrompt = prompts.find(p => p.key === 'ai_prompt_secondary_article_title')
  const secondaryBodyPrompt = prompts.find(p => p.key === 'ai_prompt_secondary_article_body')

  const otherPrompts = prompts.filter(p =>
    !p.key.startsWith('ai_prompt_criteria_') &&
    !p.key.startsWith('ai_prompt_secondary_criteria_') &&
    !p.key.startsWith('ai_prompt_secondary_') &&
    p.key !== 'ai_prompt_primary_article_title' &&
    p.key !== 'ai_prompt_primary_article_body' &&
    p.key !== 'ai_prompt_article_writer' && // Deprecated: replaced by title/body prompts
    p.key !== 'ai_prompt_content_evaluator' // Deprecated: replaced by criteria-based scoring
  )
  const secondaryOtherPrompts = prompts.filter(p =>
    p.key.startsWith('ai_prompt_secondary_') &&
    !p.key.startsWith('ai_prompt_secondary_criteria_') &&
    p.key !== 'ai_prompt_secondary_article_title' &&
    p.key !== 'ai_prompt_secondary_article_body' &&
    p.key !== 'ai_prompt_secondary_article_writer' && // Deprecated: replaced by title/body prompts
    p.key !== 'ai_prompt_secondary_content_evaluator' // Deprecated: replaced by criteria-based scoring
  )

  type PromptType = typeof prompts[0]
  const otherGrouped = otherPrompts.reduce((acc, prompt) => {
    if (!acc[prompt.category]) {
      acc[prompt.category] = []
    }
    acc[prompt.category].push(prompt)
    return acc
  }, {} as Record<string, PromptType[]>)

  // Helper function to render a single prompt card
  const renderPromptCard = (prompt: any) => {
    const isExpanded = expandedPrompt === prompt.key
    const isEditing = editingPrompt?.key === prompt.key
    const isSaving = saving === prompt.key

    return (
      <div key={prompt.key} className="p-6">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-base font-medium text-gray-900">{prompt.name}</h4>
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                detectProviderFromPrompt(isEditing ? editingPrompt?.value : prompt.value) === 'claude'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {detectProviderFromPrompt(isEditing ? editingPrompt?.value : prompt.value) === 'claude' ? 'Claude' : 'OpenAI'}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">{prompt.description}</p>
          </div>
          <button
            onClick={() => setExpandedPrompt(isExpanded ? null : prompt.key)}
            className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            {isExpanded ? 'Collapse' : 'View/Edit'}
          </button>
        </div>

        {isExpanded && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Prompt Content
              </label>
              <span className="text-xs text-gray-500">
                {isEditing
                  ? editingPrompt?.value.length || 0
                  : typeof prompt.value === 'object'
                    ? JSON.stringify(prompt.value).length
                    : prompt.value.length} characters
              </span>
            </div>
            {isEditing ? (
              <>
                <textarea
                  value={editingPrompt?.value || ''}
                  onChange={(e) => editingPrompt && setEditingPrompt({ ...editingPrompt, value: e.target.value })}
                  rows={15}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="mt-3 flex items-center justify-between">
                  <button
                    onClick={() => handleTestPrompt(prompt.key)}
                    className="px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-md hover:bg-purple-50"
                  >
                    Test Prompt
                  </button>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleCancel}
                      disabled={isSaving}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSave(prompt.key)}
                      disabled={isSaving}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="mb-2 flex items-center">
                  <label className="flex items-center text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prettyPrint}
                      onChange={(e) => setPrettyPrint(e.target.checked)}
                      className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    Pretty-print
                  </label>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                  {formatJSON(prompt.value, prettyPrint)}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleReset(prompt.key)}
                      disabled={saving === prompt.key}
                      className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                    >
                      {saving === prompt.key ? 'Resetting...' : 'Reset to Default'}
                    </button>
                    <button
                      onClick={() => handleSaveAsDefault(prompt.key)}
                      disabled={saving === prompt.key}
                      className="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50"
                    >
                      {saving === prompt.key ? 'Saving...' : 'Save as Default'}
                    </button>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleEdit(prompt)}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      Edit Prompt
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">AI Prompts</h2>
        <p className="text-sm text-gray-600">
          Customize the AI prompts used throughout the newsletter system. Changes take effect immediately.
          Use <code className="bg-gray-100 px-1 rounded text-xs">{'{{}}'}</code> placeholders for dynamic content.
        </p>

        {message && (
          <div className={`mt-4 p-3 rounded ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message}
          </div>
        )}
      </div>

      {/* Primary Evaluation Criteria Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Primary Article Prompts</h3>
              <p className="text-sm text-gray-600 mt-1">
                Configure evaluation criteria and content generation for primary (top) articles. Includes Article Title and Article Body prompts. {primaryEnabledCount} of 5 criteria enabled.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleAddPrimaryCriteria}
                disabled={primaryEnabledCount >= 5 || saving === 'add_primary_criteria'}
                className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving === 'add_primary_criteria' ? 'Adding...' : 'Add Criteria'}
              </button>
              <button
                onClick={handleRemovePrimaryCriteria}
                disabled={primaryEnabledCount <= 1 || saving === 'remove_primary_criteria'}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving === 'remove_primary_criteria' ? 'Removing...' : 'Remove Criteria'}
              </button>
            </div>
          </div>
          {/* RSS Post Selector for Testing */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              RSS Post for Testing Primary Prompts
            </label>
            <select
              value={selectedPrimaryRssPost}
              onChange={(e) => setSelectedPrimaryRssPost(e.target.value)}
              disabled={loadingPrimaryRssPosts}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {loadingPrimaryRssPosts ? (
                <option>Loading posts...</option>
              ) : primaryRssPosts.length === 0 ? (
                <option>No primary RSS posts available</option>
              ) : (
                primaryRssPosts.map((post) => (
                  <option key={post.id} value={post.id}>
                    {post.title} {post.rss_feed?.name ? `(${post.rss_feed.name})` : ''} - {new Date(post.processed_at).toLocaleDateString()}
                  </option>
                ))
              )}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Only showing posts from feeds assigned to Primary section
            </p>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {primaryCriteria.filter(c => c.enabled).map((criterion) => {
            const promptKey = `ai_prompt_criteria_${criterion.number}`
            const prompt = criteriaPrompts.find(p => p.key === promptKey)
            const isExpanded = expandedPrompt === promptKey
            const isEditing = editingPrompt?.key === promptKey
            const isSaving = saving === promptKey
            const isEditingWeight = editingWeight?.key === promptKey
            const isEditingCriteriaName = editingPrimaryName?.number === criterion.number

            return (
              <div key={criterion.number} className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    {/* Criteria Name */}
                    <div className="flex items-center space-x-2 mb-2">
                      <label className="text-xs font-medium text-gray-500 uppercase">Criteria Name:</label>
                      {isEditingCriteriaName ? (
                        <>
                          <input
                            type="text"
                            value={editingPrimaryName?.value || ''}
                            onChange={(e) => setEditingPrimaryName({ number: criterion.number, value: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm flex-1 max-w-xs"
                            placeholder="Enter criteria name"
                          />
                          <button
                            onClick={() => handlePrimaryNameSave(criterion.number)}
                            disabled={saving === `criteria_${criterion.number}_name`}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {saving === `criteria_${criterion.number}_name` ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handlePrimaryNameCancel}
                            disabled={saving === `criteria_${criterion.number}_name`}
                            className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <h4 className="text-base font-medium text-gray-900">{criterion.name}</h4>
                          {!isEditing && prompt && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                              detectProviderFromPrompt(prompt.value) === 'claude'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {detectProviderFromPrompt(prompt.value) === 'claude' ? 'Claude' : 'OpenAI'}
                            </span>
                          )}
                          <button
                            onClick={() => handlePrimaryNameEdit(criterion.number, criterion.name)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Edit Name
                          </button>
                        </>
                      )}
                    </div>

                    {/* Weight Input */}
                    <div className="mt-2 flex items-center space-x-3">
                      <label className="text-sm font-medium text-gray-700">Weight:</label>
                      {isEditingWeight ? (
                        <>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={editingWeight?.value || '1.0'}
                            onChange={(e) => setEditingWeight({ key: promptKey, value: e.target.value })}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <button
                            onClick={() => handleWeightSave(promptKey)}
                            disabled={isSaving}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {isSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleWeightCancel}
                            disabled={isSaving}
                            className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-semibold text-brand-primary">{criterion.weight}</span>
                          <button
                            onClick={() => handleWeightEdit({ key: promptKey, weight: criterion.weight.toString() })}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                          <span className="text-xs text-gray-500">
                            (Max final score contribution: {(criterion.weight * 10).toFixed(1)} points)
                          </span>
                        </>
                      )}
                    </div>

                    {prompt && (
                      <p className="text-sm text-gray-600 mt-2">{prompt.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setExpandedPrompt(isExpanded ? null : promptKey)}
                    className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    {isExpanded ? 'Collapse' : 'View/Edit Prompt'}
                  </button>
                </div>

                {isExpanded && prompt && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">
                        Prompt Content
                      </label>
                      <span className="text-xs text-gray-500">
                        {isEditing
                          ? editingPrompt?.value.length || 0
                          : typeof prompt.value === 'object'
                            ? JSON.stringify(prompt.value).length
                            : prompt.value.length} characters
                      </span>
                    </div>
                    {isEditing ? (
                      <>
                        <textarea
                          value={editingPrompt?.value || ''}
                          onChange={(e) => editingPrompt && setEditingPrompt({ ...editingPrompt, value: e.target.value })}
                          rows={15}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="mt-3 flex items-center justify-between">
                          <button
                            onClick={() => handleTestPrompt(promptKey)}
                            className="px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-md hover:bg-purple-50"
                          >
                            Test Prompt
                          </button>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={handleCancel}
                              disabled={isSaving}
                              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSave(promptKey)}
                              disabled={isSaving}
                              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                              {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mb-2 flex items-center">
                          <label className="flex items-center text-sm text-gray-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={prettyPrint}
                              onChange={(e) => setPrettyPrint(e.target.checked)}
                              className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            Pretty-print
                          </label>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                          {formatJSON(prompt.value, prettyPrint)}
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleReset(promptKey)}
                              disabled={saving === promptKey}
                              className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                            >
                              {saving === promptKey ? 'Resetting...' : 'Reset to Default'}
                            </button>
                            <button
                              onClick={() => handleSaveAsDefault(promptKey)}
                              disabled={saving === promptKey}
                              className="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50"
                            >
                              {saving === promptKey ? 'Saving...' : 'Save as Default'}
                            </button>
                          </div>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleEdit(prompt)}
                              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                            >
                              Edit Prompt
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Primary Article Title Prompt */}
          {primaryTitlePrompt && renderPromptCard(primaryTitlePrompt)}

          {/* Primary Article Body Prompt */}
          {primaryBodyPrompt && renderPromptCard(primaryBodyPrompt)}
        </div>
      </div>

      {/* Secondary Article Prompts Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Secondary Article Prompts</h3>
              <p className="text-sm text-gray-600 mt-1">
                Configure evaluation criteria and content generation for secondary (bottom) articles. Includes Article Title and Article Body prompts. {secondaryEnabledCount} of 5 criteria enabled.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleAddSecondaryCriteria}
                disabled={secondaryEnabledCount >= 5 || saving === 'add_secondary_criteria'}
                className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving === 'add_secondary_criteria' ? 'Adding...' : 'Add Criteria'}
              </button>
              <button
                onClick={handleRemoveSecondaryCriteria}
                disabled={secondaryEnabledCount <= 1 || saving === 'remove_secondary_criteria'}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving === 'remove_secondary_criteria' ? 'Removing...' : 'Remove Criteria'}
              </button>
            </div>
          </div>
          {/* RSS Post Selector for Testing */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              RSS Post for Testing Secondary Prompts
            </label>
            <select
              value={selectedSecondaryRssPost}
              onChange={(e) => setSelectedSecondaryRssPost(e.target.value)}
              disabled={loadingSecondaryRssPosts}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {loadingSecondaryRssPosts ? (
                <option>Loading posts...</option>
              ) : secondaryRssPosts.length === 0 ? (
                <option>No secondary RSS posts available</option>
              ) : (
                secondaryRssPosts.map((post) => (
                  <option key={post.id} value={post.id}>
                    {post.title} {post.rss_feed?.name ? `(${post.rss_feed.name})` : ''} - {new Date(post.processed_at).toLocaleDateString()}
                  </option>
                ))
              )}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Only showing posts from feeds assigned to Secondary section
            </p>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {secondaryCriteria.filter(c => c.enabled).map((criterion) => {
            const promptKey = `ai_prompt_secondary_criteria_${criterion.number}`
            const prompt = secondaryCriteriaPrompts.find(p => p.key === promptKey)
            const isExpanded = expandedPrompt === promptKey
            const isEditing = editingPrompt?.key === promptKey
            const isSaving = saving === promptKey
            const isEditingWeight = editingWeight?.key === promptKey
            const isEditingCriteriaName = editingSecondaryName?.number === criterion.number

            if (!prompt) return null

            return (
              <div key={criterion.number} className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    {/* Criteria Name */}
                    <div className="flex items-center space-x-2 mb-2">
                      <label className="text-xs font-medium text-gray-500 uppercase">Criteria Name:</label>
                      {isEditingCriteriaName ? (
                        <>
                          <input
                            type="text"
                            value={editingSecondaryName?.value || ''}
                            onChange={(e) => setEditingSecondaryName({ number: criterion.number, value: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm flex-1 max-w-xs"
                            placeholder="Enter criteria name"
                          />
                          <button
                            onClick={() => handleSecondaryNameSave(criterion.number)}
                            disabled={saving === `criteria_${criterion.number}_name`}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {saving === `criteria_${criterion.number}_name` ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleSecondaryNameCancel}
                            disabled={saving === `criteria_${criterion.number}_name`}
                            className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <h4 className="text-base font-medium text-gray-900">{criterion.secondaryName}</h4>
                          {!isEditing && prompt && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                              detectProviderFromPrompt(prompt.value) === 'claude'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {detectProviderFromPrompt(prompt.value) === 'claude' ? 'Claude' : 'OpenAI'}
                            </span>
                          )}
                          <button
                            onClick={() => handleSecondaryNameEdit(criterion.number, criterion.secondaryName)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Edit Name
                          </button>
                        </>
                      )}
                    </div>

                    {/* Weight Input */}
                    <div className="mt-2 flex items-center space-x-3">
                      <label className="text-sm font-medium text-gray-700">Weight:</label>
                      {isEditingWeight ? (
                        <>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={editingWeight?.value || '1.0'}
                            onChange={(e) => setEditingWeight({ key: promptKey, value: e.target.value })}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <button
                            onClick={() => handleWeightSave(promptKey)}
                            disabled={isSaving}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {isSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleWeightCancel}
                            disabled={isSaving}
                            className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-semibold text-brand-primary">{criterion.secondaryWeight || 1.0}</span>
                          <button
                            onClick={() => handleWeightEdit({ key: promptKey, weight: (criterion.secondaryWeight || 1.0).toString() })}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                          <span className="text-xs text-gray-500">
                            (Max final score contribution: {((criterion.secondaryWeight || 1.0) * 10).toFixed(1)} points)
                          </span>
                        </>
                      )}
                    </div>

                    {prompt && (
                      <p className="text-sm text-gray-600 mt-2">{prompt.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setExpandedPrompt(isExpanded ? null : promptKey)}
                    className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    {isExpanded ? 'Collapse' : 'View/Edit Prompt'}
                  </button>
                </div>

                {isExpanded && prompt && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">
                        Prompt Content
                      </label>
                      <span className="text-xs text-gray-500">
                        {isEditing
                          ? editingPrompt?.value.length || 0
                          : typeof prompt.value === 'object'
                            ? JSON.stringify(prompt.value).length
                            : prompt.value.length} characters
                      </span>
                    </div>
                    {isEditing ? (
                      <>
                        <textarea
                          value={editingPrompt?.value || ''}
                          onChange={(e) => editingPrompt && setEditingPrompt({ ...editingPrompt, value: e.target.value })}
                          rows={15}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="mt-3 flex items-center justify-between">
                          <button
                            onClick={() => handleTestPrompt(promptKey)}
                            className="px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-md hover:bg-purple-50"
                          >
                            Test Prompt
                          </button>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={handleCancel}
                              disabled={isSaving}
                              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSave(promptKey)}
                              disabled={isSaving}
                              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                              {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mb-2 flex items-center">
                          <label className="flex items-center text-sm text-gray-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={prettyPrint}
                              onChange={(e) => setPrettyPrint(e.target.checked)}
                              className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            Pretty-print
                          </label>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                          {formatJSON(prompt.value, prettyPrint)}
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleReset(promptKey)}
                              disabled={saving === promptKey}
                              className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                            >
                              {saving === promptKey ? 'Resetting...' : 'Reset to Default'}
                            </button>
                            <button
                              onClick={() => handleSaveAsDefault(promptKey)}
                              disabled={saving === promptKey}
                              className="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50"
                            >
                              {saving === promptKey ? 'Saving...' : 'Save as Default'}
                            </button>
                          </div>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleEdit(prompt)}
                              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                            >
                              Edit Prompt
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Secondary Article Title Prompt */}
          {secondaryTitlePrompt && renderPromptCard(secondaryTitlePrompt)}

          {/* Secondary Article Body Prompt */}
          {secondaryBodyPrompt && renderPromptCard(secondaryBodyPrompt)}
        </div>
      </div>

      {/* Secondary Other Prompts - Only show if there are prompts besides title/body */}
      {secondaryOtherPrompts.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Other Secondary Prompts</h3>
            <p className="text-sm text-gray-600 mt-1">
              Additional AI prompts for secondary article processing (content evaluator, etc.)
            </p>
          </div>
          <div className="divide-y divide-gray-200">
            {secondaryOtherPrompts.map((prompt) => {
              const isExpanded = expandedPrompt === prompt.key
              const isEditing = editingPrompt?.key === prompt.key
              const isSaving = saving === prompt.key

              return (
                <div key={prompt.key} className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="text-base font-medium text-gray-900">{prompt.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{prompt.description}</p>
                    </div>
                    <button
                      onClick={() => setExpandedPrompt(isExpanded ? null : prompt.key)}
                      className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      {isExpanded ? 'Collapse' : 'View/Edit'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4">
                      {isEditing ? (
                        <>
                          <textarea
                            value={editingPrompt?.value || ''}
                            onChange={(e) => editingPrompt && setEditingPrompt({ ...editingPrompt, value: e.target.value })}
                            rows={20}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-xs"
                            disabled={isSaving}
                          />
                          <div className="mt-3 flex justify-end space-x-3">
                            <button
                              onClick={handleCancel}
                              disabled={isSaving}
                              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSave(prompt.key)}
                              disabled={isSaving}
                              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                              {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="mb-2 flex items-center">
                            <label className="flex items-center text-sm text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={prettyPrint}
                                onChange={(e) => setPrettyPrint(e.target.checked)}
                                className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              Pretty-print
                            </label>
                          </div>
                          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                            {formatJSON(prompt.value, prettyPrint)}
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={() => handleReset(prompt.key)}
                                disabled={saving === prompt.key}
                                className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                              >
                                {saving === prompt.key ? 'Resetting...' : 'Reset to Default'}
                              </button>
                              <button
                                onClick={() => handleSaveAsDefault(prompt.key)}
                                disabled={saving === prompt.key}
                                className="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50"
                              >
                                {saving === prompt.key ? 'Saving...' : 'Save as Default'}
                              </button>
                            </div>
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={() => handleTestPrompt(prompt.key)}
                                className="px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-md hover:bg-purple-50"
                              >
                                Test Prompt
                              </button>
                              <button
                                onClick={() => handleEdit(prompt)}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                              >
                                Edit Prompt
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Other Prompts by Category */}
      {Object.entries(otherGrouped).map(([category, categoryPrompts]) => (
        <div key={category} className="bg-white shadow rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">{category}</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {(categoryPrompts as PromptType[]).map((prompt) => {
              const isExpanded = expandedPrompt === prompt.key
              const isEditing = editingPrompt?.key === prompt.key
              const isSaving = saving === prompt.key

              return (
                <div key={prompt.key} className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-medium text-gray-900">{prompt.name}</h4>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          detectProviderFromPrompt(isEditing ? editingPrompt?.value : prompt.value) === 'claude'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {detectProviderFromPrompt(isEditing ? editingPrompt?.value : prompt.value) === 'claude' ? 'Claude' : 'OpenAI'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{prompt.description}</p>
                    </div>
                    <button
                      onClick={() => setExpandedPrompt(isExpanded ? null : prompt.key)}
                      className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      {isExpanded ? 'Collapse' : 'View/Edit'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">
                          Prompt Content
                        </label>
                        <span className="text-xs text-gray-500">
                          {isEditing
                            ? editingPrompt?.value.length || 0
                            : typeof prompt.value === 'object'
                              ? JSON.stringify(prompt.value).length
                              : prompt.value.length} characters
                        </span>
                      </div>
                      {isEditing ? (
                        <>
                          <textarea
                            value={editingPrompt?.value || ''}
                            onChange={(e) => editingPrompt && setEditingPrompt({ ...editingPrompt, value: e.target.value })}
                            rows={15}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="mt-3 flex items-center justify-between">
                            <button
                              onClick={() => handleTestPrompt(prompt.key)}
                              className="px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-md hover:bg-purple-50"
                            >
                              Test Prompt
                            </button>
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={handleCancel}
                                disabled={isSaving}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSave(prompt.key)}
                                disabled={isSaving}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                              >
                                {isSaving ? 'Saving...' : 'Save Changes'}
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="mb-2 flex items-center">
                            <label className="flex items-center text-sm text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={prettyPrint}
                                onChange={(e) => setPrettyPrint(e.target.checked)}
                                className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              Pretty-print
                            </label>
                          </div>
                          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                            {formatJSON(prompt.value, prettyPrint)}
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={() => handleReset(prompt.key)}
                                disabled={saving === prompt.key}
                                className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                              >
                                {saving === prompt.key ? 'Resetting...' : 'Reset to Default'}
                              </button>
                              <button
                                onClick={() => handleSaveAsDefault(prompt.key)}
                                disabled={saving === prompt.key}
                                className="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50"
                              >
                                {saving === prompt.key ? 'Saving...' : 'Save as Default'}
                              </button>
                            </div>
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={() => handleEdit(prompt)}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                              >
                                Edit Prompt
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Help Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-medium text-blue-900 mb-3">Prompt Placeholders</h4>
        <div className="text-sm text-blue-800 space-y-2">
          <p><code className="bg-blue-100 px-2 py-0.5 rounded">{'{'}title{'}'}</code> - Article/event title</p>
          <p><code className="bg-blue-100 px-2 py-0.5 rounded">{'{'}description{'}'}</code> - Article/event description</p>
          <p><code className="bg-blue-100 px-2 py-0.5 rounded">{'{'}content{'}'}</code> - Full article content</p>
          <p><code className="bg-blue-100 px-2 py-0.5 rounded">{'{'}date{'}'}</code> - Issue date</p>
          <p><code className="bg-blue-100 px-2 py-0.5 rounded">{'{'}headline{'}'}</code> - Newsletter article headline</p>
          <p className="mt-3 text-xs text-blue-700">
            ⚠️ <strong>Important:</strong> Changes take effect immediately. Test prompts carefully before saving.
          </p>
        </div>
      </div>

      {/* Testing Playground Button */}
      {newsletterSlug && (
        <div className="flex justify-center">
          <Link
            href={`https://www.aiprodaily.com/dashboard/${newsletterSlug}/settings/AIPromptTesting`}
            className="px-6 py-3 text-base font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            Testing Playground
          </Link>
        </div>
      )}

      {/* Test Modal */}
      {testModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Prompt Test Results</h3>
              <button
                onClick={() => setTestModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {testLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                  <span className="ml-4 text-gray-600">Testing prompt...</span>
                </div>
              ) : testError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                  <strong>Error:</strong> {testError}
                </div>
              ) : testResults ? (
                <div className="space-y-6">
                  {/* RSS Post Info */}
                  {testResults.rss_post_used && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2">Test Data:</h4>
                      <p className="text-sm text-blue-800">
                        <strong>Post:</strong> {testResults.rss_post_used.title}
                      </p>
                      {testResults.rss_post_used.source_url && (
                        <p className="text-sm text-blue-800 mt-1">
                          <strong>Source:</strong>{' '}
                          <a href={testResults.rss_post_used.source_url} target="_blank" rel="noopener noreferrer" className="underline">
                            {testResults.rss_post_used.source_url}
                          </a>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Parsed Expected Outputs */}
                  {testResults.parsedOutputs && Object.keys(testResults.parsedOutputs).length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-medium text-green-900 mb-3">Expected Outputs:</h4>
                      <div className="space-y-2">
                        {Object.entries(testResults.parsedOutputs).map(([fieldName, fieldData]: [string, any]) => (
                          <div key={fieldName} className="bg-white border border-gray-200 rounded p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-700 mb-1">{fieldName}:</p>
                                {fieldData.error ? (
                                  <p className="text-sm font-bold text-red-600">ERROR</p>
                                ) : (
                                  <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                                    {typeof fieldData.value === 'object'
                                      ? JSON.stringify(fieldData.value, null, 2)
                                      : fieldData.value}
                                  </p>
                                )}
                              </div>
                              <span className={`ml-3 px-2 py-1 text-xs font-medium rounded ${
                                fieldData.error
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {fieldData.error ? 'Failed' : 'Parsed'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Test Results */}
                  {Object.entries(testResults.results || {}).map(([key, result]: [string, any]) => (
                    <div key={key} className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </h4>

                      {result.success ? (
                        <div className="space-y-3">
                          <div>
                            <h5 className="text-sm font-semibold text-gray-700 mb-2">Parsed Content:</h5>
                            {typeof result.response === 'string' ? (
                              <div className="bg-gray-50 rounded p-4 whitespace-pre-wrap font-mono text-sm">
                                {result.response}
                              </div>
                            ) : result.response?.raw ? (
                              <div className="bg-gray-50 rounded p-4 whitespace-pre-wrap font-mono text-sm">
                                {result.response.raw}
                              </div>
                            ) : (
                              <div className="bg-gray-50 rounded p-4">
                                <pre className="whitespace-pre-wrap text-sm">
                                  {JSON.stringify(result.response, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>

                          {result.fullResponse && (
                            <details className="border border-gray-300 rounded-lg">
                              <summary className="cursor-pointer px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-t-lg font-medium text-sm text-gray-700">
                                Full API Response (Click to expand)
                              </summary>
                              <div className="bg-white p-4 rounded-b-lg">
                                <pre className="whitespace-pre-wrap text-xs overflow-x-auto">
                                  {JSON.stringify(result.fullResponse, null, 2)}
                                </pre>
                              </div>
                            </details>
                          )}

                          {result.character_count && (
                            <p className="text-sm text-gray-600">
                              Character count: {result.character_count}
                            </p>
                          )}
                          {result.prompt_length && (
                            <p className="text-sm text-gray-600">
                              Prompt length: {result.prompt_length} characters
                            </p>
                          )}
                          {result.test_posts_count && (
                            <p className="text-sm font-medium text-blue-600">
                              Test articles: {result.test_posts_count} articles analyzed
                            </p>
                          )}
                          {result.expected_duplicates && (
                            <p className="text-sm text-gray-600 mt-2">
                              <strong>Expected duplicates:</strong> {result.expected_duplicates}
                            </p>
                          )}
                          {result.test_articles_count && (
                            <p className="text-sm font-medium text-blue-600">
                              Test articles: {result.test_articles_count} articles analyzed
                            </p>
                          )}
                          {result.prompt_source && (
                            <p className="text-sm text-gray-500">
                              Prompt source: {result.prompt_source}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
                          <strong>Error:</strong> {result.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setTestModalOpen(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PublicEventsSettings() {
  const [settings, setSettings] = useState({
    paidPlacementPrice: '5',
    featuredEventPrice: '15'
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/public-events')
      if (response.ok) {
        const data = await response.json()
        setSettings(prev => ({ ...prev, ...data }))
      }
    } catch (error) {
      console.error('Failed to load public events settings:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/public-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        setMessage('Settings saved successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (error) {
      setMessage('Failed to save settings. Please try again.')
      console.error('Save error:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-6">
      {/* Pricing Configuration */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Public Event Submission Pricing</h3>
        <p className="text-sm text-gray-600 mb-4">
          Configure pricing for public event submissions. All events are promoted for 3 days.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Paid Placement Price (3 days)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                $
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.paidPlacementPrice}
                onChange={(e) => handleChange('paidPlacementPrice', e.target.value)}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Price for paid placement in newsletter for 3 days
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Featured Event Price (3 days)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                $
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.featuredEventPrice}
                onChange={(e) => handleChange('featuredEventPrice', e.target.value)}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Price for featured event status for 3 days
            </p>
          </div>
        </div>
      </div>

      {/* Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">How Public Event Submissions Work</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Public users can submit events through the website</li>
          <li>• Submissions require payment via Stripe Checkout</li>
          <li>• All submissions are automatically activated upon successful payment</li>
          <li>• Admins receive Slack notifications for new submissions</li>
          <li>• Admins can review, edit, or reject submissions in the dashboard</li>
          <li>• Paid Placement: Event appears in paid section of newsletter</li>
          <li>• Featured Event: Event appears prominently in the Local Events section</li>
          <li>• All promotions last for 3 days from the event start date</li>
        </ul>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-brand-primary hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-md font-medium"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {message && (
        <div className={`mt-4 p-4 rounded-md ${
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

function AdsSettings() {
  const [tiers, setTiers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [adsPerNewsletter, setAdsPerNewsletter] = useState<number>(1)
  const [savingAdsPerNewsletter, setSavingAdsPerNewsletter] = useState(false)
  const [maxTopArticles, setMaxTopArticles] = useState<number>(3)
  const [maxBottomArticles, setMaxBottomArticles] = useState<number>(3)
  const [savingMaxArticles, setSavingMaxArticles] = useState(false)

  useEffect(() => {
    loadTiers()
    loadAdsPerNewsletter()
    loadMaxArticles()
  }, [])

  const loadTiers = async () => {
    try {
      const response = await fetch('/api/settings/ad-pricing')
      if (response.ok) {
        const data = await response.json()
        setTiers(data.tiers || [])
      }
    } catch (error) {
      console.error('Failed to load pricing tiers:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAdsPerNewsletter = async () => {
    try {
      const response = await fetch('/api/settings/email')
      if (response.ok) {
        const data = await response.json()
        const setting = data.settings.find((s: any) => s.key === 'ads_per_newsletter')
        if (setting) {
          setAdsPerNewsletter(parseInt(setting.value))
        }
      }
    } catch (error) {
      console.error('Failed to load ads per newsletter:', error)
    }
  }

  const saveAdsPerNewsletter = async () => {
    if (adsPerNewsletter < 1 || adsPerNewsletter > 4) {
      alert('Ads per newsletter must be between 1 and 4')
      return
    }

    setSavingAdsPerNewsletter(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ads_per_newsletter: adsPerNewsletter.toString()
        })
      })

      if (response.ok) {
        setMessage('Ads per newsletter updated successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to update setting')
      }
    } catch (error) {
      setMessage('Failed to update ads per newsletter. Please try again.')
      console.error('Save error:', error)
    } finally {
      setSavingAdsPerNewsletter(false)
    }
  }

  const loadMaxArticles = async () => {
    try {
      const response = await fetch('/api/settings/email')
      if (response.ok) {
        const data = await response.json()

        // Data is a flat object, not { settings: [...] }
        if (data.max_top_articles) {
          setMaxTopArticles(parseInt(data.max_top_articles))
        }
        if (data.max_bottom_articles) {
          setMaxBottomArticles(parseInt(data.max_bottom_articles))
        }
      }
    } catch (error) {
      console.error('Failed to load max articles settings:', error)
    }
  }

  const saveMaxArticles = async () => {
    if (maxTopArticles < 1 || maxTopArticles > 10) {
      alert('Max primary articles must be between 1 and 10')
      return
    }
    if (maxBottomArticles < 1 || maxBottomArticles > 10) {
      alert('Max secondary articles must be between 1 and 10')
      return
    }

    setSavingMaxArticles(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_top_articles: maxTopArticles.toString(),
          max_bottom_articles: maxBottomArticles.toString()
        })
      })

      if (response.ok) {
        setMessage('Max articles settings updated successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to update settings')
      }
    } catch (error) {
      setMessage('Failed to update max articles settings. Please try again.')
      console.error('Save error:', error)
    } finally {
      setSavingMaxArticles(false)
    }
  }

  const handleEdit = (tier: any) => {
    setEditingId(tier.id)
    setEditPrice(tier.price_per_unit.toString())
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditPrice('')
  }

  const handleSaveEdit = async (tierId: string) => {
    if (!editPrice || isNaN(parseFloat(editPrice))) {
      alert('Please enter a valid price')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/ad-pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tierId,
          price_per_unit: parseFloat(editPrice)
        })
      })

      if (response.ok) {
        setMessage('Price updated successfully!')
        setTimeout(() => setMessage(''), 3000)
        setEditingId(null)
        setEditPrice('')
        loadTiers()
      } else {
        throw new Error('Failed to update price')
      }
    } catch (error) {
      setMessage('Failed to update price. Please try again.')
      console.error('Save error:', error)
    } finally {
      setSaving(false)
    }
  }

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'single': return 'Single Appearance'
      case 'weekly': return 'Weekly'
      case 'monthly': return 'Monthly'
      default: return frequency
    }
  }

  const getQuantityLabel = (tier: any) => {
    if (tier.max_quantity === null) {
      return `${tier.min_quantity}+`
    }
    return `${tier.min_quantity}-${tier.max_quantity}`
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  // Group tiers by frequency
  const tiersByFrequency = {
    single: tiers.filter(t => t.frequency === 'single'),
    weekly: tiers.filter(t => t.frequency === 'weekly'),
    monthly: tiers.filter(t => t.frequency === 'monthly')
  }

  return (
    <div className="space-y-6">
      {/* Pricing Configuration */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Advertisement Pricing Tiers</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure pricing for Community Business Spotlight advertisements. Prices are based on frequency type and quantity purchased.
        </p>

        {/* Single Appearance Tiers */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Single Appearance Pricing</h4>
          <div className="space-y-2">
            {tiersByFrequency.single.map(tier => (
              <div key={tier.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                <div className="flex-1">
                  <span className="font-medium">{getQuantityLabel(tier)} appearances</span>
                </div>
                <div className="flex items-center gap-3">
                  {editingId === tier.id ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded"
                          disabled={saving}
                        />
                        <span className="text-gray-500">each</span>
                      </div>
                      <button
                        onClick={() => handleSaveEdit(tier.id)}
                        disabled={saving}
                        className="text-green-600 hover:text-green-700 font-medium disabled:text-gray-400"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="text-gray-600 hover:text-gray-700 disabled:text-gray-400"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">${parseFloat(tier.price_per_unit).toFixed(2)} each</span>
                      <button
                        onClick={() => handleEdit(tier)}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Tiers */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Weekly Pricing</h4>
          <p className="text-xs text-gray-500 mb-2">Ad appears once per week (Sunday-Saturday)</p>
          <div className="space-y-2">
            {tiersByFrequency.weekly.map(tier => (
              <div key={tier.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                <div className="flex-1">
                  <span className="font-medium">{getQuantityLabel(tier)} weeks</span>
                </div>
                <div className="flex items-center gap-3">
                  {editingId === tier.id ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded"
                          disabled={saving}
                        />
                        <span className="text-gray-500">per week</span>
                      </div>
                      <button
                        onClick={() => handleSaveEdit(tier.id)}
                        disabled={saving}
                        className="text-green-600 hover:text-green-700 font-medium disabled:text-gray-400"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="text-gray-600 hover:text-gray-700 disabled:text-gray-400"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">${parseFloat(tier.price_per_unit).toFixed(2)} per week</span>
                      <button
                        onClick={() => handleEdit(tier)}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Tiers */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Monthly Pricing</h4>
          <p className="text-xs text-gray-500 mb-2">Ad appears once per calendar month</p>
          <div className="space-y-2">
            {tiersByFrequency.monthly.map(tier => (
              <div key={tier.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                <div className="flex-1">
                  <span className="font-medium">{getQuantityLabel(tier)} months</span>
                </div>
                <div className="flex items-center gap-3">
                  {editingId === tier.id ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded"
                          disabled={saving}
                        />
                        <span className="text-gray-500">per month</span>
                      </div>
                      <button
                        onClick={() => handleSaveEdit(tier.id)}
                        disabled={saving}
                        className="text-green-600 hover:text-green-700 font-medium disabled:text-gray-400"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="text-gray-600 hover:text-gray-700 disabled:text-gray-400"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">${parseFloat(tier.price_per_unit).toFixed(2)} per month</span>
                      <button
                        onClick={() => handleEdit(tier)}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
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

      {/* Ads Per Publication Configuration */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Publication Ad Settings</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure how many advertisements appear in each publication. Total publication items (ads + articles) = 5.
        </p>

        <div className="flex items-center gap-4">
          <label className="font-medium text-gray-700">Ads per publication:</label>
          <input
            type="number"
            min="1"
            max="4"
            value={adsPerNewsletter}
            onChange={(e) => setAdsPerNewsletter(parseInt(e.target.value) || 1)}
            className="w-20 px-3 py-2 border border-gray-300 rounded-md"
            disabled={savingAdsPerNewsletter}
          />
          <button
            onClick={saveAdsPerNewsletter}
            disabled={savingAdsPerNewsletter}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300"
          >
            {savingAdsPerNewsletter ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="mt-4 bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Current configuration:</strong> {adsPerNewsletter} {adsPerNewsletter === 1 ? 'ad' : 'ads'} + {5 - adsPerNewsletter} {5 - adsPerNewsletter === 1 ? 'article' : 'articles'} = 5 total items
          </p>
        </div>
      </div>

      {/* Article Limit Settings */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Article Limit Settings</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure the maximum number of articles that can be selected for the Primary Articles and Secondary Articles sections in each newsletter issue.
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="font-medium text-gray-700 w-56">Max Articles in Primary Section:</label>
            <input
              type="number"
              min="1"
              max="10"
              value={maxTopArticles}
              onChange={(e) => setMaxTopArticles(parseInt(e.target.value) || 1)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-md"
              disabled={savingMaxArticles}
            />
            <span className="text-sm text-gray-500">(1-10)</span>
          </div>

          <div className="flex items-center gap-4">
            <label className="font-medium text-gray-700 w-56">Max Articles in Secondary Section:</label>
            <input
              type="number"
              min="1"
              max="10"
              value={maxBottomArticles}
              onChange={(e) => setMaxBottomArticles(parseInt(e.target.value) || 1)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-md"
              disabled={savingMaxArticles}
            />
            <span className="text-sm text-gray-500">(1-10)</span>
          </div>

          <button
            onClick={saveMaxArticles}
            disabled={savingMaxArticles}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300"
          >
            {savingMaxArticles ? 'Saving...' : 'Save Article Limits'}
          </button>
        </div>

        <div className="mt-4 bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Current configuration:</strong> Primary Articles: {maxTopArticles}, Secondary Articles: {maxBottomArticles}
          </p>
          <p className="text-xs text-blue-700 mt-2">
            These limits control how many articles can be selected during RSS processing and on the issue detail page.
          </p>
        </div>
      </div>

      {/* Information Section */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-3">How Advertisement Pricing Works</h4>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>• <strong>Single:</strong> Pay per individual appearance in the newsletter</li>
          <li>• <strong>Weekly:</strong> Ad appears once per week (Sunday-Saturday) for the purchased number of weeks</li>
          <li>• <strong>Monthly:</strong> Ad appears once per calendar month for the purchased number of months</li>
          <li>• Volume discounts apply automatically based on quantity purchased</li>
          <li>• All ads are reviewed before approval and must meet content guidelines</li>
          <li>• Ads appear in the "Community Business Spotlight" section</li>
        </ul>
      </div>
    </div>
  )
}

function BusinessSettings() {
  const [settings, setSettings] = useState({
    newsletter_name: '',
    business_name: '',
    subject_line_emoji: '🧮',
    primary_color: '#3B82F6',
    secondary_color: '#10B981',
    tertiary_color: '#F59E0B',
    header_image_url: '',
    website_header_url: '',
    logo_url: '',
    contact_email: '',
    website_url: '',
    heading_font: 'Arial, sans-serif',
    body_font: 'Arial, sans-serif',
    facebook_enabled: false,
    facebook_url: '',
    twitter_enabled: false,
    twitter_url: '',
    linkedin_enabled: false,
    linkedin_url: '',
    instagram_enabled: false,
    instagram_url: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingHeader, setUploadingHeader] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingWebsiteHeader, setUploadingWebsiteHeader] = useState(false)
  const [message, setMessage] = useState('')

  const fontOptions = [
    'Arial, sans-serif',
    'Helvetica',
    'Georgia',
    'Times New Roman',
    'Verdana',
    'Trebuchet MS',
    'Courier New',
    'Tahoma'
  ]

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/business')
      if (response.ok) {
        const data = await response.json()
        setSettings(prev => ({ ...prev, ...data }))
      }
    } catch (error) {
      console.error('Failed to load business settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        setMessage('Business settings saved successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        const error = await response.json()
        setMessage(`Error: ${error.message || 'Failed to save settings'}`)
      }
    } catch (error) {
      setMessage('Error: Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = async (file: File, type: 'header' | 'logo' | 'website_header') => {
    const setUploading = type === 'header' ? setUploadingHeader : type === 'logo' ? setUploadingLogo : setUploadingWebsiteHeader
    setMessage('')

    try {
      // Create FormData with file and type
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)

      // Upload to server
      const uploadResponse = await fetch('/api/settings/upload-business-image', {
        method: 'POST',
        body: formData
      })

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json()
        throw new Error(error.error || 'Upload failed')
      }

      const data = await uploadResponse.json()

      // Update settings with new URL
      const fieldName = type === 'header' ? 'header_image_url' : type === 'logo' ? 'logo_url' : 'website_header_url'
      setSettings(prev => ({ ...prev, [fieldName]: data.url }))
      setMessage(data.message || `${type === 'header' ? 'Header' : type === 'logo' ? 'Logo' : 'Website Header'} image uploaded successfully!`)
      // Auto-save the settings with the new image URL
      setTimeout(async () => {
        await handleSave()
      }, 500)

    } catch (error) {
      console.error('Upload error:', error)
      setMessage(`Error: ${error instanceof Error ? error.message : 'Failed to upload image'}`)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading business settings...</div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Business Information</h3>

        {message && (
          <div className={`mb-4 p-3 rounded ${message.includes('Error') ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
            {message}
          </div>
        )}

        <div className="space-y-4">
          {/* Newsletter Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Publication Name
            </label>
            <input
              type="text"
              value={settings.newsletter_name}
              onChange={(e) => setSettings({ ...settings, newsletter_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., AI Accounting Daily"
            />
          </div>

          {/* Business Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Name
            </label>
            <input
              type="text"
              value={settings.business_name}
              onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., AI Pros Inc."
            />
          </div>

          {/* Subject Line Emoji */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject Line Emoji
            </label>
            <input
              type="text"
              value={settings.subject_line_emoji}
              onChange={(e) => setSettings({ ...settings, subject_line_emoji: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 🧮"
              maxLength={2}
            />
            <p className="mt-1 text-sm text-gray-500">
              This emoji will appear at the beginning of all email subject lines
            </p>
          </div>

          {/* Contact Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Email
            </label>
            <input
              type="email"
              value={settings.contact_email}
              onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., contact@aiaccountingdaily.com"
            />
          </div>

          {/* Website URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website URL
            </label>
            <input
              type="url"
              value={settings.website_url}
              onChange={(e) => setSettings({ ...settings, website_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., https://aiaccountingdaily.com"
            />
          </div>

        </div>
      </div>

      {/* Colors */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Brand Colors</h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Primary Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Primary Color (Header/Footer Background)
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={settings.primary_color}
                onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={settings.primary_color}
                onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="#3B82F6"
              />
            </div>
          </div>

          {/* Secondary Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Secondary Color (Buttons/Links)
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={settings.secondary_color}
                onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={settings.secondary_color}
                onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="#10B981"
              />
            </div>
          </div>

          {/* Tertiary Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tertiary Color (Accents)
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={settings.tertiary_color}
                onChange={(e) => setSettings({ ...settings, tertiary_color: e.target.value })}
                className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={settings.tertiary_color}
                onChange={(e) => setSettings({ ...settings, tertiary_color: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="#F59E0B"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Fonts */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Typography</h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Heading Font */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Heading Font
            </label>
            <select
              value={settings.heading_font}
              onChange={(e) => setSettings({ ...settings, heading_font: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {fontOptions.map(font => (
                <option key={font} value={font}>{font}</option>
              ))}
            </select>
            <p className="mt-2 text-sm text-gray-600" style={{ fontFamily: settings.heading_font }}>
              This is how your headings will look in the newsletter.
            </p>
          </div>

          {/* Body Font */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Body Font
            </label>
            <select
              value={settings.body_font}
              onChange={(e) => setSettings({ ...settings, body_font: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {fontOptions.map(font => (
                <option key={font} value={font}>{font}</option>
              ))}
            </select>
            <p className="mt-2 text-sm text-gray-600" style={{ fontFamily: settings.body_font }}>
              This is how your body text will appear in the newsletter.
            </p>
          </div>
        </div>
      </div>

      {/* Images */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Images</h3>

        {/* Header Image */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Header Image
          </label>
          {settings.header_image_url && (
            <div className="mb-2 p-4 rounded border">
              <img
                src={settings.header_image_url}
                alt="Header preview"
                className="max-w-md h-32 object-contain mx-auto"
              />
            </div>
          )}
          <div className="flex items-center space-x-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageUpload(file, 'header')
              }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              disabled={uploadingHeader}
            />
            {uploadingHeader && <span className="text-sm text-gray-500">Uploading...</span>}
          </div>
        </div>

        {/* Logo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Logo (Square Image)
          </label>
          {settings.logo_url && (
            <div className="mb-2">
              <img
                src={settings.logo_url}
                alt="Logo preview"
                className="w-16 h-16 object-cover rounded border"
              />
            </div>
          )}
          <div className="flex items-center space-x-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageUpload(file, 'logo')
              }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              disabled={uploadingLogo}
            />
            {uploadingLogo && <span className="text-sm text-gray-500">Uploading...</span>}
          </div>
        </div>

        {/* Website Header Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Website Header Image
          </label>
          <p className="text-xs text-gray-500 mb-2">This image appears in the website header navigation.</p>
          {settings.website_header_url && (
            <div className="mb-2 p-4 rounded border">
              <img
                src={settings.website_header_url}
                alt="Website header preview"
                className="max-w-md h-32 object-contain mx-auto"
              />
            </div>
          )}
          <div className="flex items-center space-x-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageUpload(file, 'website_header')
              }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              disabled={uploadingWebsiteHeader}
            />
            {uploadingWebsiteHeader && <span className="text-sm text-gray-500">Uploading...</span>}
          </div>
        </div>
      </div>
      {/* Social Media */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Social Media Links</h3>
        <p className="text-sm text-gray-600 mb-4">Enable individual social media links to display in the newsletter footer.</p>

        <div className="space-y-4">
          {/* Facebook */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Facebook
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.facebook_enabled}
                  onChange={(e) => setSettings({ ...settings, facebook_enabled: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Enable</span>
              </label>
            </div>
            <input
              type="url"
              value={settings.facebook_url}
              onChange={(e) => setSettings({ ...settings, facebook_url: e.target.value })}
              disabled={!settings.facebook_enabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="https://facebook.com/yourpage"
            />
          </div>

          {/* Twitter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Twitter/X
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.twitter_enabled}
                  onChange={(e) => setSettings({ ...settings, twitter_enabled: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Enable</span>
              </label>
            </div>
            <input
              type="url"
              value={settings.twitter_url}
              onChange={(e) => setSettings({ ...settings, twitter_url: e.target.value })}
              disabled={!settings.twitter_enabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="https://twitter.com/yourhandle"
            />
          </div>

          {/* LinkedIn */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                LinkedIn
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.linkedin_enabled}
                  onChange={(e) => setSettings({ ...settings, linkedin_enabled: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Enable</span>
              </label>
            </div>
            <input
              type="url"
              value={settings.linkedin_url}
              onChange={(e) => setSettings({ ...settings, linkedin_url: e.target.value })}
              disabled={!settings.linkedin_enabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="https://linkedin.com/company/yourcompany"
            />
          </div>

          {/* Instagram */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Instagram
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.instagram_enabled}
                  onChange={(e) => setSettings({ ...settings, instagram_enabled: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Enable</span>
              </label>
            </div>
            <input
              type="url"
              value={settings.instagram_url}
              onChange={(e) => setSettings({ ...settings, instagram_url: e.target.value })}
              disabled={!settings.instagram_enabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="https://instagram.com/yourhandle"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-md font-medium"
        >
          {saving ? 'Saving...' : 'Save Publication Settings'}
        </button>
      </div>
    </div>
  )
}

function Users() {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">User Management</h3>

      <div className="text-gray-600 mb-4">
        User access is managed through Google OAuth. All users with valid Google accounts
        can access the system. Role-based permissions will be added in future versions.
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium mb-2">Current Access:</h4>
        <ul className="space-y-1 text-sm text-gray-600">
          <li>• All team members can review and modify newsletters</li>
          <li>• Authentication handled via Google OAuth</li>
          <li>• User activity is logged for audit purposes</li>
        </ul>
      </div>
    </div>
  )
}

// AI Apps Settings Component
function AIAppsSettings() {
  const [settings, setSettings] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/ai-apps')
      const data = await response.json()

      // Convert to flat object for easier editing
      const flatSettings: any = {}
      Object.entries(data.settings).forEach(([key, val]: [string, any]) => {
        flatSettings[key] = parseInt(val.value) || 0
      })
      setSettings(flatSettings)
    } catch (error) {
      console.error('Failed to fetch AI app settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setMessage('')

      const response = await fetch('/api/settings/ai-apps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      })

      if (response.ok) {
        setMessage('Settings saved successfully')
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage('Failed to save settings')
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      setMessage('Error saving settings')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (key: string, value: number) => {
    setSettings({ ...settings, [key]: value })
  }

  if (loading) {
    return <div className="text-gray-600">Loading...</div>
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">AI Applications Selection Settings</h2>

      <p className="text-gray-600 mb-6">
        Configure how AI applications are selected for each newsletter issue.
        Affiliate apps take priority, followed by non-affiliate apps with rotation.
      </p>

      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.includes('success') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message}
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Total Apps Per Newsletter
          </label>
          <input
            type="number"
            min="1"
            max="20"
            value={settings.ai_apps_per_newsletter || 6}
            onChange={(e) => handleChange('ai_apps_per_newsletter', parseInt(e.target.value) || 6)}
            className="w-32 border border-gray-300 rounded px-3 py-2"
          />
          <p className="text-sm text-gray-500 mt-1">
            Total number of AI apps to include in each newsletter. Default: 6
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Maximum per Category
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={settings.ai_apps_max_per_category || 3}
            onChange={(e) => handleChange('ai_apps_max_per_category', parseInt(e.target.value) || 3)}
            className="w-32 border border-gray-300 rounded px-3 py-2"
          />
          <p className="text-sm text-gray-500 mt-1">
            Maximum number of apps from any single category per issue. Default: 3
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Affiliate App Cooldown (Days)
          </label>
          <input
            type="number"
            min="1"
            max="90"
            value={settings.affiliate_cooldown_days || 7}
            onChange={(e) => handleChange('affiliate_cooldown_days', parseInt(e.target.value) || 7)}
            className="w-32 border border-gray-300 rounded px-3 py-2"
          />
          <p className="text-sm text-gray-500 mt-1">
            Days after a newsletter is sent before an affiliate app can appear again. Default: 7 days
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-6">
        <h4 className="font-semibold text-blue-900 mb-2">How Selection Works:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li><strong>1. Affiliate apps first:</strong> All available affiliate apps (not in cooldown) are selected randomly until the total is met or no more affiliates are available</li>
          <li><strong>2. Non-affiliate apps second:</strong> If slots remain, non-affiliate apps are selected using global rotation (all must be used before any repeats)</li>
          <li><strong>3. Category maximum enforced:</strong> No single category can exceed the maximum per issue (applies to both affiliates and non-affiliates combined)</li>
          <li><strong>4. Cooldown starts on send:</strong> The affiliate cooldown timer begins when the newsletter is actually sent, not when selected</li>
        </ul>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  )
}

// Blocked Domains Settings Component
function BlockedDomainsSettings() {
  const [blockedDomains, setBlockedDomains] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<{
    domain: string
    failure_count: number
    most_common_error: string
    most_common_status: string
    sample_url?: string
  }[]>([])
  const [loading, setLoading] = useState(true)
  const [newDomain, setNewDomain] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch blocked domains and suggestions in parallel
      const [domainsRes, suggestionsRes] = await Promise.all([
        fetch('/api/settings/blocked-domains'),
        fetch('/api/settings/blocked-domains/suggestions')
      ])

      if (domainsRes.ok) {
        const domainsData = await domainsRes.json()
        setBlockedDomains(domainsData.domains || [])
      }

      if (suggestionsRes.ok) {
        const suggestionsData = await suggestionsRes.json()
        setSuggestions(suggestionsData.suggestions || [])
      }
    } catch (error) {
      console.error('Error fetching blocked domains:', error)
      showMessage('Failed to load blocked domains', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const showMessage = (msg: string, type: 'success' | 'error') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return

    try {
      const res = await fetch('/api/settings/blocked-domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain.trim() })
      })

      const data = await res.json()

      if (res.ok) {
        showMessage(data.message, 'success')
        setNewDomain('')
        fetchData()
      } else {
        showMessage(data.error || 'Failed to add domain', 'error')
      }
    } catch (error) {
      showMessage('Failed to add domain', 'error')
    }
  }

  const handleRemoveDomain = async (domain: string) => {
    try {
      const res = await fetch('/api/settings/blocked-domains', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      })

      const data = await res.json()

      if (res.ok) {
        showMessage(data.message, 'success')
        fetchData()
      } else {
        showMessage(data.error || 'Failed to remove domain', 'error')
      }
    } catch (error) {
      showMessage('Failed to remove domain', 'error')
    }
  }

  const handleBlockSuggestion = async (domain: string) => {
    try {
      const res = await fetch('/api/settings/blocked-domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      })

      const data = await res.json()

      if (res.ok) {
        showMessage(`Domain "${domain}" blocked`, 'success')
        fetchData()
      } else {
        showMessage(data.error || 'Failed to block domain', 'error')
      }
    } catch (error) {
      showMessage('Failed to block domain', 'error')
    }
  }

  const handleIgnoreSuggestion = async (domain: string) => {
    try {
      const res = await fetch('/api/settings/blocked-domains/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      })

      const data = await res.json()

      if (res.ok) {
        showMessage(`Domain "${domain}" ignored`, 'success')
        fetchData()
      } else {
        showMessage(data.error || 'Failed to ignore domain', 'error')
      }
    } catch (error) {
      showMessage('Failed to ignore domain', 'error')
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'blocked': return 'bg-red-100 text-red-800'
      case 'paywall': return 'bg-orange-100 text-orange-800'
      case 'login_required': return 'bg-yellow-100 text-yellow-800'
      case 'timeout': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-6"></div>
          <div className="space-y-3">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-md ${
          messageType === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* Blocked Domains Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Blocked Domains</h3>
        <p className="text-sm text-gray-600 mb-4">
          Posts from these domains will be completely skipped during RSS ingestion.
        </p>

        {/* Add Domain Form */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddDomain()}
            placeholder="Enter domain (e.g., example.com)"
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <button
            onClick={handleAddDomain}
            disabled={!newDomain.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm font-medium"
          >
            Add Domain
          </button>
        </div>

        {/* Blocked Domains List */}
        {blockedDomains.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No blocked domains</p>
        ) : (
          <div className="border rounded-lg divide-y">
            {blockedDomains.map((domain) => (
              <div key={domain} className="flex items-center justify-between px-4 py-3">
                <span className="font-mono text-sm">{domain}</span>
                <button
                  onClick={() => handleRemoveDomain(domain)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suggested Domains Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Suggested Domains to Block</h3>
        <p className="text-sm text-gray-600 mb-4">
          These domains have had extraction failures. Review and decide whether to block them.
        </p>

        {suggestions.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No suggestions - all domains are extracting successfully!</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Domain</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Failures</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sample URL</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {suggestions.map((suggestion) => (
                  <tr key={suggestion.domain}>
                    <td className="px-4 py-3 text-sm font-mono">{suggestion.domain}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{suggestion.failure_count}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(suggestion.most_common_status)}`}>
                        {suggestion.most_common_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title={suggestion.most_common_error}>
                      {suggestion.most_common_error}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {suggestion.sample_url ? (
                        <a
                          href={suggestion.sample_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline truncate block max-w-[200px]"
                          title={suggestion.sample_url}
                        >
                          View Article →
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleBlockSuggestion(suggestion.domain)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Block
                      </button>
                      <button
                        onClick={() => handleIgnoreSuggestion(suggestion.domain)}
                        className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                      >
                        Ignore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">How Domain Blocking Works:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li><strong>Blocked domains:</strong> Posts from these domains are completely skipped during RSS ingestion - they won't appear in your newsletter.</li>
          <li><strong>Suggested domains:</strong> Domains that have had extraction failures (HTTP 403, paywall, login required, etc.) are shown as suggestions.</li>
          <li><strong>Block vs Ignore:</strong> "Block" adds the domain to your blocked list. "Ignore" dismisses the suggestion without blocking.</li>
          <li><strong>Domain matching:</strong> Blocking "example.com" also blocks "www.example.com" and "news.example.com".</li>
        </ul>
      </div>
    </div>
  )
}
