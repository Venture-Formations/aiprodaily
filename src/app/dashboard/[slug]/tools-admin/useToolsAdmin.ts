'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Tool, Category, StatusFilter } from './types'

export function useToolsAdmin() {
  const [tools, setTools] = useState<Tool[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [editingTool, setEditingTool] = useState<Tool | null>(null)

  const fetchTools = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tools/admin?status=${filter}`)
      const data = await res.json()
      if (data.success) {
        setTools(data.tools)
      }
    } catch (error) {
      console.error('Failed to fetch tools:', error)
    }
    setLoading(false)
  }, [filter])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/tools/categories')
      const data = await res.json()
      if (data.categories) {
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }, [])

  // Fetch categories once on mount
  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // Fetch tools when filter changes
  useEffect(() => {
    fetchTools()
  }, [fetchTools])

  const handleApprove = useCallback(async (toolId: string) => {
    setActionLoading(toolId)
    try {
      const res = await fetch('/api/tools/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId })
      })
      if (res.ok) {
        fetchTools()
      }
    } catch (error) {
      console.error('Failed to approve tool:', error)
    }
    setActionLoading(null)
  }, [fetchTools])

  const handleReject = useCallback(async (toolId: string) => {
    if (!rejectReason.trim()) {
      alert('Please provide a rejection reason')
      return
    }
    setActionLoading(toolId)
    try {
      const res = await fetch('/api/tools/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, reason: rejectReason })
      })
      if (res.ok) {
        setRejectingId(null)
        setRejectReason('')
        fetchTools()
      }
    } catch (error) {
      console.error('Failed to reject tool:', error)
    }
    setActionLoading(null)
  }, [rejectReason, fetchTools])

  const handleDelete = useCallback(async (toolId: string) => {
    if (!confirm('Are you sure you want to delete this tool? This cannot be undone.')) {
      return
    }
    setActionLoading(toolId)
    try {
      const res = await fetch('/api/tools/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId })
      })
      if (res.ok) {
        fetchTools()
      }
    } catch (error) {
      console.error('Failed to delete tool:', error)
    }
    setActionLoading(null)
  }, [fetchTools])

  const handleToggleFeatured = useCallback(async (toolId: string, currentValue: boolean) => {
    setActionLoading(toolId)
    try {
      const res = await fetch('/api/tools/admin/toggle-featured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, isFeatured: !currentValue })
      })
      if (res.ok) {
        fetchTools()
      }
    } catch (error) {
      console.error('Failed to toggle featured:', error)
    }
    setActionLoading(null)
  }, [fetchTools])

  const cancelReject = useCallback(() => {
    setRejectingId(null)
    setRejectReason('')
  }, [])

  return {
    // State
    tools,
    categories,
    filter,
    loading,
    actionLoading,
    rejectReason,
    rejectingId,
    editingTool,
    // Setters
    setFilter,
    setRejectReason,
    setRejectingId,
    setEditingTool,
    // Actions
    fetchTools,
    handleApprove,
    handleReject,
    handleDelete,
    handleToggleFeatured,
    cancelReject,
  }
}
