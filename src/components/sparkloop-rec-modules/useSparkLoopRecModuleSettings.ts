'use client'

import { useState, useEffect } from 'react'
import type { SparkLoopRecModule, SparkLoopRecSelectionMode } from '@/types/database'

interface UseSparkLoopRecModuleSettingsParams {
  module: SparkLoopRecModule
  onUpdate: (updates: Partial<SparkLoopRecModule>) => Promise<void>
  onDelete: () => void
}

export function useSparkLoopRecModuleSettings({ module, onUpdate, onDelete }: UseSparkLoopRecModuleSettingsParams) {
  const [localModule, setLocalModule] = useState(module)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showName, setShowName] = useState(module.show_name ?? true)

  useEffect(() => {
    setLocalModule(module)
    setShowName(module.show_name ?? true)
    setDeleteConfirm(false)
    setDeleteText('')
  }, [module.id])

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

  const handleSelectionModeChange = async (mode: SparkLoopRecSelectionMode) => {
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

  const handleRecsCountChange = async (count: number) => {
    const validCount = Math.max(1, Math.min(10, count))
    setSaving(true)
    try {
      await onUpdate({ recs_count: validCount })
      setLocalModule(prev => ({ ...prev, recs_count: validCount }))
    } catch (error) {
      console.error('Failed to update recs count:', error)
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

  const setLocalName = (name: string) => {
    setLocalModule(prev => ({ ...prev, name }))
  }

  const setLocalRecsCount = (count: number) => {
    setLocalModule(prev => ({ ...prev, recs_count: count }))
  }

  return {
    localModule, saving, deleteConfirm, setDeleteConfirm,
    deleteText, setDeleteText, saveStatus, showName,
    handleNameChange, handleSelectionModeChange, handleRecsCountChange,
    handleActiveToggle, handleShowNameToggle, handleDelete,
    setLocalName, setLocalRecsCount,
  }
}
