'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Newsletterissue, Newsletter } from '@/types/database'

export function useDashboard() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [newsletter, setNewsletter] = useState<Newsletter | null>(null)
  const [issues, setIssues] = useState<Newsletterissue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createModal, setCreateModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (slug) {
      fetchNewsletter()
      fetchIssues()
    }
  }, [slug])

  const fetchNewsletter = async () => {
    try {
      const response = await fetch('/api/newsletters')
      if (!response.ok) throw new Error('Failed to fetch newsletters')
      const data = await response.json()
      const found = data.newsletters?.find((n: Newsletter) => n.slug === slug)
      if (!found) {
        setError('Newsletter not found')
        router.push('/dashboard')
        return
      }
      setNewsletter(found)
    } catch (error) {
      console.error('Error fetching newsletter:', error)
      setError('Failed to load newsletter')
    }
  }

  const fetchIssues = async () => {
    try {
      const response = await fetch(`/api/campaigns?limit=3&newsletter_slug=${slug}`)
      if (!response.ok) throw new Error('Failed to fetch issues')
      const data = await response.json()
      setIssues(data.issues)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })
  }

  const handleCreateNewIssue = () => {
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
      console.log('Issue created:', data)
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

  const statCards = [
    { label: 'Publications Sent', count: issues.filter(c => c.status === 'sent').length, color: 'text-brand-primary' },
    { label: 'In Review', count: issues.filter(c => c.status === 'in_review').length, color: 'text-yellow-600' },
    { label: 'Changes Made', count: issues.filter(c => c.status === 'changes_made').length, color: 'text-blue-600' },
    { label: 'Drafts', count: issues.filter(c => c.status === 'draft').length, color: 'text-gray-600' },
    { label: 'Failed', count: issues.filter(c => c.status === 'failed').length, color: 'text-red-600' },
  ]

  return {
    slug, newsletter, issues, loading, error,
    createModal, selectedDate, setSelectedDate, creating,
    fetchIssues, formatDate, handleCreateNewIssue,
    handleCreateConfirm, handleCreateCancel, statCards,
  }
}
