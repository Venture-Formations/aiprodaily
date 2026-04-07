'use client'

import { useState, useEffect } from 'react'
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import type { FeedbackBlock, FeedbackVoteOption, FeedbackTeamMember } from '@/types/database'
import type { FeedbackModuleSettingsProps, ResultsConfig } from './types'
import { defaultResultsConfig } from './types'

export function useFeedbackModuleSettings({
  module,
  onUpdate,
  onUpdateBlock,
  onReorderBlocks,
  onAddBlock,
  onDeleteBlock,
  onDelete,
}: Omit<FeedbackModuleSettingsProps, 'publicationId'>) {
  const [localName, setLocalName] = useState(module.name)
  const [showName, setShowName] = useState(module.show_name ?? true)
  const [blocks, setBlocks] = useState<FeedbackBlock[]>(module.blocks || [])
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'blocks' | 'results'>('general')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Results page config (stored in module.config)
  const [resultsConfig, setResultsConfig] = useState<ResultsConfig>({
    ...defaultResultsConfig,
    ...(module.config?.results_page as Record<string, string> || {})
  })

  // Block editing states
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null)
  const [editingBlock, setEditingBlock] = useState<string | null>(null)

  // Title editing
  const [editTitleText, setEditTitleText] = useState('')

  // Static text editing
  const [editStaticContent, setEditStaticContent] = useState('')
  const [editTextSize, setEditTextSize] = useState<'small' | 'medium' | 'large'>('medium')

  // Vote options editing
  const [editVoteOptions, setEditVoteOptions] = useState<FeedbackVoteOption[]>([])

  // Team photos editing
  const [editTeamPhotos, setEditTeamPhotos] = useState<FeedbackTeamMember[]>([])

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    setLocalName(module.name)
    setShowName(module.show_name ?? true)
    setBlocks(module.blocks || [])
    setResultsConfig({
      ...defaultResultsConfig,
      ...(module.config?.results_page as Record<string, string> || {})
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module])

  const handleNameChange = async (newName: string) => {
    if (newName.trim() && newName !== module.name) {
      setSaving(true)
      try {
        await onUpdate({ name: newName.trim() })
      } finally {
        setSaving(false)
      }
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

  const handleResultsConfigChange = (key: string, value: string) => {
    setResultsConfig(prev => ({ ...prev, [key]: value }))
  }

  const handleSaveResultsConfig = async () => {
    setSaving(true)
    try {
      await onUpdate({
        config: {
          ...module.config,
          results_page: resultsConfig
        }
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await onDelete()
    } finally {
      setSaving(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleAddBlock = async (blockType: FeedbackBlock['block_type']) => {
    if (!onAddBlock) return
    setSaving(true)
    try {
      await onAddBlock(blockType)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBlock = async (blockId: string) => {
    if (!onDeleteBlock) return
    setSaving(true)
    try {
      await onDeleteBlock(blockId)
      setBlocks(prev => prev.filter(b => b.id !== blockId))
      if (expandedBlock === blockId) setExpandedBlock(null)
      if (editingBlock === blockId) setEditingBlock(null)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleBlockActive = async (block: FeedbackBlock) => {
    setSaving(true)
    try {
      await onUpdateBlock(block.id, { is_enabled: !block.is_enabled })
      setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, is_enabled: !b.is_enabled } : b))
    } finally {
      setSaving(false)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const oldIndex = blocks.findIndex(b => b.id === active.id)
    const newIndex = blocks.findIndex(b => b.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const newBlocks = arrayMove(blocks, oldIndex, newIndex)
    const updatedBlocks = newBlocks.map((b, i) => ({ ...b, display_order: i }))
    setBlocks(updatedBlocks)

    // Save to server
    setSaving(true)
    try {
      await onReorderBlocks(updatedBlocks.map(b => b.id))
    } catch (error) {
      console.error('Failed to reorder blocks:', error)
      setBlocks(blocks) // Revert on error
    } finally {
      setSaving(false)
    }
  }

  const handleStartEdit = (block: FeedbackBlock) => {
    setEditingBlock(block.id)
    if (block.block_type === 'title') {
      setEditTitleText(block.title_text || '')
    } else if (block.block_type === 'static_text') {
      setEditStaticContent(block.static_content || '')
      setEditTextSize((block.text_size as 'small' | 'medium' | 'large') || 'medium')
    } else if (block.block_type === 'vote_options') {
      setEditVoteOptions(block.vote_options || [])
    } else if (block.block_type === 'team_photos') {
      setEditTeamPhotos(block.team_photos || [])
    }
  }

  const handleCancelEdit = () => {
    setEditingBlock(null)
    setEditTitleText('')
    setEditStaticContent('')
    setEditTextSize('medium')
    setEditVoteOptions([])
    setEditTeamPhotos([])
  }

  const handleSaveBlock = async (block: FeedbackBlock) => {
    setSaving(true)
    try {
      const updateData: Partial<FeedbackBlock> = {}

      if (block.block_type === 'title') {
        updateData.title_text = editTitleText
      } else if (block.block_type === 'static_text') {
        updateData.static_content = editStaticContent
        updateData.text_size = editTextSize
      } else if (block.block_type === 'vote_options') {
        updateData.vote_options = editVoteOptions
      } else if (block.block_type === 'team_photos') {
        updateData.team_photos = editTeamPhotos
      }

      await onUpdateBlock(block.id, updateData)
      setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, ...updateData } : b))
      setEditingBlock(null)
    } catch (error) {
      console.error('Failed to save block:', error)
      alert('Failed to save block. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async () => {
    setSaving(true)
    try {
      await onUpdate({ is_active: !module.is_active })
    } finally {
      setSaving(false)
    }
  }

  return {
    // State
    localName,
    setLocalName,
    showName,
    blocks,
    saving,
    activeTab,
    setActiveTab,
    showDeleteConfirm,
    setShowDeleteConfirm,
    resultsConfig,
    expandedBlock,
    setExpandedBlock,
    editingBlock,
    editTitleText,
    setEditTitleText,
    editStaticContent,
    setEditStaticContent,
    editTextSize,
    setEditTextSize,
    editVoteOptions,
    setEditVoteOptions,
    editTeamPhotos,
    setEditTeamPhotos,
    sensors,

    // Handlers
    handleNameChange,
    handleShowNameToggle,
    handleResultsConfigChange,
    handleSaveResultsConfig,
    handleDelete,
    handleAddBlock,
    handleDeleteBlock,
    handleToggleBlockActive,
    handleDragEnd,
    handleStartEdit,
    handleCancelEdit,
    handleSaveBlock,
    handleToggleActive,
  }
}

export type UseFeedbackModuleSettingsReturn = ReturnType<typeof useFeedbackModuleSettings>
