'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import type { AIApplication, AIAppModule } from '@/types/database'

export default function AIApplicationsPage() {
  const [apps, setApps] = useState<AIApplication[]>([])
  const [modules, setModules] = useState<AIAppModule[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<AIApplication>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<Partial<AIApplication>>({
    app_name: '',
    description: '',
    category: null,
    app_url: '',
    tool_type: null,
    category_priority: 0,
    is_active: true,
    is_featured: false,
    is_paid_placement: false,
    is_affiliate: false,
    ai_app_module_id: null
  })
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterAffiliate, setFilterAffiliate] = useState<string>('all')
  const [filterModule, setFilterModule] = useState<string>('all')
  const [uploadingCSV, setUploadingCSV] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadModuleId, setUploadModuleId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchApps()
    fetchModules()
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

  const fetchModules = async () => {
    try {
      const response = await fetch('/api/ai-app-modules')
      if (response.ok) {
        const data = await response.json()
        setModules(data.modules || [])
      }
    } catch (error) {
      console.error('Failed to fetch modules:', error)
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
          description: '',
          category: null,
          app_url: '',
          tool_type: null,
          category_priority: 0,
          is_active: true,
          is_featured: false,
          is_paid_placement: false,
          is_affiliate: false,
          ai_app_module_id: null
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
      if (uploadModuleId) {
        formData.append('module_id', uploadModuleId)
      }

      const response = await fetch('/api/ai-apps/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        const parts = []
        if (data.inserted > 0) parts.push(`${data.inserted} added`)
        if (data.updated > 0) parts.push(`${data.updated} updated`)
        const summary = parts.length > 0 ? parts.join(', ') : 'No changes'
        const errorInfo = data.errors ? ` (${data.errors.length} errors)` : ''
        setUploadMessage(`✓ Successfully processed: ${summary}${errorInfo}`)
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
    const headers = ['Tool Name', 'Category', 'Tool Type', 'Link', 'Description', 'Affiliate']
    const exampleRow = [
      'QuickBooks AI Assistant',
      'Accounting System',
      'Client',
      'https://example.com',
      'AI-powered accounting assistant that categorizes transactions automatically and provides intelligent insights for financial decisions.',
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
    const matchesCategory = filterCategory === 'all' ||
      (filterCategory === 'uncategorized' && !app.category) ||
      app.category === filterCategory
    const matchesAffiliate = filterAffiliate === 'all' ||
      (filterAffiliate === 'affiliates' && app.is_affiliate) ||
      (filterAffiliate === 'non-affiliates' && !app.is_affiliate)
    const matchesModule = filterModule === 'all' ||
      (filterModule === 'unassigned' && !app.ai_app_module_id) ||
      app.ai_app_module_id === filterModule
    const matchesSearch = searchQuery === '' ||
      app.app_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesAffiliate && matchesModule && matchesSearch
  })

  // Helper to get module name by ID
  const getModuleName = (moduleId: string | null) => {
    if (!moduleId) return null
    const module = modules.find(m => m.id === moduleId)
    return module?.name || 'Unknown'
  }

  // Categories matching AIAppCategory type from database.ts
  const categories = [
    'Accounting & Bookkeeping',
    'Tax & Compliance',
    'Payroll',
    'Finance & Analysis',
    'Expense Management',
    'Client Management',
    'Productivity',
    'HR',
    'Banking & Payments'
  ]
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
              Product Cards Database
            </h1>
            <p className="text-gray-600">
              Manage product cards and recommendations for your newsletter
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
              + Add Product
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
                    <li><strong>Duplicate handling:</strong> Apps with matching names will be updated (not duplicated)</li>
                  </ul>
                </div>

                {/* Module Assignment Dropdown */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Assign Imported Products to Section (Optional)
                  </label>
                  <select
                    value={uploadModuleId || ''}
                    onChange={(e) => setUploadModuleId(e.target.value || null)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Don&apos;t assign to any section (shared)</option>
                    {modules.map(mod => (
                      <option key={mod.id} value={mod.id}>{mod.name}</option>
                    ))}
                  </select>
                  <p className="text-sm text-gray-600 mt-2">
                    Products without a module assignment will be assigned to the selected section.
                    Leave as &quot;Don&apos;t assign&quot; to keep them shared across all sections.
                  </p>
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
                  onChange={(e) => setAddForm({ ...addForm, category: e.target.value || null as any })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="">-- Select Category --</option>
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
                  value={addForm.tool_type || ''}
                  onChange={(e) => setAddForm({ ...addForm, tool_type: e.target.value || null as any })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="">-- Select Type --</option>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign to Module
                </label>
                <select
                  value={addForm.ai_app_module_id || ''}
                  onChange={(e) => setAddForm({
                    ...addForm,
                    ai_app_module_id: e.target.value || null,
                    pinned_position: e.target.value ? addForm.pinned_position : null
                  })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="">All Modules (shared)</option>
                  {modules.map(mod => (
                    <option key={mod.id} value={mod.id}>{mod.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Leave as &quot;All Modules&quot; to share across all Product Card sections</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pinned Position {!addForm.ai_app_module_id && <span className="text-gray-400 font-normal">(requires module)</span>}
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={addForm.pinned_position || ''}
                  onChange={(e) => setAddForm({
                    ...addForm,
                    pinned_position: e.target.value ? parseInt(e.target.value) : null
                  })}
                  disabled={!addForm.ai_app_module_id}
                  placeholder={addForm.ai_app_module_id ? "Not pinned" : "Select module first"}
                  className={`w-full border border-gray-300 rounded px-3 py-2 ${!addForm.ai_app_module_id ? 'bg-gray-100 text-gray-400' : ''}`}
                />
                <p className="text-xs text-gray-500 mt-1">Pin to position 1-20 within the selected module</p>
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
                    checked={addForm.is_paid_placement}
                    onChange={(e) => setAddForm({ ...addForm, is_paid_placement: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Paid Placement</span>
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

        {/* Database Summary Stats */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600">{apps.length}</div>
            <div className="text-sm text-gray-600">Total Products</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600">
              {apps.filter(a => a.is_active).length}
            </div>
            <div className="text-sm text-gray-600">Active</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-yellow-600">
              {apps.filter(a => a.is_affiliate).length}
            </div>
            <div className="text-sm text-gray-600">Affiliates</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-amber-600">
              {apps.filter(a => a.is_featured).length}
            </div>
            <div className="text-sm text-gray-600">Featured</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-cyan-600">
              {apps.filter(a => a.is_paid_placement).length}
            </div>
            <div className="text-sm text-gray-600">Paid Placement</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-purple-600">
              {new Set(apps.map(a => a.category)).size}
            </div>
            <div className="text-sm text-gray-600">Categories</div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1 max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or description..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Category:</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="all">All Categories</option>
                <option value="uncategorized">No Category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <label className="text-sm font-medium text-gray-700 ml-3">Affiliate:</label>
              <select
                value={filterAffiliate}
                onChange={(e) => setFilterAffiliate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="all">All</option>
                <option value="affiliates">Affiliates Only</option>
                <option value="non-affiliates">Non-Affiliates</option>
              </select>

              <label className="text-sm font-medium text-gray-700 ml-3">Module:</label>
              <select
                value={filterModule}
                onChange={(e) => setFilterModule(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="all">All Modules</option>
                <option value="unassigned">Unassigned (Shared)</option>
                {modules.map(mod => (
                  <option key={mod.id} value={mod.id}>{mod.name}</option>
                ))}
              </select>
            </div>
            <span className="text-sm text-gray-600 whitespace-nowrap">
              Showing {filteredApps.length} of {apps.length} applications
            </span>
          </div>
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
                  Module
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pinned
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
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value || null as any })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          <option value="">-- None --</option>
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={editForm.tool_type || ''}
                          onChange={(e) => setEditForm({ ...editForm, tool_type: e.target.value || null as any })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          <option value="">-- None --</option>
                          {toolTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={editForm.ai_app_module_id || ''}
                          onChange={(e) => setEditForm({
                            ...editForm,
                            ai_app_module_id: e.target.value || null,
                            pinned_position: e.target.value ? editForm.pinned_position : null
                          })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          <option value="">All (shared)</option>
                          {modules.map(mod => (
                            <option key={mod.id} value={mod.id}>{mod.name}</option>
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
                            checked={editForm.is_paid_placement}
                            onChange={(e) => setEditForm({ ...editForm, is_paid_placement: e.target.checked })}
                            className="mr-1"
                          />
                          Paid Placement
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
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={editForm.pinned_position || ''}
                          onChange={(e) => setEditForm({
                            ...editForm,
                            pinned_position: e.target.value ? parseInt(e.target.value) : null
                          })}
                          disabled={!editForm.ai_app_module_id}
                          placeholder={editForm.ai_app_module_id ? "Not pinned" : "N/A"}
                          className={`w-20 border border-gray-300 rounded px-2 py-1 text-sm ${!editForm.ai_app_module_id ? 'bg-gray-100 text-gray-400' : ''}`}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {editForm.ai_app_module_id ? '1-20' : 'Needs module'}
                        </p>
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
                        {app.ai_app_module_id ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">
                            {getModuleName(app.ai_app_module_id)}
                          </span>
                        ) : (
                          <span className="text-gray-400">All (shared)</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {app.is_active ? (
                          <span className="text-green-600">✓ Active</span>
                        ) : (
                          <span className="text-gray-400">Inactive</span>
                        )}
                        {app.is_featured && (
                          <span className="block text-amber-600 text-xs">★ Featured</span>
                        )}
                        {app.is_paid_placement && (
                          <span className="block text-cyan-600 text-xs">⬆ Paid Placement</span>
                        )}
                        {app.is_affiliate && (
                          <span className="block text-blue-600 text-xs font-semibold">$ Affiliate</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {app.pinned_position && app.ai_app_module_id ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                            📌 #{app.pinned_position}
                          </span>
                        ) : app.ai_app_module_id ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          <span className="text-gray-300 text-xs">N/A</span>
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
              No product cards found. Click &quot;Add Product&quot; to get started.
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
