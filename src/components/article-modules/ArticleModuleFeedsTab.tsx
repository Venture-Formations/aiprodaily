'use client'

import { useState, useEffect, useCallback } from 'react'

interface Feed {
  id: string
  name: string
  url: string
  active: boolean
  last_processed: string | null
}

interface ArticleModuleFeedsTabProps {
  moduleId: string
  publicationId: string
  onFeedCountChange?: (count: number) => void
}

export default function ArticleModuleFeedsTab({
  moduleId,
  publicationId,
  onFeedCountChange
}: ArticleModuleFeedsTabProps) {
  const [assignedFeeds, setAssignedFeeds] = useState<Feed[]>([])
  const [availableFeeds, setAvailableFeeds] = useState<Feed[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // New feed form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newFeedName, setNewFeedName] = useState('')
  const [newFeedUrl, setNewFeedUrl] = useState('')
  const [addingFeed, setAddingFeed] = useState(false)

  // Edit feed state
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editActive, setEditActive] = useState(true)

  const fetchFeeds = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/article-modules/${moduleId}/feeds`)
      if (!res.ok) throw new Error('Failed to fetch feeds')
      const data = await res.json()
      setAssignedFeeds(data.assigned || [])
      setAvailableFeeds(data.available || [])
      onFeedCountChange?.(data.assigned?.length || 0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [moduleId, onFeedCountChange])

  useEffect(() => {
    fetchFeeds()
  }, [fetchFeeds])

  const handleAssign = async (feedId: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/article-modules/${moduleId}/feeds`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assign: [feedId] })
      })
      if (!res.ok) throw new Error('Failed to assign feed')
      const data = await res.json()
      setAssignedFeeds(data.assigned || [])
      setAvailableFeeds(data.available || [])
      onFeedCountChange?.(data.assigned?.length || 0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUnassign = async (feedId: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/article-modules/${moduleId}/feeds`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unassign: [feedId] })
      })
      if (!res.ok) throw new Error('Failed to unassign feed')
      const data = await res.json()
      setAssignedFeeds(data.assigned || [])
      setAvailableFeeds(data.available || [])
      onFeedCountChange?.(data.assigned?.length || 0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddNewFeed = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFeedName.trim() || !newFeedUrl.trim()) return

    setAddingFeed(true)
    try {
      // First create the feed
      const createRes = await fetch('/api/rss-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publication_id: publicationId,
          name: newFeedName.trim(),
          url: newFeedUrl.trim(),
          active: true,
          article_module_id: moduleId
        })
      })

      if (!createRes.ok) {
        const data = await createRes.json()
        throw new Error(data.error || 'Failed to create feed')
      }

      // Refresh the feed list
      await fetchFeeds()

      // Reset form
      setNewFeedName('')
      setNewFeedUrl('')
      setShowAddForm(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAddingFeed(false)
    }
  }

  const startEditing = (feed: Feed) => {
    setEditingFeedId(feed.id)
    setEditName(feed.name)
    setEditUrl(feed.url)
    setEditActive(feed.active)
  }

  const cancelEditing = () => {
    setEditingFeedId(null)
    setEditName('')
    setEditUrl('')
    setEditActive(true)
  }

  const handleSaveEdit = async (feedId: string) => {
    if (!editName.trim() || !editUrl.trim()) return

    setSaving(true)
    try {
      const res = await fetch(`/api/rss-feeds/${feedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          url: editUrl.trim(),
          active: editActive
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update feed')
      }

      // Refresh the feed list
      await fetchFeeds()
      cancelEditing()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const renderFeedRow = (feed: Feed, showAssignButton: boolean) => {
    const isEditing = editingFeedId === feed.id

    if (isEditing) {
      return (
        <div key={feed.id} className="p-3 space-y-3 bg-gray-50">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Feed Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Feed URL
            </label>
            <input
              type="url"
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`active-${feed.id}`}
              checked={editActive}
              onChange={(e) => setEditActive(e.target.checked)}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor={`active-${feed.id}`} className="text-sm text-gray-700">
              Active
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={cancelEditing}
              disabled={saving}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSaveEdit(feed.id)}
              disabled={saving || !editName.trim() || !editUrl.trim()}
              className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )
    }

    return (
      <div key={feed.id} className="p-3 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${feed.active ? 'bg-green-500' : 'bg-gray-300'}`} />
            <p className="text-sm font-medium text-gray-900 truncate">
              {feed.name}
            </p>
            {!feed.active && (
              <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                Inactive
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {feed.url}
          </p>
        </div>
        <div className="flex items-center gap-1 ml-3">
          <button
            onClick={() => startEditing(feed)}
            disabled={saving}
            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            title="Edit feed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          {showAssignButton ? (
            <button
              onClick={() => handleAssign(feed.id)}
              disabled={saving}
              className="px-3 py-1 text-xs text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors disabled:opacity-50"
            >
              Assign
            </button>
          ) : (
            <button
              onClick={() => handleUnassign(feed.id)}
              disabled={saving}
              className="px-3 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-6 w-6 text-emerald-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Assigned Feeds */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">
            Assigned Feeds ({assignedFeeds.length})
          </h4>
        </div>

        {assignedFeeds.length === 0 ? (
          <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-500 text-center">
            No feeds assigned to this section yet
          </div>
        ) : (
          <div className="border rounded-lg divide-y">
            {assignedFeeds.map(feed => renderFeedRow(feed, false))}
          </div>
        )}
      </div>

      {/* Available Feeds */}
      {availableFeeds.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">
            Available Feeds ({availableFeeds.length})
          </h4>
          <p className="text-xs text-gray-500">
            These feeds are not assigned to any article section
          </p>

          <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
            {availableFeeds.map(feed => renderFeedRow(feed, true))}
          </div>
        </div>
      )}

      {/* Add New Feed */}
      <div className="pt-4 border-t">
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-800"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New Feed
          </button>
        ) : (
          <form onSubmit={handleAddNewFeed} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Feed Name
              </label>
              <input
                type="text"
                value={newFeedName}
                onChange={(e) => setNewFeedName(e.target.value)}
                placeholder="e.g., Tech News"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Feed URL
              </label>
              <input
                type="url"
                value={newFeedUrl}
                onChange={(e) => setNewFeedUrl(e.target.value)}
                placeholder="https://example.com/feed.xml"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setNewFeedName('')
                  setNewFeedUrl('')
                }}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingFeed || !newFeedName.trim() || !newFeedUrl.trim()}
                className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingFeed ? 'Adding...' : 'Add Feed'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
