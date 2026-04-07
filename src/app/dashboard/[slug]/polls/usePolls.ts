'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Poll } from '@/types/database'

export interface PollWithAnalytics extends Poll {
  analytics?: {
    total_responses: number
    unique_respondents: number
    option_counts: Record<string, number>
  }
}

export function usePolls() {
  const pathname = usePathname()
  const [publicationId, setPublicationId] = useState<string | null>(null)
  const [polls, setPolls] = useState<PollWithAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPoll, setSelectedPoll] = useState<PollWithAnalytics | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formQuestion, setFormQuestion] = useState('')
  const [formOptions, setFormOptions] = useState<string[]>(['', '', ''])
  const [formImageUrl, setFormImageUrl] = useState('')
  const [formImageAlt, setFormImageAlt] = useState('')

  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/^\/dashboard\/([^\/]+)/)
      if (match && match[1]) {
        fetchPublicationId(match[1])
      }
    }
  }, [pathname])

  const fetchPublicationId = async (slug: string) => {
    try {
      const response = await fetch('/api/newsletters')
      if (!response.ok) throw new Error('Failed to fetch publications')
      const data = await response.json()
      const publication = data.newsletters?.find((n: { slug: string; id: string }) => n.slug === slug)
      if (publication) {
        setPublicationId(publication.id)
      } else {
        console.error('[Polls] Publication not found for slug:', slug)
        setLoading(false)
      }
    } catch (error) {
      console.error('[Polls] Error fetching publication:', error)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (publicationId) {
      fetchPolls()
    }
  }, [publicationId])

  const fetchPolls = async () => {
    if (!publicationId) return

    try {
      const response = await fetch(`/api/polls?publication_id=${publicationId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch polls')
      }

      const pollsWithAnalytics = await Promise.all(
        (data.polls || []).map(async (poll: Poll) => {
          try {
            const analyticsResponse = await fetch(
              `/api/polls/${poll.id}/responses?publication_id=${publicationId}`
            )
            const analyticsData = await analyticsResponse.json()
            return { ...poll, analytics: analyticsData.analytics }
          } catch (error) {
            console.error(`[Polls] Error fetching analytics for poll ${poll.id}:`, error)
            return poll
          }
        })
      )

      setPolls(pollsWithAnalytics)
    } catch (error) {
      console.error('[Polls] Error fetching polls:', error)
      alert('Failed to load polls')
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePoll = async () => {
    if (!publicationId) return

    const validOptions = formOptions.filter(opt => opt.trim() !== '')
    if (validOptions.length < 2) {
      alert('Poll must have at least 2 options')
      return
    }

    try {
      const response = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publication_id: publicationId,
          title: formTitle,
          question: formQuestion,
          options: validOptions,
          image_url: formImageUrl || null,
          image_alt: formImageAlt || null,
          is_active: false
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create poll')
      }

      alert('Poll created successfully!')
      setShowCreateForm(false)
      resetForm()
      fetchPolls()
    } catch (error) {
      console.error('[Polls] Error creating poll:', error)
      alert(error instanceof Error ? error.message : 'Failed to create poll')
    }
  }

  const handleUpdatePoll = async () => {
    if (!selectedPoll || !publicationId) return

    const validOptions = formOptions.filter(opt => opt.trim() !== '')
    if (validOptions.length < 2) {
      alert('Poll must have at least 2 options')
      return
    }

    try {
      const response = await fetch(`/api/polls/${selectedPoll.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publication_id: publicationId,
          title: formTitle,
          question: formQuestion,
          options: validOptions,
          image_url: formImageUrl || null,
          image_alt: formImageAlt || null
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update poll')
      }

      alert('Poll updated successfully!')
      setShowEditForm(false)
      setSelectedPoll(null)
      resetForm()
      fetchPolls()
    } catch (error) {
      console.error('[Polls] Error updating poll:', error)
      alert(error instanceof Error ? error.message : 'Failed to update poll')
    }
  }

  const handleDeletePoll = async (pollId: string) => {
    if (!publicationId) return
    if (!confirm('Are you sure you want to delete this poll? All responses will be lost.')) {
      return
    }

    try {
      const response = await fetch(`/api/polls/${pollId}?publication_id=${publicationId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete poll')
      }

      alert('Poll deleted successfully!')
      fetchPolls()
    } catch (error) {
      console.error('[Polls] Error deleting poll:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete poll')
    }
  }

  const handleToggleActive = async (poll: Poll) => {
    if (!publicationId) return

    try {
      const response = await fetch(`/api/polls/${poll.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publication_id: publicationId,
          is_active: !poll.is_active
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update poll status')
      }

      fetchPolls()
    } catch (error) {
      console.error('[Polls] Error toggling poll status:', error)
      alert(error instanceof Error ? error.message : 'Failed to update poll status')
    }
  }

  const resetForm = () => {
    setFormTitle('')
    setFormQuestion('')
    setFormOptions(['', '', ''])
    setFormImageUrl('')
  }

  const openEditForm = (poll: PollWithAnalytics) => {
    setSelectedPoll(poll)
    setFormTitle(poll.title)
    setFormQuestion(poll.question)
    setFormOptions([...poll.options])
    setFormImageUrl(poll.image_url || '')
    setFormImageAlt(poll.image_alt || '')
    setShowEditForm(true)
  }

  const addOption = () => {
    setFormOptions([...formOptions, ''])
  }

  const removeOption = (index: number) => {
    if (formOptions.length <= 2) {
      alert('A poll must have at least 2 options')
      return
    }
    setFormOptions(formOptions.filter((_, i) => i !== index))
  }

  const updateOption = (index: number, value: string) => {
    const newOptions = [...formOptions]
    newOptions[index] = value
    setFormOptions(newOptions)
  }

  return {
    pathname,
    publicationId,
    polls,
    loading,
    selectedPoll,
    showCreateForm,
    setShowCreateForm,
    showEditForm,
    setShowEditForm,
    formTitle,
    setFormTitle,
    formQuestion,
    setFormQuestion,
    formOptions,
    formImageUrl,
    setFormImageUrl,
    formImageAlt,
    setFormImageAlt,
    handleCreatePoll,
    handleUpdatePoll,
    handleDeletePoll,
    handleToggleActive,
    resetForm,
    openEditForm,
    addOption,
    removeOption,
    updateOption,
    setSelectedPoll,
  }
}
