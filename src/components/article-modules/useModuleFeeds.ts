import { useState, useEffect, useCallback } from 'react'

export interface Feed {
  id: string
  name: string
  url: string
  active: boolean
  last_processed: string | null
}

export function useModuleFeeds(
  moduleId: string,
  publicationId: string,
  onFeedCountChange?: (count: number) => void
) {
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
      await fetchFeeds()
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
      await fetchFeeds()
      cancelEditing()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return {
    assignedFeeds,
    availableFeeds,
    loading,
    saving,
    error,
    setError,
    showAddForm,
    setShowAddForm,
    newFeedName,
    setNewFeedName,
    newFeedUrl,
    setNewFeedUrl,
    addingFeed,
    editingFeedId,
    editName,
    setEditName,
    editUrl,
    setEditUrl,
    editActive,
    setEditActive,
    handleAssign,
    handleUnassign,
    handleAddNewFeed,
    startEditing,
    cancelEditing,
    handleSaveEdit,
  }
}
