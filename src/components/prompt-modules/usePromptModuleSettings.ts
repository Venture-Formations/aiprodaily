'use client'

import { useState, useEffect } from 'react'
import type { PromptModule, PromptBlockType, PromptSelectionMode } from '@/types/database'

interface UsePromptModuleSettingsParams {
  module: PromptModule
  onUpdate: (updates: Partial<PromptModule>) => Promise<void>
  onDelete: () => void
}

export function usePromptModuleSettings({ module, onUpdate, onDelete }: UsePromptModuleSettingsParams) {
  const [localModule, setLocalModule] = useState(module)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [showName, setShowName] = useState(module.show_name ?? true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

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

  const handleBlockOrderChange = async (newOrder: PromptBlockType[]) => {
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

  const handleSelectionModeChange = async (newMode: PromptSelectionMode) => {
    setSaving(true)
    try {
      await onUpdate({ selection_mode: newMode })
      setLocalModule(prev => ({ ...prev, selection_mode: newMode }))
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

  const setLocalName = (name: string) => {
    setLocalModule(prev => ({ ...prev, name }))
  }

  return {
    localModule, saving, deleteConfirm, setDeleteConfirm,
    deleteText, setDeleteText, showName, saveStatus,
    handleNameChange, handleBlockOrderChange, handleSelectionModeChange,
    handleActiveToggle, handleShowNameToggle, handleDelete, setLocalName,
  }
}
