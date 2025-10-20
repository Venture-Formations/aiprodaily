'use client'

import { useEffect, useState } from 'react'
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
                { id: 'business', name: 'Business Settings' },
                { id: 'newsletter', name: 'Newsletter' },
                { id: 'email', name: 'Email' },
                { id: 'slack', name: 'Slack' },
                { id: 'ai-prompts', name: 'AI Prompts' },
                { id: 'ai-apps', name: 'AI Apps' },
                { id: 'rss', name: 'RSS Feeds' },
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
          {activeTab === 'slack' && <SlackSettings />}
          {activeTab === 'ai-prompts' && <AIPromptsSettings />}
          {activeTab === 'ai-apps' && <AIAppsSettings />}
          {activeTab === 'rss' && <RSSFeeds />}
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
      {/* Section Order Management */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900">Newsletter Section Order</h3>
            <p className="text-sm text-gray-600 mt-1">
              Drag sections to reorder them in the newsletter. Toggle sections on/off to control what appears.
            </p>
          </div>
          {sections.length < 6 && (
            <button
              onClick={runMigration}
              disabled={migrating}
              className={`ml-4 px-4 py-2 text-sm font-medium rounded-md border ${
                migrating
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              }`}
            >
              {migrating ? 'Adding Sections...' : 'Add Missing Sections'}
            </button>
          )}
        </div>

        {sections.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No newsletter sections found.</p>
            <p className="text-sm mt-1">Sections are created automatically when features are enabled.</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-3">
              <SortableContext
                items={sections.map(section => section.id)}
                strategy={verticalListSortingStrategy}
              >
                {sections
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((section) => (
                    <SortableSection
                      key={section.id}
                      section={section}
                      toggleSection={toggleSection}
                      saving={saving}
                      onEditName={handleEditName}
                    />
                  ))}
              </SortableContext>
            </div>
          </DndContext>
        )}

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-3">Newsletter Section Information</h4>
          <div className="text-sm text-blue-800 space-y-2">
            <div className="space-y-2 mb-3">
              <p><strong>Manage Your Newsletter Sections:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Drag & Drop:</strong> Reorder sections to change how they appear in your newsletter</li>
                <li><strong>Toggle On/Off:</strong> Use the switch to activate or deactivate sections</li>
                <li><strong>Edit Names:</strong> Click "Edit name" to customize section titles for your audience</li>
                <li><strong>Custom Content:</strong> Each section pulls dynamic content based on its type</li>
              </ul>
            </div>
            <div className="border-t border-blue-300 pt-2 space-y-1">
              <div>📋 <strong>Display Order:</strong> Sections appear in newsletters in the order shown above</div>
              <div>🔄 <strong>Status:</strong> Inactive sections are hidden but can be reactivated anytime</div>
              <div>✏️ <strong>Customization:</strong> Section names can be customized to match your newsletter's voice</div>
              <div>⚠️ <strong>Missing sections?</strong> Use "Add Missing Sections" button to enable additional features</div>
            </div>
          </div>
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
  )
}

