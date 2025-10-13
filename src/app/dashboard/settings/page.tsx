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
                { id: 'newsletter', name: 'Newsletter' },
                { id: 'email', name: 'Email' },
                { id: 'public-events', name: 'Public Events' },
                { id: 'ads', name: 'Ads' },
                { id: 'slack', name: 'Slack' },
                { id: 'ai-prompts', name: 'AI Prompts' },
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
          {activeTab === 'newsletter' && <NewsletterSettings />}
          {activeTab === 'email' && <EmailSettings />}
          {activeTab === 'public-events' && <PublicEventsSettings />}
          {activeTab === 'ads' && <AdsSettings />}
          {activeTab === 'slack' && <SlackSettings />}
          {activeTab === 'ai-prompts' && <AIPromptsSettings />}
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
  saving
}: {
  section: NewsletterSection
  toggleSection: (id: string, isActive: boolean) => void
  saving: boolean
}) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-4 bg-white border rounded-lg ${
        isDragging ? 'shadow-lg' : 'shadow-sm'
      } ${section.is_active ? 'border-blue-300' : 'border-gray-200'}`}
    >
      <div className="flex items-center space-x-3">
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
        <div>
          <h4 className="font-medium text-gray-900">{section.name}</h4>
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
                    />
                  ))}
              </SortableContext>
            </div>
          </DndContext>
        )}

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-3">Newsletter Section Information</h4>
          <div className="text-sm text-blue-800 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
              <div>• <strong>The Local Scoop</strong> - Main news articles from RSS feeds</div>
              <div>• <strong>Local Events</strong> - Community events and activities (3-day span)</div>
              <div>• <strong>Local Weather</strong> - 3-day weather forecast with image charts</div>
              <div>• <strong>Yesterday's Wordle</strong> - Previous day's Wordle word with definition</div>
              <div>• <strong>Minnesota Getaways</strong> - Featured VRBO vacation rental properties</div>
              <div>• <strong>Dining Deals</strong> - Restaurant specials based on day of the week</div>
            </div>
            <div className="border-t border-blue-300 pt-2">
              <div>📋 <strong>Management:</strong> Sections appear in newsletters in the order shown above</div>
              <div>🔄 <strong>Status:</strong> Inactive sections are hidden but can be reactivated anytime</div>
              <div>⚠️ <strong>Missing sections?</strong> Run database migration to add all supported sections</div>
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
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">RSS Feed Configuration</h3>
        <button className="bg-brand-primary hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium">
          Add Feed
        </button>
      </div>

      <div className="text-gray-600 mb-4">
        RSS feed management is currently handled through the database.
        Future versions will include a web interface for managing feeds.
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium mb-2">Current Feeds:</h4>
        <ul className="space-y-1 text-sm">
          <li>• St. Cloud Local News (Active)</li>
          <li className="text-gray-500">• Add more feeds through database or API</li>
        </ul>
      </div>
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

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/email')
      if (response.ok) {
        const data = await response.json()
        // Convert string boolean values back to actual booleans
        const processedData = {
          ...data,
          reviewScheduleEnabled: data.reviewScheduleEnabled === 'true',
          dailyScheduleEnabled: data.dailyScheduleEnabled === 'true'
        }
        setSettings(prev => ({ ...prev, ...processedData }))
      }
    } catch (error) {
      console.error('Failed to load email settings:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/email', {
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

  const handleChange = (field: string, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-6">
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null)
  const [editingPrompt, setEditingPrompt] = useState<{key: string, value: string} | null>(null)

  useEffect(() => {
    loadPrompts()
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
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

      {/* Prompts by Category */}
      {Object.entries(grouped).map(([category, categoryPrompts]) => (
        <div key={category} className="bg-white shadow rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">{category}</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {categoryPrompts.map((prompt) => {
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

  useEffect(() => {
    loadTiers()
    loadAdsPerNewsletter()
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