import { useState, useEffect } from 'react'
import type { PromptIdea } from '@/types/database'

export function usePromptIdeas(slug: string) {
  const [publicationId, setPublicationId] = useState<string | null>(null)
  const [prompts, setPrompts] = useState<PromptIdea[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<PromptIdea>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<Partial<PromptIdea>>({
    title: '',
    prompt_text: '',
    use_case: '',
    is_active: true,
    is_featured: false
  })
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null)
  const [uploadingCSV, setUploadingCSV] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')

  useEffect(() => {
    const resolvePublication = async () => {
      try {
        const res = await fetch(`/api/newsletters?slug=${slug}`)
        if (res.ok) {
          const data = await res.json()
          const pub = data.newsletters?.find((n: any) => n.slug === slug)
          if (pub) setPublicationId(pub.id)
        }
      } catch (err) {
        console.error('Failed to resolve publication:', err)
      }
    }
    if (slug) resolvePublication()
  }, [slug])

  useEffect(() => {
    if (publicationId) fetchPrompts()
  }, [publicationId])

  const fetchPrompts = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/prompt-ideas?publication_id=${publicationId}`)
      if (response.ok) {
        const data = await response.json()
        setPrompts(data.prompts || [])
      }
    } catch (error) {
      console.error('Failed to fetch prompt ideas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (prompt: PromptIdea) => {
    setEditingId(prompt.id)
    setEditForm({ ...prompt })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const handleSave = async (id: string) => {
    try {
      const response = await fetch(`/api/prompt-ideas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, publication_id: publicationId })
      })
      if (response.ok) {
        await fetchPrompts()
        setEditingId(null)
        setEditForm({})
      }
    } catch (error) {
      console.error('Failed to update prompt:', error)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return
    try {
      const response = await fetch(`/api/prompt-ideas/${id}?publication_id=${publicationId}`, {
        method: 'DELETE'
      })
      if (response.ok) await fetchPrompts()
    } catch (error) {
      console.error('Failed to delete prompt:', error)
    }
  }

  const handleAddPrompt = async () => {
    if (!addForm.title || !addForm.prompt_text) {
      alert('Please fill in required fields: Title and Prompt Text')
      return
    }
    try {
      const response = await fetch('/api/prompt-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addForm, publication_id: publicationId })
      })
      if (response.ok) {
        await fetchPrompts()
        setShowAddForm(false)
        setAddForm({
          title: '',
          prompt_text: '',
          use_case: '',
          is_active: true,
          is_featured: false
        })
      }
    } catch (error) {
      console.error('Failed to add prompt:', error)
    }
  }

  const handleCSVUpload = async (file: File) => {
    setUploadingCSV(true)
    setUploadMessage('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (publicationId) formData.append('publication_id', publicationId)

      const response = await fetch('/api/prompt-ideas/upload', {
        method: 'POST',
        body: formData
      })
      const data = await response.json()
      if (response.ok) {
        setUploadMessage(`Successfully uploaded ${data.imported} prompts`)
        await fetchPrompts()
      } else {
        setUploadMessage(`Error: ${data.error || 'Upload failed'}`)
      }
    } catch (error) {
      setUploadMessage('Error uploading CSV file')
      console.error('Failed to upload CSV:', error)
    } finally {
      setUploadingCSV(false)
      setTimeout(() => setUploadMessage(''), 5000)
    }
  }

  return {
    prompts,
    loading,
    editingId,
    editForm,
    setEditForm,
    showAddForm,
    setShowAddForm,
    addForm,
    setAddForm,
    expandedPromptId,
    setExpandedPromptId,
    uploadingCSV,
    uploadMessage,
    handleEdit,
    handleCancelEdit,
    handleSave,
    handleDelete,
    handleAddPrompt,
    handleCSVUpload,
  }
}
