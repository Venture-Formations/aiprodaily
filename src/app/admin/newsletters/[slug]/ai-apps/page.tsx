'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AIApplication } from '@/types/database'

export default function AIAppsManagementPage() {
  const params = useParams()
  const slug = params.slug as string

  const [apps, setApps] = useState<AIApplication[]>([])
  const [newsletter, setNewsletter] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingApp, setEditingApp] = useState<AIApplication | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    app_name: '',
    tagline: '',
    description: '',
    category: '',
    app_url: '',
    logo_url: '',
    screenshot_url: '',
    pricing: 'Free',
    is_featured: false,
    is_paid_placement: false
  })

  useEffect(() => {
    loadData()
  }, [slug])

  async function loadData() {
    try {
      // Load newsletter
      const nlRes = await fetch(`/api/newsletters/by-subdomain?subdomain=${slug}`)
      const nlData = await nlRes.json()
      if (nlData.success) {
        setNewsletter(nlData.newsletter)

        // Load apps
        const appsRes = await fetch(`/api/ai-apps?newsletter_id=${nlData.newsletter.id}`)
        const appsData = await appsRes.json()
        if (appsData.success) {
          setApps(appsData.apps)
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!newsletter) return

    try {
      const url = editingApp ? `/api/ai-apps/${editingApp.id}` : '/api/ai-apps'
      const method = editingApp ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          newsletter_id: newsletter.id
        })
      })

      const data = await response.json()

      if (data.success) {
        alert(editingApp ? 'App updated!' : 'App created!')
        setShowCreateForm(false)
        setEditingApp(null)
        resetForm()
        loadData()
      } else {
        alert('Error: ' + data.error)
      }
    } catch (error) {
      console.error('Error saving app:', error)
      alert('Failed to save app')
    }
  }

  async function handleDelete(appId: string) {
    if (!confirm('Are you sure you want to delete this app?')) return

    try {
      const response = await fetch(`/api/ai-apps/${appId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        alert('App deleted!')
        loadData()
      } else {
        alert('Error: ' + data.error)
      }
    } catch (error) {
      console.error('Error deleting app:', error)
      alert('Failed to delete app')
    }
  }

  function startEdit(app: AIApplication) {
    setEditingApp(app)
    setFormData({
      app_name: app.app_name,
      tagline: app.tagline || '',
      description: app.description,
      category: app.category || '',
      app_url: app.app_url,
      logo_url: app.logo_url || '',
      screenshot_url: app.screenshot_url || '',
      pricing: app.pricing || 'Free',
      is_featured: app.is_featured,
      is_paid_placement: app.is_paid_placement
    })
    setShowCreateForm(true)
  }

  function resetForm() {
    setFormData({
      app_name: '',
      tagline: '',
      description: '',
      category: '',
      app_url: '',
      logo_url: '',
      screenshot_url: '',
      pricing: 'Free',
      is_featured: false,
      is_paid_placement: false
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading AI applications...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">AI Applications</h1>
          <p className="text-gray-600 mt-1">
            {newsletter?.name} - Manage AI tools featured in newsletters
          </p>
        </div>

        {/* Actions */}
        <div className="mb-6">
          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm)
              setEditingApp(null)
              resetForm()
            }}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showCreateForm ? 'Cancel' : '+ Add New App'}
          </button>
        </div>

        {/* Create/Edit Form */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">
              {editingApp ? 'Edit Application' : 'Create New Application'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    App Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.app_name}
                    onChange={(e) => setFormData({ ...formData, app_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tagline
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={formData.tagline}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="Short one-liner (max 80 chars)"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description *
                  </label>
                  <textarea
                    required
                    maxLength={200}
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="Full description (max 200 chars)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.description.length}/200 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="e.g., Automation, Analysis"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pricing
                  </label>
                  <select
                    value={formData.pricing}
                    onChange={(e) => setFormData({ ...formData, pricing: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="Free">Free</option>
                    <option value="Freemium">Freemium</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    App URL *
                  </label>
                  <input
                    type="url"
                    required
                    value={formData.app_url}
                    onChange={(e) => setFormData({ ...formData, app_url: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="https://example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Logo URL
                  </label>
                  <input
                    type="url"
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Screenshot URL
                  </label>
                  <input
                    type="url"
                    value={formData.screenshot_url}
                    onChange={(e) => setFormData({ ...formData, screenshot_url: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div className="md:col-span-2 flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_featured}
                      onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">Featured</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_paid_placement}
                      onChange={(e) => setFormData({ ...formData, is_paid_placement: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">Paid Placement</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingApp ? 'Update App' : 'Create App'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
                    setEditingApp(null)
                    resetForm()
                  }}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Apps List */}
        <div className="space-y-4">
          {apps.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center border border-gray-200">
              <p className="text-gray-500">No AI applications yet. Create your first one!</p>
            </div>
          ) : (
            apps.map((app) => (
              <div key={app.id} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">{app.app_name}</h3>
                      {app.is_featured && (
                        <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                          Featured
                        </span>
                      )}
                      {app.pricing && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                          {app.pricing}
                        </span>
                      )}
                      {app.category && (
                        <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                          {app.category}
                        </span>
                      )}
                    </div>

                    {app.tagline && (
                      <p className="text-sm text-gray-600 italic mb-2">{app.tagline}</p>
                    )}

                    <p className="text-gray-700 mb-3">{app.description}</p>

                    <a
                      href={app.app_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      {app.app_url} →
                    </a>

                    <div className="mt-3 text-xs text-gray-500">
                      Times used: {app.times_used} | Last used:{' '}
                      {app.last_used_date || 'Never'}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => startEdit(app)}
                      className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(app.id)}
                      className="bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
