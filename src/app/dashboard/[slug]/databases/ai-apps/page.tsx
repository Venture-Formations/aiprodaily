'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import type { AIApplication } from '@/types/database'

export default function AIApplicationsPage() {
  const [apps, setApps] = useState<AIApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<AIApplication>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<Partial<AIApplication>>({
    app_name: '',
    tagline: '',
    description: '',
    category: 'Payroll',
    app_url: '',
    tool_type: 'Client',
    category_priority: 0,
    is_active: true,
    is_featured: false,
    is_affiliate: false
  })
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [uploadingCSV, setUploadingCSV] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchApps()
  }, [])

  const fetchApps = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/ai-apps')
      if (response.ok) {
        const data = await response.json()
        setApps(data.apps || [])
      }
    } catch (error) {
      console.error('Failed to fetch AI applications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (app: AIApplication) => {
    setEditingId(app.id)
    setEditForm({ ...app })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const handleSave = async (id: string) => {
    try {
      const response = await fetch(`/api/ai-apps/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })

      if (response.ok) {
        await fetchApps()
        setEditingId(null)
        setEditForm({})
      }
    } catch (error) {
      console.error('Failed to update application:', error)
    }
  }

  const handleDelete = async (id: string, appName: string) => {
    if (!confirm(`Are you sure you want to delete "${appName}"?`)) return

    try {
      const response = await fetch(`/api/ai-apps/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchApps()
      }
    } catch (error) {
      console.error('Failed to delete application:', error)
    }
  }

  const handleAddApp = async () => {
    if (!addForm.app_name || !addForm.description || !addForm.app_url) {
      alert('Please fill in required fields: App Name, Description, and URL')
      return
    }

    try {
      const response = await fetch('/api/ai-apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm)
      })

      if (response.ok) {
        await fetchApps()
        setShowAddForm(false)
        setAddForm({
          app_name: '',
          tagline: '',
          description: '',
          category: 'Payroll',
          app_url: '',
          tool_type: 'Client',
          category_priority: 0,
          is_active: true,
          is_featured: false
        })
      }
    } catch (error) {
      console.error('Failed to add application:', error)
    }
  }

  const handleCSVUpload = async (file: File) => {
    setUploadingCSV(true)
    setUploadMessage('')
    setShowUploadModal(false)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/ai-apps/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        setUploadMessage(`✓ Successfully uploaded ${data.imported} apps${data.errors ? ` (${data.errors.length} errors)` : ''}`)
        await fetchApps()
      } else {
        setUploadMessage(`✗ Error: ${data.error || 'Upload failed'}`)
      }
    } catch (error) {
      setUploadMessage('✗ Error uploading CSV file')
      console.error('Failed to upload CSV:', error)
    } finally {
      setUploadingCSV(false)
      setTimeout(() => setUploadMessage(''), 5000)
    }
  }

  const downloadTemplate = () => {
    const headers = ['Tool Name', 'Category', 'Tool Type', 'Link', 'Description', 'Tagline', 'Affiliate']
    const exampleRow = [
      'QuickBooks AI Assistant',
      'Accounting System',
      'Client',
      'https://example.com',
      'AI-powered accounting assistant that categorizes transactions automatically and provides intelligent insights for financial decisions.',
      'Automate your bookkeeping with AI',
      'yes'
    ]

    const csvContent = [
      headers.join(','),
      exampleRow.map(value => `"${value}"`).join(',')
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'ai-apps-template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredApps = apps.filter(app => {
    const matchesCategory = filterCategory === 'all' || app.category === filterCategory
    const matchesSearch = searchQuery === '' ||
      app.app_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.tagline?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const categories = ['Payroll', 'HR', 'Accounting System', 'Finance', 'Productivity', 'Client Management', 'Banking']
  const toolTypes = ['Client', 'Firm']

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              AI Applications Database
            </h1>
            <p className="text-gray-600">
              Manage AI tools and applications for accounting professionals
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium"
              disabled={uploadingCSV}
            >
              {uploadingCSV ? 'Uploading...' : '📤 Upload CSV'}
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              + Add Application
            </button>
          </div>
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">Upload AI Applications CSV</h2>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Required CSV Columns</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="font-semibold text-gray-700">Column Name</div>
                      <div className="font-semibold text-gray-700">Required</div>
                      <div className="font-semibold text-gray-700">Description</div>
                    </div>
                    <hr className="border-gray-300" />

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="font-medium text-gray-900">Tool Name</div>
                      <div className="text-red-600 font-semibold">Required</div>
                      <div className="text-gray-600">Name of the AI application</div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="font-medium text-gray-900">Category</div>
                      <div className="text-blue-600">Optional</div>
                      <div className="text-gray-600">Must be one of: Payroll, HR, Accounting System, Finance, Productivity, Client Management, Banking</div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="font-medium text-gray-900">Tool Type</div>
                      <div className="text-blue-600">Optional</div>
                      <div className="text-gray-600">Must be: Client or Firm (defaults to Client)</div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="font-medium text-gray-900">Link</div>
                      <div className="text-red-600 font-semibold">Required</div>
                      <div className="text-gray-600">URL to the application website</div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="font-medium text-gray-900">Description</div>
                      <div className="text-red-600 font-semibold">Required</div>
                      <div className="text-gray-600">Brief description (max 200 characters)</div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="font-medium text-gray-900">Tagline</div>
                      <div className="text-blue-600">Optional</div>
                      <div className="text-gray-600">Short tagline (max 80 characters)</div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="font-medium text-gray-900">Affiliate</div>
                      <div className="text-blue-600">Optional</div>
                      <div className="text-gray-600">Enter "yes", "true", or "1" for affiliate programs</div>
                    </div>
                  </div>
                </div>

                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">💡 Tips:</h4>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>Column names are case-insensitive</li>
                    <li>Use quotes around values containing commas</li>
                    <li>Download the template below for correct formatting</li>
                    <li>All new apps will be set to Active by default</li>
                  </ul>
                </div>

                <div className="flex justify-between items-center gap-4">
                  <button
                    onClick={downloadTemplate}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
                  >
                    📥 Download Template CSV
                  </button>

                  <label className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium cursor-pointer text-center">
                    📤 Choose CSV File to Upload
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleCSVUpload(file)
                        e.target.value = ''
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Message */}
        {uploadMessage && (
          <div className={`mb-4 p-3 rounded-lg ${uploadMessage.startsWith('✓') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {uploadMessage}
          </div>
        )}

        {/* Add Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-2 border-blue-500">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add New AI Application</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  App Name *
                </label>
                <input
                  type="text"
                  value={addForm.app_name || ''}
                  onChange={(e) => setAddForm({ ...addForm, app_name: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="QuickBooks AI Assistant"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tagline
                </label>
                <input
                  type="text"
                  value={addForm.tagline || ''}
                  onChange={(e) => setAddForm({ ...addForm, tagline: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="Automate your bookkeeping with AI"
                  maxLength={80}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description * (max 200 characters)
                </label>
                <textarea
                  value={addForm.description || ''}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  rows={3}
                  maxLength={200}
                  placeholder="AI-powered accounting assistant that categorizes transactions..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={addForm.category || ''}
                  onChange={(e) => setAddForm({ ...addForm, category: e.target.value as any })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tool Type
                </label>
                <select
                  value={addForm.tool_type || 'Client'}
                  onChange={(e) => setAddForm({ ...addForm, tool_type: e.target.value as any })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  {toolTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  App URL *
                </label>
                <input
                  type="url"
                  value={addForm.app_url || ''}
                  onChange={(e) => setAddForm({ ...addForm, app_url: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Logo URL (optional)
                </label>
                <input
                  type="url"
                  value={addForm.logo_url || ''}
                  onChange={(e) => setAddForm({ ...addForm, logo_url: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="https://example.com/logo.png"
                />
              </div>
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={addForm.is_active}
                    onChange={(e) => setAddForm({ ...addForm, is_active: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={addForm.is_featured}
                    onChange={(e) => setAddForm({ ...addForm, is_featured: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Featured</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={addForm.is_affiliate}
                    onChange={(e) => setAddForm({ ...addForm, is_affiliate: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Affiliate</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddApp}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Add Application
              </button>
            </div>
          </div>
        )}

        {/* Search and Filter */}
        <div className="mb-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, description, or tagline..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Filter by Category:</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <span className="text-sm text-gray-600 whitespace-nowrap">
            Showing {filteredApps.length} of {apps.length} applications
          </span>
        </div>

        {/* Applications Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Application
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tool Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredApps.map((app) => (
                <tr key={app.id} className={!app.is_active ? 'bg-gray-50' : ''}>
                  {editingId === app.id ? (
                    <>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editForm.app_name || ''}
                          onChange={(e) => setEditForm({ ...editForm, app_name: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          placeholder="App Name"
                        />
                        <input
                          type="text"
                          value={editForm.tagline || ''}
                          onChange={(e) => setEditForm({ ...editForm, tagline: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-xs mt-1"
                          placeholder="Tagline"
                        />
                        <input
                          type="url"
                          value={editForm.app_url || ''}
                          onChange={(e) => setEditForm({ ...editForm, app_url: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-xs mt-1"
                          placeholder="App URL"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <textarea
                          value={editForm.description || ''}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          rows={3}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={editForm.category || ''}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value as any })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={editForm.tool_type || 'Client'}
                          onChange={(e) => setEditForm({ ...editForm, tool_type: e.target.value as any })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          {toolTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <label className="flex items-center text-sm">
                          <input
                            type="checkbox"
                            checked={editForm.is_active}
                            onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                            className="mr-1"
                          />
                          Active
                        </label>
                        <label className="flex items-center text-sm mt-1">
                          <input
                            type="checkbox"
                            checked={editForm.is_featured}
                            onChange={(e) => setEditForm({ ...editForm, is_featured: e.target.checked })}
                            className="mr-1"
                          />
                          Featured
                        </label>
                        <label className="flex items-center text-sm mt-1">
                          <input
                            type="checkbox"
                            checked={editForm.is_affiliate}
                            onChange={(e) => setEditForm({ ...editForm, is_affiliate: e.target.checked })}
                            className="mr-1"
                          />
                          Affiliate
                        </label>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleSave(app.id)}
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
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {app.logo_url && (
                            <img
                              src={app.logo_url}
                              alt={app.app_name}
                              className="w-10 h-10 rounded mr-3"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{app.app_name}</div>
                            {app.tagline && (
                              <div className="text-xs text-gray-500 italic">{app.tagline}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 max-w-md">
                        {app.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {app.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          {app.tool_type || 'Client'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {app.is_active ? (
                          <span className="text-green-600">✓ Active</span>
                        ) : (
                          <span className="text-gray-400">Inactive</span>
                        )}
                        {app.is_featured && (
                          <span className="block text-yellow-600 text-xs">★ Featured</span>
                        )}
                        {app.is_affiliate && (
                          <span className="block text-blue-600 text-xs font-semibold">$ Affiliate</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleEdit(app)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(app.id, app.app_name)}
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

          {filteredApps.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No AI applications found. Click "Add Application" to get started.
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600">{apps.length}</div>
            <div className="text-sm text-gray-600">Total Applications</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600">
              {apps.filter(a => a.is_active).length}
            </div>
            <div className="text-sm text-gray-600">Active</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-yellow-600">
              {apps.filter(a => a.is_featured).length}
            </div>
            <div className="text-sm text-gray-600">Featured</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-purple-600">
              {new Set(apps.map(a => a.category)).size}
            </div>
            <div className="text-sm text-gray-600">Categories</div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
