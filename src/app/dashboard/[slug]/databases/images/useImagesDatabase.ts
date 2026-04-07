'use client'

import { useEffect, useState, useMemo } from 'react'
import { Image, ImageTag } from '@/types/database'

export type SortField = 'ai_caption' | 'created_at' | 'safe_score' | 'faces_count'
export type SortDirection = 'asc' | 'desc'

export interface ImagesFilter {
  search: string
  hasText: 'all' | 'true' | 'false'
  hasFaces: 'all' | 'true' | 'false'
  dateRange: 'all' | 'week' | 'month' | 'year'
}

const INITIAL_FILTER: ImagesFilter = {
  search: '',
  hasText: 'all',
  hasFaces: 'all',
  dateRange: 'all'
}

export function useImagesDatabase() {
  const [images, setImages] = useState<Image[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [filter, setFilter] = useState<ImagesFilter>(INITIAL_FILTER)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [editingImage, setEditingImage] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Image>>({})
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
  const [previewImage, setPreviewImage] = useState<Image | null>(null)
  const [tagSuggestions, setTagSuggestions] = useState<{[key: string]: any[]}>({})
  const [loadingSuggestions, setLoadingSuggestions] = useState<{[key: string]: boolean}>({})
  const [newTagInput, setNewTagInput] = useState<{[key: string]: string}>({})
  const [loadingStockPhoto, setLoadingStockPhoto] = useState<{[key: string]: boolean}>({})

  useEffect(() => {
    fetchImages()
  }, [])

  const fetchImages = async () => {
    try {
      const response = await fetch('/api/images')
      if (response.ok) {
        const data = await response.json()
        setImages(data.images || [])
      }
    } catch (error) {
      console.error('Failed to fetch images:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredAndSortedImages = useMemo(() => {
    let filtered = images.filter(image => {
      if (filter.search) {
        const searchLower = filter.search.toLowerCase()
        const matchesCaption = image.ai_caption?.toLowerCase().includes(searchLower)
        const matchesAltText = image.ai_alt_text?.toLowerCase().includes(searchLower)
        const matchesTags = image.ai_tags?.some(tag => tag.toLowerCase().includes(searchLower))
        const matchesOCR = image.ocr_text?.toLowerCase().includes(searchLower)
        const matchesEntities = image.ocr_entities?.some(entity => entity.name.toLowerCase().includes(searchLower))
        if (!matchesCaption && !matchesAltText && !matchesTags && !matchesOCR && !matchesEntities) return false
      }

      if (filter.hasText !== 'all') {
        const hasText = filter.hasText === 'true'
        if (image.has_text !== hasText) return false
      }

      if (filter.hasFaces !== 'all') {
        const hasFaces = filter.hasFaces === 'true'
        const imageHasFaces = (image.faces_count || 0) > 0
        if (imageHasFaces !== hasFaces) return false
      }

      if (filter.dateRange !== 'all') {
        const now = new Date()
        const imageDate = new Date(image.created_at)
        let cutoff = new Date()

        switch (filter.dateRange) {
          case 'week':
            cutoff.setDate(now.getDate() - 7)
            break
          case 'month':
            cutoff.setMonth(now.getMonth() - 1)
            break
          case 'year':
            cutoff.setFullYear(now.getFullYear() - 1)
            break
        }

        if (imageDate < cutoff) return false
      }

      return true
    })

    filtered.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortField) {
        case 'ai_caption':
          aValue = a.ai_caption || ''
          bValue = b.ai_caption || ''
          break
        case 'created_at':
          aValue = new Date(a.created_at)
          bValue = new Date(b.created_at)
          break
        case 'safe_score':
          aValue = a.safe_score || 0
          bValue = b.safe_score || 0
          break
        case 'faces_count':
          aValue = a.faces_count || 0
          bValue = b.faces_count || 0
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [images, filter, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleEdit = (image: Image) => {
    setEditingImage(image.id)
    setEditData({
      ai_caption: image.ai_caption,
      ai_alt_text: image.ai_alt_text,
      ai_tags: image.ai_tags,
      credit: image.credit,
      city: image.city,
      source: image.source
    })
  }

  const handleCancelEdit = () => {
    setEditingImage(null)
    setEditData({})
  }

  const handleSaveEdit = async (imageId: string) => {
    setUpdating(true)
    try {
      const response = await fetch('/api/images/review/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id: imageId, ...editData })
      })

      if (response.ok) {
        setImages(images.map(img =>
          img.id === imageId
            ? { ...img, ...editData, updated_at: new Date().toISOString() }
            : img
        ))
        setEditingImage(null)
        setEditData({})
      } else {
        const errorData = await response.json()
        alert(`Failed to update image: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Update error:', error)
      alert('Failed to update image')
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      return
    }

    setDeleting(imageId)
    try {
      const response = await fetch(`/api/images/${imageId}`, { method: 'DELETE' })

      if (response.ok) {
        setImages(images.filter(img => img.id !== imageId))
      } else {
        const errorData = await response.json()
        alert(`Failed to delete image: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete image')
    } finally {
      setDeleting(null)
    }
  }

  const handleSelectImage = (imageId: string, selected: boolean) => {
    const newSelected = new Set(selectedImages)
    if (selected) {
      newSelected.add(imageId)
    } else {
      newSelected.delete(imageId)
    }
    setSelectedImages(newSelected)
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedImages(new Set(filteredAndSortedImages.map(img => img.id)))
    } else {
      setSelectedImages(new Set())
    }
  }

  const fetchTagSuggestions = async (input: string, imageId: string) => {
    if (input.length < 2) {
      setTagSuggestions(prev => ({ ...prev, [imageId]: [] }))
      return
    }

    setLoadingSuggestions(prev => ({ ...prev, [imageId]: true }))

    try {
      const response = await fetch('/api/tags/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input })
      })

      if (response.ok) {
        const data = await response.json()
        setTagSuggestions(prev => ({ ...prev, [imageId]: data.suggestions || [] }))
      }
    } catch (error) {
      console.error('Failed to fetch tag suggestions:', error)
      setTagSuggestions(prev => ({ ...prev, [imageId]: [] }))
    } finally {
      setLoadingSuggestions(prev => ({ ...prev, [imageId]: false }))
    }
  }

  const addSuggestedTag = (imageId: string, formattedTag: string) => {
    const currentTags = editData.ai_tags || []
    if (!currentTags.includes(formattedTag)) {
      setEditData({ ...editData, ai_tags: [...currentTags, formattedTag] })
    }
    setTagSuggestions(prev => ({ ...prev, [imageId]: [] }))
  }

  const addManualTag = (imageId: string) => {
    const newTag = (newTagInput[imageId] || '').trim().toLowerCase()
    const currentTags = editData.ai_tags || []
    if (newTag && !currentTags.includes(newTag)) {
      setEditData({ ...editData, ai_tags: [...currentTags, newTag] })
      setNewTagInput(prev => ({ ...prev, [imageId]: '' }))
      setTagSuggestions(prev => ({ ...prev, [imageId]: [] }))
    }
  }

  const handleStockPhotoLookup = async (imageId: string) => {
    setLoadingStockPhoto(prev => ({ ...prev, [imageId]: true }))
    try {
      const response = await fetch('/api/images/reverse-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id: imageId })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.results && data.results.length > 0) {
          const bestResult = data.results[0]

          const updates: any = {}
          if (bestResult.source_url) updates.source_url = bestResult.source_url
          if (bestResult.source_name) updates.source = bestResult.source_name
          if (bestResult.license_info) updates.license = bestResult.license_info
          if (bestResult.creator) updates.credit = bestResult.creator

          setEditData(prev => ({ ...prev, ...updates }))
          alert(`Found ${data.results.length} potential source(s). Best match auto-populated.`)
        } else {
          alert('No stock photo sources found for this image.')
        }
      } else {
        const errorData = await response.json()
        alert(`Lookup failed: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Stock photo lookup error:', error)
      alert('Failed to perform reverse image lookup. Please try again.')
    } finally {
      setLoadingStockPhoto(prev => ({ ...prev, [imageId]: false }))
    }
  }

  return {
    // Data
    images,
    loading,
    filter,
    setFilter,
    sortField,
    sortDirection,
    filteredAndSortedImages,
    showUploadModal,
    setShowUploadModal,
    editingImage,
    editData,
    setEditData,
    updating,
    deleting,
    selectedImages,
    previewImage,
    setPreviewImage,
    tagSuggestions,
    setTagSuggestions,
    loadingSuggestions,
    newTagInput,
    setNewTagInput,
    loadingStockPhoto,

    // Handlers
    fetchImages,
    handleSort,
    handleEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleDelete,
    handleSelectImage,
    handleSelectAll,
    fetchTagSuggestions,
    addSuggestedTag,
    addManualTag,
    handleStockPhotoLookup,
  }
}
