'use client'

import { useState, useEffect, useRef } from 'react'
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
import { Crop, PixelCrop } from 'react-image-crop'
import { getCroppedImage } from '@/utils/imageCrop'
import type { TextBoxModule, TextBoxBlock } from '@/types/database'
import type { TestResult } from './types'
import { getAspectRatioValue } from './types'

export function useTextBoxModuleSettings(
  module: TextBoxModule,
  publicationId: string,
  onUpdate: (updates: Partial<TextBoxModule>) => Promise<void>,
  onDeleteModule: () => Promise<void>
) {
  const [localName, setLocalName] = useState(module.name)
  const [showName, setShowName] = useState(module.show_name ?? true)
  const [blocks, setBlocks] = useState<TextBoxBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'blocks'>('general')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Block editing states
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null)
  const [editingBlock, setEditingBlock] = useState<string | null>(null)

  // Static text editing
  const [editContent, setEditContent] = useState('')
  const [editTextSize, setEditTextSize] = useState<'small' | 'medium' | 'large'>('medium')

  // AI prompt editing
  const [editPrompt, setEditPrompt] = useState('')
  const [editTiming, setEditTiming] = useState<'before_articles' | 'after_articles'>('after_articles')
  const [editIsBold, setEditIsBold] = useState(false)
  const [editIsItalic, setEditIsItalic] = useState(false)
  const [editResponseField, setEditResponseField] = useState('')
  const [testingPrompt, setTestingPrompt] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  // Image editing
  const [editImageType, setEditImageType] = useState<'static' | 'ai_generated'>('static')
  const [editAiImagePrompt, setEditAiImagePrompt] = useState('')
  const [editImageAlt, setEditImageAlt] = useState('')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [uploadingImage, setUploadingImage] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '5:4' | 'free'>('16:9')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

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
    fetchBlocks()
  }, [module.id])

  const fetchBlocks = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/text-box-modules/${module.id}/blocks`)
      if (res.ok) {
        const data = await res.json()
        setBlocks(data.blocks || [])
      }
    } catch (error) {
      console.error('Failed to fetch blocks:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const handleDelete = async () => {
    setSaving(true)
    try {
      await onDeleteModule()
    } finally {
      setSaving(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleAddBlock = async (blockType: 'static_text' | 'ai_prompt' | 'image') => {
    setSaving(true)
    try {
      const res = await fetch(`/api/text-box-modules/${module.id}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block_type: blockType,
          display_order: blocks.length
        })
      })
      if (res.ok) {
        const data = await res.json()
        setBlocks(prev => [...prev, data.block])
        // Auto-expand newly added block for editing
        setExpandedBlock(data.block.id)
        handleStartEdit(data.block)
      }
    } catch (error) {
      console.error('Failed to add block:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBlock = async (blockId: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/text-box-modules/${module.id}/blocks/${blockId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setBlocks(prev => prev.filter(b => b.id !== blockId))
        if (expandedBlock === blockId) setExpandedBlock(null)
        if (editingBlock === blockId) setEditingBlock(null)
      }
    } catch (error) {
      console.error('Failed to delete block:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleBlockActive = async (block: TextBoxBlock) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/text-box-modules/${module.id}/blocks/${block.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !block.is_active })
      })
      if (res.ok) {
        const data = await res.json()
        setBlocks(prev => prev.map(b => b.id === block.id ? data.block : b))
      }
    } catch (error) {
      console.error('Failed to toggle block:', error)
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
      await fetch(`/api/text-box-modules/${module.id}/blocks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: updatedBlocks.map(b => ({ id: b.id, display_order: b.display_order }))
        })
      })
    } catch (error) {
      console.error('Failed to reorder blocks:', error)
      fetchBlocks() // Revert on error
    } finally {
      setSaving(false)
    }
  }

  const handleStartEdit = (block: TextBoxBlock) => {
    setEditingBlock(block.id)
    if (block.block_type === 'static_text') {
      setEditContent(block.static_content || '')
      setEditTextSize((block.text_size as any) || 'medium')
    } else if (block.block_type === 'ai_prompt') {
      const promptJson = block.ai_prompt_json
      if (promptJson) {
        setEditPrompt(JSON.stringify(promptJson, null, 2))
      } else {
        setEditPrompt('')
      }
      setEditTiming(block.generation_timing || 'after_articles')
      setEditIsBold(block.is_bold || false)
      setEditIsItalic(block.is_italic || false)
      setEditResponseField((promptJson as any)?.response_field || '')
    } else if (block.block_type === 'image') {
      setEditImageType((block.image_type as any) || 'static')
      setEditAiImagePrompt(block.ai_image_prompt || '')
      setEditImageAlt(block.image_alt || '')
      setSelectedImage(null)
      setCrop(undefined)
      setCompletedCrop(undefined)
    }
  }

  const handleCancelEdit = () => {
    setEditingBlock(null)
    setEditContent('')
    setEditPrompt('')
    setEditIsBold(false)
    setEditIsItalic(false)
    setEditResponseField('')
    setSelectedImage(null)
    setCrop(undefined)
    setCompletedCrop(undefined)
    setTestResult(null)
  }

  const handleTestPrompt = async () => {
    if (!editPrompt.trim()) {
      setTestResult({ error: 'Please enter a prompt to test' })
      return
    }

    setTestingPrompt(true)
    setTestResult(null)

    try {
      const res = await fetch('/api/text-box-modules/test-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicationId,
          prompt: editPrompt,
          timing: editTiming
        })
      })

      const data = await res.json()

      if (data.success) {
        setTestResult({
          result: data.result,
          injectedPrompt: data.injectedPrompt
        })
      } else {
        setTestResult({ error: data.error || 'Test failed' })
      }
    } catch (error) {
      setTestResult({ error: 'Failed to test prompt. Please try again.' })
    } finally {
      setTestingPrompt(false)
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        setSelectedImage(reader.result as string)
        const ratio = getAspectRatioValue(aspectRatio)
        if (ratio) {
          const height = 80 / ratio
          setCrop({
            unit: '%',
            x: 10,
            y: Math.max(5, (100 - height) / 2),
            width: 80,
            height: Math.min(90, height)
          })
        } else {
          setCrop({
            unit: '%',
            x: 10,
            y: 10,
            width: 80,
            height: 80
          })
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAspectRatioChange = (newRatio: '16:9' | '5:4' | 'free') => {
    setAspectRatio(newRatio)
    if (selectedImage) {
      const ratio = getAspectRatioValue(newRatio)
      if (ratio) {
        const height = 80 / ratio
        setCrop({
          unit: '%',
          x: 10,
          y: Math.max(5, (100 - height) / 2),
          width: 80,
          height: Math.min(90, height)
        })
      } else {
        setCrop({
          unit: '%',
          x: 10,
          y: 10,
          width: 80,
          height: 80
        })
      }
      setCompletedCrop(undefined)
    }
  }

  const handleSaveBlock = async (block: TextBoxBlock) => {
    setSaving(true)
    try {
      const updateData: Record<string, any> = {}

      if (block.block_type === 'static_text') {
        updateData.static_content = editContent
        updateData.text_size = editTextSize
      } else if (block.block_type === 'ai_prompt') {
        let parsedJson
        try {
          parsedJson = JSON.parse(editPrompt)
        } catch (e) {
          alert('Invalid JSON format. Please check your prompt syntax.')
          setSaving(false)
          return
        }

        if (editResponseField.trim()) {
          parsedJson.response_field = editResponseField.trim()
        }

        updateData.ai_prompt_json = parsedJson
        updateData.generation_timing = editTiming
        updateData.is_bold = editIsBold
        updateData.is_italic = editIsItalic
      } else if (block.block_type === 'image') {
        updateData.image_type = editImageType
        updateData.image_alt = editImageAlt || null

        if (editImageType === 'ai_generated') {
          updateData.ai_image_prompt = editAiImagePrompt
        } else if (selectedImage && completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
          setUploadingImage(true)
          try {
            const croppedBlob = await getCroppedImage(imgRef.current, completedCrop)
            if (croppedBlob) {
              const imageFormData = new FormData()
              imageFormData.append('image', croppedBlob, 'block-image.jpg')

              const uploadRes = await fetch('/api/ads/upload-image', {
                method: 'POST',
                body: imageFormData
              })

              if (uploadRes.ok) {
                const { url } = await uploadRes.json()
                updateData.static_image_url = url
              } else {
                throw new Error('Failed to upload image')
              }
            }
          } finally {
            setUploadingImage(false)
          }
        }
      }

      const res = await fetch(`/api/text-box-modules/${module.id}/blocks/${block.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      if (res.ok) {
        const data = await res.json()
        setBlocks(prev => prev.map(b => b.id === block.id ? data.block : b))
        setEditingBlock(null)
        setSelectedImage(null)
      }
    } catch (error) {
      console.error('Failed to save block:', error)
      alert('Failed to save block. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleModuleActive = async () => {
    setSaving(true)
    try {
      await onUpdate({ is_active: !module.is_active })
    } finally {
      setSaving(false)
    }
  }

  return {
    localName, setLocalName, showName, saving,
    activeTab, setActiveTab, showDeleteConfirm, setShowDeleteConfirm,
    blocks, loading, expandedBlock, setExpandedBlock, editingBlock, sensors,
    editContent, setEditContent, editTextSize, setEditTextSize,
    editPrompt, setEditPrompt, editTiming, setEditTiming,
    editIsBold, setEditIsBold, editIsItalic, setEditIsItalic,
    editResponseField, setEditResponseField, testingPrompt, testResult,
    editImageType, setEditImageType, editAiImagePrompt, setEditAiImagePrompt,
    editImageAlt, setEditImageAlt, selectedImage,
    crop, setCrop, completedCrop, setCompletedCrop,
    uploadingImage, aspectRatio, fileInputRef, imgRef,
    handleNameChange, handleShowNameToggle, handleDelete,
    handleAddBlock, handleDeleteBlock, handleToggleBlockActive,
    handleDragEnd, handleStartEdit, handleCancelEdit,
    handleTestPrompt, handleImageSelect, handleAspectRatioChange,
    handleSaveBlock, handleToggleModuleActive,
  }
}
