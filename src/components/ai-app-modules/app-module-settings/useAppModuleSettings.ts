'use client'

import { useState, useEffect } from 'react'
import type {
  AIAppModule,
  AIAppBlockType,
  AIAppSelectionMode,
  ProductCardBlockConfig,
  ProductCardLayoutMode
} from '@/types/database'

export const DEFAULT_BLOCK_CONFIG: ProductCardBlockConfig = {
  logo: { enabled: true, style: 'square', position: 'left' },
  title: { enabled: true, size: 'medium' },
  description: { enabled: true, size: 'medium' },
  tagline: { enabled: false, size: 'medium' },
  image: { enabled: false },
  button: { enabled: false }
}

export function useAppModuleSettings(
  module: AIAppModule,
  onUpdate: (updates: Partial<AIAppModule>) => Promise<void>,
  onDelete: () => void
) {
  const [localModule, setLocalModule] = useState(module)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [activeTab, setActiveTab] = useState<'general' | 'blocks'>('general')
  const [showName, setShowName] = useState(module.show_name ?? true)

  useEffect(() => {
    setLocalModule(module)
    setShowName(module.show_name ?? true)
    setDeleteConfirm(false)
    setDeleteText('')
  }, [module.id])

  const blockConfig: ProductCardBlockConfig = {
    ...DEFAULT_BLOCK_CONFIG,
    ...(localModule.block_config || {})
  }

  const enabledBlockCount = (localModule.block_order as AIAppBlockType[])?.length || 0

  const wrapSave = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setSaving(true)
    try {
      return await fn()
    } catch (error) {
      console.error('Save failed:', error)
      return undefined
    } finally {
      setSaving(false)
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

  const handleBlockOrderChange = async (newOrder: AIAppBlockType[]) => {
    await wrapSave(async () => {
      await onUpdate({ block_order: newOrder })
      setLocalModule(prev => ({ ...prev, block_order: newOrder }))
    })
  }

  const handleBlockConfigChange = async (newConfig: ProductCardBlockConfig) => {
    await wrapSave(async () => {
      await onUpdate({ block_config: newConfig })
      setLocalModule(prev => ({ ...prev, block_config: newConfig }))
    })
  }

  const handleSelectionModeChange = async (mode: AIAppSelectionMode) => {
    await wrapSave(async () => {
      await onUpdate({ selection_mode: mode })
      setLocalModule(prev => ({ ...prev, selection_mode: mode }))
    })
  }

  const handleActiveToggle = async () => {
    await wrapSave(async () => {
      await onUpdate({ is_active: !localModule.is_active })
      setLocalModule(prev => ({ ...prev, is_active: !prev.is_active }))
    })
  }

  const handleShowNameToggle = async () => {
    const newValue = !showName
    setShowName(newValue)
    await wrapSave(async () => {
      await onUpdate({ show_name: newValue })
    })
  }

  const handleSettingChange = async (key: 'apps_count' | 'max_per_category' | 'affiliate_cooldown_days', value: number) => {
    await wrapSave(async () => {
      await onUpdate({ [key]: value })
      setLocalModule(prev => ({ ...prev, [key]: value }))
    })
  }

  const handleLayoutModeChange = async (value: ProductCardLayoutMode) => {
    await wrapSave(async () => {
      await onUpdate({ layout_mode: value })
      setLocalModule(prev => ({ ...prev, layout_mode: value }))
    })
  }

  const handleToggle = async (key: 'show_in_directory' | 'include_in_archive' | 'show_emoji' | 'show_numbers') => {
    await wrapSave(async () => {
      const newValue = localModule[key] === false ? true : false
      await onUpdate({ [key]: newValue })
      setLocalModule(prev => ({ ...prev, [key]: newValue }))
    })
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
    saveStatus,
    activeTab,
    setActiveTab,
    showName,
    blockConfig,
    enabledBlockCount,
    handleNameChange,
    handleBlockOrderChange,
    handleBlockConfigChange,
    handleSelectionModeChange,
    handleActiveToggle,
    handleShowNameToggle,
    handleSettingChange,
    handleLayoutModeChange,
    handleToggle,
    handleDelete,
  }
}