function SystemStatus() {
  const [status, setStatus] = useState<any>(null)
  const [scheduleDisplay, setScheduleDisplay] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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
    try {
      const response = await fetch('/api/settings/schedule-display')
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
              <div className="font-medium">Campaign Creation</div>
              <div className="text-sm text-gray-600">
                Daily at {scheduleDisplay?.campaignCreation || '20:50'} CT
              </div>
            </div>
            <span className={`text-sm ${scheduleDisplay?.reviewEnabled ? 'text-green-600' : 'text-gray-500'}`}>
              {scheduleDisplay?.reviewEnabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <div>
              <div className="font-medium">Final Newsletter Send</div>
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
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Settings</h3>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="font-medium">Slack Notifications</div>
            <div className="text-sm text-gray-600">Receive alerts for system errors and status updates</div>
          </div>
          <span className="text-green-600 text-sm">
            {process.env.SLACK_WEBHOOK_URL ? 'Configured' : 'Not Configured'}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <div>
            <div className="font-medium">Email Notifications</div>
            <div className="text-sm text-gray-600">Newsletter review and delivery confirmations</div>
          </div>
          <span className="text-green-600 text-sm">Active</span>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Notification Types:</h4>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• RSS processing completion/failure</li>
            <li>• Email campaign delivery status</li>
            <li>• System health alerts</li>
            <li>• Error monitoring</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function EmailSettings() {
  const [settings, setSettings] = useState({
    // MailerLite Settings
    reviewGroupId: '',
    mainGroupId: '',
    fromEmail: 'scoop@stcscoop.com',
    senderName: 'St. Cloud Scoop',

    // Review Schedule Settings (Central Time)
    reviewScheduleEnabled: true,
    rssProcessingTime: '20:30',  // 8:30 PM
    campaignCreationTime: '20:50',  // 8:50 PM
    scheduledSendTime: '21:00',  // 9:00 PM

    // Daily Newsletter Settings (Central Time)
    dailyScheduleEnabled: false,
    dailyCampaignCreationTime: '04:30',  // 4:30 AM
    dailyScheduledSendTime: '04:55'  // 4:55 AM
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [maxTopArticles, setMaxTopArticles] = useState<number>(3)
  const [maxBottomArticles, setMaxBottomArticles] = useState<number>(3)
  const [savingMaxArticles, setSavingMaxArticles] = useState(false)
  const [primaryLookbackHours, setPrimaryLookbackHours] = useState<number>(72)
  const [secondaryLookbackHours, setSecondaryLookbackHours] = useState<number>(36)
  const [savingLookbackHours, setSavingLookbackHours] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    loadSettings()
    loadMaxArticles()
    loadSettings()
    loadMaxArticles()
    loadLookbackHours()

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
          dailyScheduleEnabled: emailSettings.dailyScheduleEnabled === 'true'
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

    console.log('FRONTEND: Saving email settings:', settings)

    try {
      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
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

  const handleChange = (field: string, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const loadMaxArticles = async () => {
    try {
      const response = await fetch('/api/settings/email')
      if (response.ok) {
        const data = await response.json()
        const maxTopSetting = data.settings.find((s: any) => s.key === 'max_top_articles')
        const maxBottomSetting = data.settings.find((s: any) => s.key === 'max_bottom_articles')

        if (maxTopSetting) {
          setMaxTopArticles(parseInt(maxTopSetting.value))
        }
        if (maxBottomSetting) {
          setMaxBottomArticles(parseInt(maxBottomSetting.value))
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

  return (

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
  }
      {/* MailerLite Configuration */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">MailerLite Configuration</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Review Group ID
            </label>
            <input
              type="text"
              value={settings.reviewGroupId}
              onChange={(e) => handleChange('reviewGroupId', e.target.value)}
              placeholder="Group ID for review emails"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Main Group ID
            </label>
            <input
              type="text"
              value={settings.mainGroupId}
              onChange={(e) => handleChange('mainGroupId', e.target.value)}
              placeholder="Group ID for main newsletter"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

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

      {/* Automated Newsletter Review Schedule */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Automated Newsletter Review Schedule</h3>
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
              RSS Processing Time
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
            <p className="text-xs text-gray-500 mt-1">Daily RSS feed processing and article rating (5-minute increments)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Campaign Creation Time
            </label>
            <div className="flex space-x-2 items-center">
              <select
                value={(() => {
                  const hour24 = parseInt(settings.campaignCreationTime.split(':')[0])
                  return hour24 === 0 ? '12' : hour24 > 12 ? (hour24 - 12).toString() : hour24.toString()
                })()}
                onChange={(e) => {
                  const minutes = settings.campaignCreationTime.split(':')[1] || '00'
                  const hour12 = parseInt(e.target.value)
                  const currentHour24 = parseInt(settings.campaignCreationTime.split(':')[0])
                  const isAM = currentHour24 < 12
                  let hour24
                  if (hour12 === 12) {
                    hour24 = isAM ? 0 : 12
                  } else {
                    hour24 = isAM ? hour12 : hour12 + 12
                  }
                  handleChange('campaignCreationTime', `${hour24.toString().padStart(2, '0')}:${minutes}`)
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
                value={settings.campaignCreationTime.split(':')[1] || '00'}
                onChange={(e) => {
                  const hour24 = parseInt(settings.campaignCreationTime.split(':')[0])
                  handleChange('campaignCreationTime', `${hour24.toString().padStart(2, '0')}:${e.target.value}`)
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
                value={parseInt(settings.campaignCreationTime.split(':')[0]) < 12 ? 'AM' : 'PM'}
                onChange={(e) => {
                  const minutes = settings.campaignCreationTime.split(':')[1] || '00'
                  const currentHour24 = parseInt(settings.campaignCreationTime.split(':')[0])
                  const currentHour12 = currentHour24 === 0 ? 12 : currentHour24 > 12 ? currentHour24 - 12 : currentHour24
                  let newHour24
                  if (e.target.value === 'AM') {
                    newHour24 = currentHour12 === 12 ? 0 : currentHour12
                  } else {
                    newHour24 = currentHour12 === 12 ? 12 : currentHour12 + 12
                  }
                  handleChange('campaignCreationTime', `${newHour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.reviewScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">Newsletter campaign setup and review (5-minute increments)</p>
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
            <div>1. <strong>{settings.rssProcessingTime}</strong> - Create tomorrow's campaign, process RSS feeds, and generate AI subject line</div>
            <div>2. <strong>{settings.campaignCreationTime}</strong> - Create review campaign and schedule for delivery</div>
            <div>3. <strong>{settings.scheduledSendTime}</strong> - MailerLite sends review to review group only</div>
          </div>
        </div>
      </div>

      {/* Automated Daily Newsletter Schedule */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Automated Daily Newsletter Schedule</h3>
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
                  const hour24 = parseInt(settings.dailyCampaignCreationTime.split(':')[0])
                  return hour24 === 0 ? '12' : hour24 > 12 ? (hour24 - 12).toString() : hour24.toString()
                })()}
                onChange={(e) => {
                  const minutes = settings.dailyCampaignCreationTime.split(':')[1] || '00'
                  const hour12 = parseInt(e.target.value)
                  const currentHour24 = parseInt(settings.dailyCampaignCreationTime.split(':')[0])
                  const isAM = currentHour24 < 12
                  let hour24
                  if (hour12 === 12) {
                    hour24 = isAM ? 0 : 12
                  } else {
                    hour24 = isAM ? hour12 : hour12 + 12
                  }
                  handleChange('dailyCampaignCreationTime', `${hour24.toString().padStart(2, '0')}:${minutes}`)
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
                value={settings.dailyCampaignCreationTime.split(':')[1] || '00'}
                onChange={(e) => {
                  const hour24 = parseInt(settings.dailyCampaignCreationTime.split(':')[0])
                  handleChange('dailyCampaignCreationTime', `${hour24.toString().padStart(2, '0')}:${e.target.value}`)
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
                value={parseInt(settings.dailyCampaignCreationTime.split(':')[0]) < 12 ? 'AM' : 'PM'}
                onChange={(e) => {
                  const minutes = settings.dailyCampaignCreationTime.split(':')[1] || '00'
                  const currentHour24 = parseInt(settings.dailyCampaignCreationTime.split(':')[0])
                  const currentHour12 = currentHour24 === 0 ? 12 : currentHour24 > 12 ? currentHour24 - 12 : currentHour24
                  let newHour24
                  if (e.target.value === 'AM') {
                    newHour24 = currentHour12 === 12 ? 0 : currentHour12
                  } else {
                    newHour24 = currentHour12 === 12 ? 12 : currentHour12 + 12
                  }
                  handleChange('dailyCampaignCreationTime', `${newHour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.dailyScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">Final newsletter campaign creation with any review changes (5-minute increments)</p>
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
            <p className="text-xs text-gray-500 mt-1">Final newsletter delivery to main subscriber group (5-minute increments)</p>
          </div>
        </div>

        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-medium text-green-900 mb-2">Daily Newsletter Workflow</h4>
          <div className="text-sm text-green-800 space-y-1">
            <div>1. <strong>{settings.dailyCampaignCreationTime}</strong> - Create final newsletter with any changes made during review</div>
            <div>2. <strong>{settings.dailyScheduledSendTime}</strong> - Send final newsletter to main subscriber group</div>
          </div>
        </div>
      </div>

      {/* Article Limit Settings */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Article Limit Settings</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure the maximum number of articles that can be selected for the Primary Articles and Secondary Articles sections in each newsletter campaign.
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
          </div>
            <strong>Current configuration:</strong> Primary Articles: {maxTopArticles}, Secondary Articles: {maxBottomArticles}
          </p>
          <p className="text-xs text-blue-700 mt-2">
            These limits control how many articles can be selected during RSS processing and on the campaign detail page.
          </p>
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

function AIPromptsSettings() {
  const [prompts, setPrompts] = useState<any[]>([])
  const [grouped, setGrouped] = useState<Record<string, any[]>>({})
  const [criteria, setCriteria] = useState<any[]>([])
  const [enabledCount, setEnabledCount] = useState(3)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null)
  const [editingPrompt, setEditingPrompt] = useState<{key: string, value: string} | null>(null)
  const [editingWeight, setEditingWeight] = useState<{key: string, value: string} | null>(null)
  const [editingName, setEditingName] = useState<{number: number, value: string} | null>(null)

  useEffect(() => {
    loadPrompts()
    loadCriteria()
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
    try {
      const response = await fetch('/api/settings/criteria')
      if (response.ok) {
        const data = await response.json()
        setCriteria(data.criteria || [])
        setEnabledCount(data.enabledCount || 3)
      }
    } catch (error) {
      console.error('Failed to load criteria:', error)
    }
  }

  const handleEdit = (prompt: any) => {
    setEditingPrompt({ key: prompt.key, value: prompt.value })
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

  const handleTestPrompt = (key: string) => {
    // Map prompt keys to their test endpoint type parameter
    const promptTypeMap: Record<string, string> = {
      'ai_prompt_content_evaluator': 'contentEvaluator',
      'ai_prompt_newsletter_writer': 'newsletterWriter',
      'ai_prompt_subject_line': 'subjectLineGenerator',
      'ai_prompt_event_summary': 'eventSummarizer',
      'ai_prompt_road_work': 'roadWorkGenerator',
      'ai_prompt_image_analyzer': 'imageAnalyzer'
    }

    const testType = promptTypeMap[key]
    if (!testType) {
      alert('Test not available for this prompt type')
      return
    }

    // Open test endpoint in new tab
    const testUrl = `/api/debug/test-ai-prompts?type=${testType}`
    window.open(testUrl, '_blank')
  }

  const handleWeightEdit = (prompt: any) => {
    setEditingWeight({ key: prompt.key, value: prompt.weight || '1.0' })
  }

  const handleWeightCancel = () => {
    setEditingWeight(null)
  }

  const handleWeightSave = async (key: string) => {
    if (!editingWeight || editingWeight.key !== key) return

    // Match both primary and secondary criteria
    const criteriaMatch = key.match(/ai_prompt_(?:secondary_)?criteria_(\d+)/)
    if (!criteriaMatch) return

    const criteriaNumber = criteriaMatch[1]
    setSaving(key)
    setMessage('')

    try {
      const response = await fetch('/api/settings/criteria-weights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criteriaNumber,
          weight: parseFloat(editingWeight.value)
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

  const handleNameEdit = (criteriaNumber: number, currentName: string) => {
    setEditingName({ number: criteriaNumber, value: currentName })
  }

  const handleNameCancel = () => {
    setEditingName(null)
  }

  const handleNameSave = async (criteriaNumber: number) => {
    if (!editingName || editingName.number !== criteriaNumber) return

    setSaving(`criteria_${criteriaNumber}_name`)
    setMessage('')

    try {
      const response = await fetch('/api/settings/criteria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_name',
          criteriaNumber,
          name: editingName.value
        })
      })

      if (response.ok) {
        setMessage('Criteria name updated successfully!')
        setEditingName(null)
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

  const handleAddCriteria = async () => {
    if (enabledCount >= 5) {
      setMessage('Maximum of 5 criteria reached')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setSaving('add_criteria')
    setMessage('')

    try {
      const response = await fetch('/api/settings/criteria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_enabled_count',
          enabledCount: enabledCount + 1
        })
      })

      if (response.ok) {
        setMessage(`Enabled ${enabledCount + 1} criteria`)
        await loadCriteria()
        await loadPrompts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to add criteria')
      }
    } catch (error) {
      setMessage('Error: Failed to add criteria')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  const handleRemoveCriteria = async () => {
    if (enabledCount <= 1) {
      setMessage('At least 1 criteria must remain enabled')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    if (!confirm(`Remove criteria ${enabledCount}? This will disable it from scoring.`)) {
      return
    }

    setSaving('remove_criteria')
    setMessage('')

    try {
      const response = await fetch('/api/settings/criteria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_enabled_count',
          enabledCount: enabledCount - 1
        })
      })

      if (response.ok) {
        setMessage(`Reduced to ${enabledCount - 1} criteria`)
        await loadCriteria()
        await loadPrompts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to remove criteria')
      }
    } catch (error) {
      setMessage('Error: Failed to remove criteria')
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
  const otherPrompts = prompts.filter(p =>
    !p.key.startsWith('ai_prompt_criteria_') &&
    !p.key.startsWith('ai_prompt_secondary_criteria_') &&
    !p.key.startsWith('ai_prompt_secondary_')
  )
  const secondaryOtherPrompts = prompts.filter(p =>
    p.key.startsWith('ai_prompt_secondary_') &&
    !p.key.startsWith('ai_prompt_secondary_criteria_')
  )

  type PromptType = typeof prompts[0]
  const otherGrouped = otherPrompts.reduce((acc, prompt) => {
    if (!acc[prompt.category]) {
      acc[prompt.category] = []
    }
    acc[prompt.category].push(prompt)
    return acc
  }, {} as Record<string, PromptType[]>)

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
              <h3 className="text-lg font-medium text-gray-900">Primary Evaluation Criteria</h3>
              <p className="text-sm text-gray-600 mt-1">
                Configure the criteria used to evaluate primary (top) articles. {enabledCount} of 5 criteria enabled.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleAddCriteria}
                disabled={enabledCount >= 5 || saving === 'add_criteria'}
                className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving === 'add_criteria' ? 'Adding...' : 'Add Criteria'}
              </button>
              <button
                onClick={handleRemoveCriteria}
                disabled={enabledCount <= 1 || saving === 'remove_criteria'}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving === 'remove_criteria' ? 'Removing...' : 'Remove Criteria'}
              </button>
            </div>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {criteria.filter(c => c.enabled).map((criterion) => {
            const promptKey = `ai_prompt_criteria_${criterion.number}`
            const prompt = criteriaPrompts.find(p => p.key === promptKey)
            const isExpanded = expandedPrompt === promptKey
            const isEditing = editingPrompt?.key === promptKey
            const isSaving = saving === promptKey
            const isEditingWeight = editingWeight?.key === promptKey
            const isEditingCriteriaName = editingName?.number === criterion.number

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
                            value={editingName?.value || ''}
                            onChange={(e) => setEditingName({ number: criterion.number, value: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm flex-1 max-w-xs"
                            placeholder="Enter criteria name"
                          />
                          <button
                            onClick={() => handleNameSave(criterion.number)}
                            disabled={saving === `criteria_${criterion.number}_name`}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {saving === `criteria_${criterion.number}_name` ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleNameCancel}
                            disabled={saving === `criteria_${criterion.number}_name`}
                            className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <h4 className="text-base font-medium text-gray-900">{criterion.name}</h4>
                          <button
                            onClick={() => handleNameEdit(criterion.number, criterion.name)}
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
                        {isEditing ? editingPrompt?.value.length || 0 : prompt.value.length} characters
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
                        <div className="mt-3 flex items-center justify-end space-x-3">
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
                      </>
                    ) : (
                      <>
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                          {prompt.value}
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
                              onClick={() => handleTestPrompt(promptKey)}
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

      {/* Secondary Evaluation Criteria Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Secondary Evaluation Criteria</h3>
              <p className="text-sm text-gray-600 mt-1">
                Configure the criteria used to evaluate secondary (bottom) articles. {enabledCount} of 5 criteria enabled.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleAddCriteria}
                disabled={enabledCount >= 5 || saving === 'add_criteria'}
                className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving === 'add_criteria' ? 'Adding...' : 'Add Criteria'}
              </button>
              <button
                onClick={handleRemoveCriteria}
                disabled={enabledCount <= 1 || saving === 'remove_criteria'}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving === 'remove_criteria' ? 'Removing...' : 'Remove Criteria'}
              </button>
            </div>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {criteria.filter(c => c.enabled).map((criterion) => {
            const promptKey = `ai_prompt_secondary_criteria_${criterion.number}`
            const prompt = secondaryCriteriaPrompts.find(p => p.key === promptKey)
            const isExpanded = expandedPrompt === promptKey
            const isEditing = editingPrompt?.key === promptKey
            const isSaving = saving === promptKey
            const isEditingWeight = editingWeight?.key === promptKey
            const isEditingCriteriaName = editingName?.number === criterion.number

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
                            value={editingName?.value || ''}
                            onChange={(e) => setEditingName({ number: criterion.number, value: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm flex-1 max-w-xs"
                            placeholder="Enter criteria name"
                          />
                          <button
                            onClick={() => handleNameSave(criterion.number)}
                            disabled={saving === `criteria_${criterion.number}_name`}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {saving === `criteria_${criterion.number}_name` ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleNameCancel}
                            disabled={saving === `criteria_${criterion.number}_name`}
                            className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <h4 className="text-base font-medium text-gray-900">{criterion.name}</h4>
                          <button
                            onClick={() => handleNameEdit(criterion.number, criterion.name)}
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
                        {isEditing ? editingPrompt?.value.length || 0 : prompt.value.length} characters
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
                        <div className="mt-3 flex items-center justify-end space-x-3">
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
                      </>
                    ) : (
                      <>
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                          {prompt.value}
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
                              onClick={() => handleTestPrompt(promptKey)}
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

      {/* Secondary Other Prompts */}
      {secondaryOtherPrompts.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Secondary Article Prompts</h3>
            <p className="text-sm text-gray-600 mt-1">
              Additional AI prompts for secondary article processing (content evaluator, article writer, etc.)
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
                          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                            {prompt.value}
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
                      <div className="mb-2 flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">
                          Prompt Content
                        </label>
                        <span className="text-xs text-gray-500">
                          {isEditing ? editingPrompt?.value.length || 0 : prompt.value.length} characters
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
                          <div className="mt-3 flex items-center justify-end space-x-3">
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
                          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                            {prompt.value}
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
      ))}

      {/* Help Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-medium text-blue-900 mb-3">Prompt Placeholders</h4>
        <div className="text-sm text-blue-800 space-y-2">
          <p><code className="bg-blue-100 px-2 py-0.5 rounded">{'{'}title{'}'}</code> - Article/event title</p>
          <p><code className="bg-blue-100 px-2 py-0.5 rounded">{'{'}description{'}'}</code> - Article/event description</p>
          <p><code className="bg-blue-100 px-2 py-0.5 rounded">{'{'}content{'}'}</code> - Full article content</p>
          <p><code className="bg-blue-100 px-2 py-0.5 rounded">{'{'}date{'}'}</code> - Campaign date</p>
          <p><code className="bg-blue-100 px-2 py-0.5 rounded">{'{'}headline{'}'}</code> - Newsletter article headline</p>
          <p className="mt-3 text-xs text-blue-700">
            ⚠️ <strong>Important:</strong> Changes take effect immediately. Test prompts carefully before saving.
          </p>
        </div>
      </div>
    </div>
  )
}

function SlackSettings() {
  const [settings, setSettings] = useState({
    campaignStatusUpdates: true,
    systemErrors: true,
    rssProcessingUpdates: true,
    rssProcessingIncomplete: true,
    lowArticleCount: true,
    scheduledSendFailure: true,
    scheduledSendTiming: true,
    userActions: false,
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
      console.error('Failed to load Slack settings:', error)
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
        setMessage('Slack settings saved successfully!')
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

  const handleToggle = (field: string, value: boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const notificationTypes = [
    {
      id: 'campaignStatusUpdates',
      name: 'Campaign Status Updates',
      description: 'Notifications when campaigns require attention (Changes Made or Failed status)',
      examples: [
        'Campaign marked as "Changes Made" - review required',
        'Campaign status changed to "Failed" due to processing error',
        'Campaign requires manual intervention before sending'
      ]
    },
    {
      id: 'systemErrors',
      name: 'System Errors',
      description: 'Critical system errors and failures',
      examples: [
        'Database connection failures',
        'API authentication errors',
        'Critical application crashes'
      ]
    },
    {
      id: 'rssProcessingUpdates',
      name: 'RSS Processing Updates',
      description: 'Completion and success notifications for RSS feed processing',
      examples: [
        'RSS processing completed with 8 articles generated',
        'Subject line generated successfully',
        'Archive preserved 12 articles before processing'
      ]
    },
    {
      id: 'rssProcessingIncomplete',
      name: 'RSS Processing Incomplete',
      description: 'Alerts when RSS processing fails partway through',
      examples: [
        'RSS processing stopped at AI article generation due to OpenAI timeout',
        'Feed processing completed but article creation failed',
        'Archive succeeded but RSS feed parsing crashed'
      ]
    },
    {
      id: 'lowArticleCount',
      name: 'Low Article Count (≤6 articles)',
      description: 'Warnings when newsletter may not have enough content',
      examples: [
        'Only 3 articles generated for tomorrow\'s newsletter',
        'RSS feeds produced 6 articles - consider manual review',
        'Insufficient content detected for quality delivery'
      ]
    },
    {
      id: 'scheduledSendFailure',
      name: 'Scheduled Send Failures',
      description: 'Alerts when scheduled sends trigger but fail to deliver',
      examples: [
        'Final send scheduled but MailerLite API authentication failed',
        'Campaign ready but delivery blocked by MailerLite configuration error',
        'Send triggered at 9 PM but no email actually delivered'
      ]
    },
    {
      id: 'scheduledSendTiming',
      name: 'Scheduled Send Timing Issues',
      description: 'Warnings about scheduling configuration problems',
      examples: [
        'Campaign marked "ready_to_send" but cron says it\'s not time to send',
        'Multiple campaigns waiting but send window appears misconfigured',
        'Scheduling logic conflict detected'
      ]
    },
    {
      id: 'emailDeliveryUpdates',
      name: 'Email Delivery Updates',
      description: 'MailerLite campaign delivery confirmations and stats',
      examples: [
        'Review campaign sent to review group successfully',
        'Final newsletter delivered to 1,247 subscribers',
        'MailerLite campaign creation completed'
      ]
    },
    {
      id: 'healthCheckAlerts',
      name: 'Health Check Alerts',
      description: 'System health monitoring alerts and warnings',
      examples: [
        'Database connection degraded',
        'MailerLite API responding slowly',
        'OpenAI service health check failed'
      ]
    },
    {
      id: 'userActions',
      name: 'User Actions',
      description: 'User login, campaign modifications, and administrative actions',
      examples: [
        'Admin user logged in from new device',
        'Campaign manually edited and saved',
        'User changed email scheduling settings'
      ]
    }
  ]

  return (
    <div className="space-y-6">
      {/* Notification Types */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Types</h3>
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
        const maxTopSetting = data.settings.find((s: any) => s.key === 'max_top_articles')
        const maxBottomSetting = data.settings.find((s: any) => s.key === 'max_bottom_articles')

        if (maxTopSetting) {
          setMaxTopArticles(parseInt(maxTopSetting.value))
        }
        if (maxBottomSetting) {
          setMaxBottomArticles(parseInt(maxBottomSetting.value))
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

      {/* Ads Per Newsletter Configuration */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Newsletter Ad Settings</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure how many advertisements appear in each newsletter. Total newsletter items (ads + articles) = 5.
        </p>

        <div className="flex items-center gap-4">
          <label className="font-medium text-gray-700">Ads per newsletter:</label>
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
          Configure the maximum number of articles that can be selected for the Primary Articles and Secondary Articles sections in each newsletter campaign.
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
            These limits control how many articles can be selected during RSS processing and on the campaign detail page.
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
    header_image_url: '',
    logo_url: '',
    contact_email: '',
    website_url: '',
    heading_font: 'Arial',
    body_font: 'Arial',
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
  const [message, setMessage] = useState('')

  const fontOptions = [
    'Arial',
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

  const handleImageUpload = async (file: File, type: 'header' | 'logo') => {
    const setUploading = type === 'header' ? setUploadingHeader : setUploadingLogo
    setUploading(true)
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
      const fieldName = type === 'header' ? 'header_image_url' : 'logo_url'
      setSettings(prev => ({ ...prev, [fieldName]: data.url }))
      setMessage(data.message || `${type === 'header' ? 'Header' : 'Logo'} image uploaded successfully!`)

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
              Newsletter Name
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
            Header Image
          </label>
          {settings.header_image_url && (
            <div className="mb-2 p-4 rounded border" style={{ backgroundColor: settings.primary_color }}>
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
          {saving ? 'Saving...' : 'Save Business Settings'}
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
        setMessage('✓ Settings saved successfully')
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage('✗ Failed to save settings')
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      setMessage('✗ Error saving settings')
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

  const categories = [
    { key: 'ai_apps_payroll_count', label: 'Payroll', color: 'bg-blue-100 text-blue-800' },
    { key: 'ai_apps_hr_count', label: 'HR', color: 'bg-green-100 text-green-800' },
    { key: 'ai_apps_accounting_count', label: 'Accounting System', color: 'bg-purple-100 text-purple-800' },
    { key: 'ai_apps_finance_count', label: 'Finance', color: 'bg-orange-100 text-orange-800' },
    { key: 'ai_apps_productivity_count', label: 'Productivity', color: 'bg-pink-100 text-pink-800' },
    { key: 'ai_apps_client_mgmt_count', label: 'Client Management', color: 'bg-indigo-100 text-indigo-800' },
    { key: 'ai_apps_banking_count', label: 'Banking', color: 'bg-yellow-100 text-yellow-800' }
  ]

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">AI Applications Selection Settings</h2>

      <p className="text-gray-600 mb-6">
        Configure how many apps from each category are selected for each newsletter campaign.
        Set count to 0 for "filler" categories (used to fill remaining slots).
      </p>

      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.startsWith('✓') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message}
        </div>
      )}

      <div className="mb-6">
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
        <p className="text-sm text-gray-500 mt-1">Default: 6 apps</p>
      </div>

      <div className="space-y-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Category Counts</h3>
        {categories.map(({ key, label, color }) => (
          <div key={key} className="flex items-center justify-between">
            <div className="flex items-center">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${color} mr-3`}>
                {label}
              </span>
              <p className="text-sm text-gray-600">
                {settings[key] === 0 ? 'Filler category' : `${settings[key]} per newsletter`}
              </p>
            </div>
            <input
              type="number"
              min="0"
              max="10"
              value={settings[key] || 0}
              onChange={(e) => handleChange(key, parseInt(e.target.value) || 0)}
              className="w-20 border border-gray-300 rounded px-3 py-2"
            />
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Apps are selected automatically when creating a new campaign</li>
          <li>• Categories with count &gt; 0 are "must-have" (always included)</li>
          <li>• Categories with count = 0 are "fillers" (used to reach total apps)</li>
          <li>• Apps rotate: each app is used before cycling through again</li>
          <li>• Within each category, unused apps are prioritized</li>
          <li>• If a category runs out of apps, other categories can provide more to reach the total</li>
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
