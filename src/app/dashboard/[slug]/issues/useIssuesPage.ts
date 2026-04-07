'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Newsletterissue } from '@/types/database'

export function useIssuesPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const [issues, setIssues] = useState<Newsletterissue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    issue: Newsletterissue | null
  }>({ isOpen: false, issue: null })
  const [createModal, setCreateModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchIssues()
  }, [filter, slug])

  const fetchIssues = async () => {
    try {
      const baseParams = `newsletter_slug=${slug}&limit=50`
      const url = filter === 'all'
        ? `/api/campaigns?${baseParams}`
        : `/api/campaigns?${baseParams}&status=${filter}`
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch issues')
      const data = await response.json()
      setIssues(data.issues)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'in_review': return 'bg-yellow-100 text-yellow-800'
      case 'changes_made': return 'bg-orange-100 text-orange-800'
      case 'sent': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatStatus = (status: string) => {
    switch (status) {
      case 'draft': return 'Draft'
      case 'in_review': return 'In Review'
      case 'changes_made': return 'Changes Made'
      case 'sent': return 'Sent'
      case 'failed': return 'Failed'
      default: return status
    }
  }

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    })
  }

  const handleDeleteClick = (issue: Newsletterissue) => {
    setDeleteModal({ isOpen: true, issue })
  }

  const handleDeleteConfirm = () => {
    setDeleteModal({ isOpen: false, issue: null })
    fetchIssues()
  }

  const handleDeleteCancel = () => {
    setDeleteModal({ isOpen: false, issue: null })
  }

  const handleCreateNewissue = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateString = tomorrow.toISOString().split('T')[0]
    setSelectedDate(dateString)
    setCreateModal(true)
  }

  const handleCreateConfirm = async () => {
    if (!selectedDate) { alert('Please select a date'); return }
    setCreating(true)
    try {
      const response = await fetch('/api/campaigns/create-with-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, publication_id: slug })
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create issue')
      }
      const data = await response.json()
      console.log('issue created:', data)
      setCreateModal(false)
      router.push(`/dashboard/${slug}/issues/${data.issue_id}`)
    } catch (error) {
      console.error('Error creating issue:', error)
      alert('Failed to create issue: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setCreating(false)
    }
  }

  const handleCreateCancel = () => {
    setCreateModal(false)
    setSelectedDate('')
  }

  return {
    slug, issues, loading, error, filter, setFilter,
    deleteModal, createModal, selectedDate, setSelectedDate, creating,
    getStatusColor, formatStatus, formatDate,
    handleDeleteClick, handleDeleteConfirm, handleDeleteCancel,
    handleCreateNewissue, handleCreateConfirm, handleCreateCancel,
  }
}
