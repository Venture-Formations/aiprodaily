'use client'

import { useState, useEffect } from 'react'
import type { AdModule, AdBlockType, AdSelectionMode } from '@/types/database'

export function useAdModuleSettings(
  module: AdModule,
  onUpdate: (updates: Partial<AdModule>) => Promise<void>,
  onDelete: () => void
) {
  const [localModule, setLocalModule] = useState(module)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [adCount, setAdCount] = useState<number | null>(null)
  const [showName, setShowName] = useState(module.show_name ?? true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    setLocalModule(module)
    setShowName(module.show_name ?? true)
    setDeleteConfirm(false)
    setDeleteText('')
    fetchAdCount()
  }, [module.id])

  const fetchAdCount = async () => {
    try {
      const res = await fetch(`/api/ad-modules/${module.id}/ads`)
      if (res.ok) {
        const data = await res.json()
        setAdCount(data.ads?.length || 0)
      }
    } catch (error) {
      console.error('Failed to fetch ad count:', error)
    }
  }

  const handleNameChange = async (newName: string) => {
    if (newName.trim() === module.name) return

    setSaving(true)
    setSaveStatus('saving')
    try {
      await onUpdate({ name: newName.trim() })
      setLocalModule(prev => ({ ...prev, name: newName.trim() }))
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      console.error('Failed to update name:', error)
      setSaveStatus('error')
      setLocalModule(prev => ({ ...prev, name: module.name }))
    } finally {
      setSaving(false)
    }
  }

  const handleBlockOrderChange = async (newOrder: AdBlockType[]) => {
    setSaving(true)
    try {
      await onUpdate({ block_order: newOrder })
      setLocalModule(prev => ({ ...prev, block_order: newOrder }))
    } catch (error) {
      console.error('Failed to update block order:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleSelectionModeChange = async (mode: AdSelectionMode) => {
    setSaving(true)
    try {
      await onUpdate({ selection_mode: mode })
      setLocalModule(prev => ({ ...prev, selection_mode: mode }))
    } catch (error) {
      console.error('Failed to update selection mode:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleActiveToggle = async () => {
    setSaving(true)
    try {
      await onUpdate({ is_active: !localModule.is_active })
      setLocalModule(prev => ({ ...prev, is_active: !prev.is_active }))
    } catch (error) {
      console.error('Failed to update active status:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleShowNameToggle = async () => {
    const newValue = !showName
    setShowName(newValue)
    setSaving(true)
    try {
      await onUpdate({ show_name: newValue })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (deleteText !== 'DELETE') return

    setSaving(true)
    try {
      await onDelete()
    } catch (error) {
      console.error('Failed to delete module:', error)
    } finally {
      setSaving(false)
      setDeleteConfirm(false)
      setDeleteText('')
    }
  }

  return {
    localModule,
    setLocalModule,
    saving,
    deleteConfirm,
    setDeleteConfirm,
    deleteText,
    setDeleteText,
    adCount,
    showName,
    saveStatus,
    handleNameChange,
    handleBlockOrderChange,
    handleSelectionModeChange,
    handleActiveToggle,
    handleShowNameToggle,
    handleDelete
  }
}
