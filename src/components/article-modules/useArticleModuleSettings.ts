'use client'

import { useState, useEffect } from 'react'
import type { ArticleModule, ArticleModuleCriteria, ArticleModulePrompt } from '@/types/database'

type TabType = 'general' | 'feeds' | 'prompts'

interface UseArticleModuleSettingsParams {
  module: ArticleModule & {
    criteria?: ArticleModuleCriteria[]
    prompts?: ArticleModulePrompt[]
  }
  onUpdate: (updates: Partial<ArticleModule>) => Promise<void>
  onDelete: () => void
}

export function useArticleModuleSettings({ module, onUpdate, onDelete }: UseArticleModuleSettingsParams) {
  const [localModule, setLocalModule] = useState(module)
  const [activeTab, setActiveTab] = useState<TabType>('general')
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [feedCount, setFeedCount] = useState<number | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showName, setShowName] = useState(module.show_name ?? true)

  useEffect(() => {
    setLocalModule(module)
    setShowName(module.show_name ?? true)
    setDeleteConfirm(false)
    setDeleteText('')
    fetchFeedCount()
  }, [module.id])

  const fetchFeedCount = async () => {
    try {
      const res = await fetch(`/api/article-modules/${module.id}/feeds`)
      if (res.ok) {
        const data = await res.json()
        setFeedCount(data.assigned?.length || 0)
      }
    } catch (error) {
      console.error('Failed to fetch feed count:', error)
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

  const handleModuleUpdate = async (updates: Partial<ArticleModule>) => {
    setSaving(true)
    try {
      await onUpdate(updates)
      setLocalModule(prev => ({ ...prev, ...updates }))
    } catch (error) {
      console.error('Failed to update module:', error)
      throw error
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
    localModule,
    activeTab,
    setActiveTab,
    saving,
    deleteConfirm,
    setDeleteConfirm,
    deleteText,
    setDeleteText,
    feedCount,
    setFeedCount,
    saveStatus,
    showName,
    handleNameChange,
    handleActiveToggle,
    handleShowNameToggle,
    handleModuleUpdate,
    handleDelete,
    setLocalName,
  }
}
