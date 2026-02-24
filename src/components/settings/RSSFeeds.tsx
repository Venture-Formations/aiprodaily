'use client'

import { useState, useEffect } from 'react'

export default function RSSFeeds() {
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
          <div className="text-sm">Click &quot;Add Feed&quot; to get started with Breaking News</div>
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
