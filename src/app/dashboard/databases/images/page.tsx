'use client'

import { useEffect, useState, useMemo } from 'react'
import Layout from '@/components/Layout'
import ImageUpload from '@/components/ImageUpload'
import { Image, ImageTag, ImageSearchFilters } from '@/types/database'

type SortField = 'ai_caption' | 'created_at' | 'safe_score' | 'faces_count'
type SortDirection = 'asc' | 'desc'

interface ImagesFilter {
  search: string
  hasText: 'all' | 'true' | 'false'
  hasFaces: 'all' | 'true' | 'false'
  dateRange: 'all' | 'week' | 'month' | 'year'
}

export default function ImagesDatabasePage() {
  const [images, setImages] = useState<Image[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [filter, setFilter] = useState<ImagesFilter>({
    search: '',
    hasText: 'all',
    hasFaces: 'all',
    dateRange: 'all'
  })
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
      // Search filter (caption, alt text, tags, OCR text)
      if (filter.search) {
        const searchLower = filter.search.toLowerCase()
        const matchesCaption = image.ai_caption?.toLowerCase().includes(searchLower)
        const matchesAltText = image.ai_alt_text?.toLowerCase().includes(searchLower)
        const matchesTags = image.ai_tags?.some(tag => tag.toLowerCase().includes(searchLower))
        const matchesOCR = image.ocr_text?.toLowerCase().includes(searchLower)
        const matchesEntities = image.ocr_entities?.some(entity => entity.name.toLowerCase().includes(searchLower))
        if (!matchesCaption && !matchesAltText && !matchesTags && !matchesOCR && !matchesEntities) return false
      }

      // Text filter
      if (filter.hasText !== 'all') {
        const hasText = filter.hasText === 'true'
        if (image.has_text !== hasText) return false
      }

      // Faces filter
      if (filter.hasFaces !== 'all') {
        const hasFaces = filter.hasFaces === 'true'
        const imageHasFaces = (image.faces_count || 0) > 0
        if (imageHasFaces !== hasFaces) return false
      }

      // Date range filter
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

    // Sort
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_id: imageId,
          ...editData
        })
      })

      if (response.ok) {
        // Update the image in local state
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
      const response = await fetch(`/api/images/${imageId}`, {
        method: 'DELETE'
      })

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

          // Auto-populate the source fields in editData
          const updates: any = {}
          if (bestResult.source_url) {
            updates.source_url = bestResult.source_url
          }
          if (bestResult.source_name) {
            updates.source = bestResult.source_name
          }
          if (bestResult.license_info) {
            updates.license = bestResult.license_info
          }
          if (bestResult.creator) {
            updates.credit = bestResult.creator
          }

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

  const renderTagBadges = (tags: string[] | null, tagsScored: ImageTag[] | null) => {
    if (!tags || tags.length === 0) return null

    return (
      <div className="flex flex-wrap gap-1 max-w-xs">
        {tags.slice(0, 5).map((tag, index) => {
          const scoredTag = tagsScored?.find(t => `${t.type}_${t.name}` === tag)
          const confidence = scoredTag ? Math.round(scoredTag.conf * 100) : null

          return (
            <span
              key={index}
              className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
              title={confidence ? `Confidence: ${confidence}%` : undefined}
            >
              {tag.replace('_', ': ')}
            </span>
          )
        })}
        {tags.length > 5 && (
          <span className="text-xs text-gray-500">+{tags.length - 5} more</span>
        )}
      </div>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Images Database</h1>
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Upload Images
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                placeholder="Search captions, tags..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Has Text
              </label>
              <select
                value={filter.hasText}
                onChange={(e) => setFilter({ ...filter, hasText: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Has Faces
              </label>
              <select
                value={filter.hasFaces}
                onChange={(e) => setFilter({ ...filter, hasFaces: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="text-sm text-gray-600">
          Showing {filteredAndSortedImages.length} of {images.length} images
          {selectedImages.size > 0 && (
            <span className="ml-4 font-medium">
              {selectedImages.size} selected
            </span>
          )}
        </div>

        {/* Images Table */}
        {loading ? (
          <div className="text-center py-8">Loading images...</div>
        ) : filteredAndSortedImages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No images found matching your filters.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedImages.size === filteredAndSortedImages.length && filteredAndSortedImages.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Preview
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('ai_caption')}
                  >
                    Caption {sortField === 'ai_caption' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tags
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    City
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Info
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedImages.map((image) => (
                  <tr key={image.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedImages.has(image.id)}
                        onChange={(e) => handleSelectImage(image.id, e.target.checked)}
                        className="w-4 h-4"
                      />
                    </td>

                    <td className="px-4 py-4">
                      <img
                        src={image.variant_16x9_url || image.cdn_url}
                        alt={image.ai_alt_text || 'Image'}
                        className="w-24 h-16 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setPreviewImage(image)}
                        onError={(e) => {
                          e.currentTarget.src = image.cdn_url || '/placeholder-image.png'
                        }}
                        title="Click to view full size"
                      />
                    </td>

                    <td className="px-4 py-4">
                      {editingImage === image.id ? (
                        <textarea
                          value={editData.ai_caption || ''}
                          onChange={(e) => setEditData({ ...editData, ai_caption: e.target.value })}
                          placeholder="Caption"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          rows={3}
                        />
                      ) : (
                        <div className="text-sm text-gray-900 max-w-xs">
                          {image.ai_caption || 'No caption'}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {editingImage === image.id ? (
                        <div className="max-w-xs space-y-2">
                          {/* Existing tags as removable buttons */}
                          <div className="flex flex-wrap gap-1">
                            {(editData.ai_tags || []).map((tag, index) => (
                              <button
                                key={index}
                                onClick={() => {
                                  const newTags = editData.ai_tags?.filter((_, i) => i !== index) || []
                                  setEditData({ ...editData, ai_tags: newTags })
                                }}
                                className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 hover:bg-red-100 hover:text-red-800 transition-colors"
                                title="Click to remove"
                              >
                                {tag}
                                <span className="ml-1">×</span>
                              </button>
                            ))}
                          </div>

                          {/* Add new tag input with AI suggestions */}
                          <div className="space-y-2">
                            <div className="flex space-x-1">
                              <input
                                type="text"
                                placeholder="Describe what you see in the image..."
                                value={newTagInput[image.id] || ''}
                                onChange={(e) => {
                                  const value = e.target.value
                                  setNewTagInput(prev => ({ ...prev, [image.id]: value }))
                                }}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    const newTag = (newTagInput[image.id] || '').trim()
                                    if (newTag) {
                                      fetchTagSuggestions(newTag, image.id)
                                    }
                                  }
                                }}
                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                              />
                              <button
                                onClick={() => {
                                  const newTag = (newTagInput[image.id] || '').trim()
                                  if (newTag) {
                                    fetchTagSuggestions(newTag, image.id)
                                  }
                                }}
                                className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
                              >
                                Suggest
                              </button>
                            </div>

                            {/* AI Tag Suggestions */}
                            {(tagSuggestions[image.id] && tagSuggestions[image.id].length > 0) && (
                              <div className="border border-gray-200 rounded bg-white shadow-sm p-2 max-h-32 overflow-y-auto">
                                <div className="flex justify-between items-center mb-1">
                                  <div className="text-xs text-gray-500">AI Suggestions:</div>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => addManualTag(image.id)}
                                      className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded hover:bg-gray-200"
                                      title="Add as typed"
                                    >
                                      Add "{(newTagInput[image.id] || '').trim()}"
                                    </button>
                                    <button
                                      onClick={() => setTagSuggestions(prev => ({ ...prev, [image.id]: [] }))}
                                      className="text-xs text-gray-400 hover:text-gray-600"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {tagSuggestions[image.id].map((suggestion: any, idx: number) => (
                                    <button
                                      key={idx}
                                      onClick={() => addSuggestedTag(image.id, suggestion.formatted_tag)}
                                      className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 transition-colors"
                                      title={`Confidence: ${Math.round(suggestion.confidence * 100)}%`}
                                    >
                                      {suggestion.display_name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {loadingSuggestions[image.id] && (
                              <div className="text-xs text-gray-500">
                                Getting AI suggestions...
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="max-w-xs">
                          {renderTagBadges(image.ai_tags, image.ai_tags_scored)}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {editingImage === image.id ? (
                        <input
                          type="text"
                          value={editData.city || ''}
                          onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                          placeholder="City"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        <div className="text-sm text-gray-900">
                          {image.city || '-'}
                        </div>
                      )}
                    </td>



                    <td className="px-4 py-4">
                      {editingImage === image.id ? (
                        <div className="text-sm space-y-2 max-w-xs">
                          {/* Source field in edit mode */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Source:</label>
                            <input
                              type="text"
                              value={editData.source || ''}
                              onChange={(e) => setEditData({ ...editData, source: e.target.value })}
                              placeholder="Source"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            />
                          </div>
                          {/* Credit field in edit mode */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Credit:</label>
                            <input
                              type="text"
                              value={editData.credit || ''}
                              onChange={(e) => setEditData({ ...editData, credit: e.target.value })}
                              placeholder="Photographer/Creator"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {image.source && (
                              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-medium">
                                {image.source}
                              </span>
                            )}
                            {image.faces_count > 0 && (
                              <span className="bg-purple-100 text-purple-800 px-1 py-0.5 rounded text-xs">
                                {image.faces_count} face{image.faces_count !== 1 ? 's' : ''}
                              </span>
                            )}
                            {image.age_groups && image.age_groups.length > 0 && (
                              <>
                                {image.age_groups.map((ageGroup, idx) => (
                                  <span
                                    key={idx}
                                    className={`px-1 py-0.5 rounded text-xs ${
                                      ageGroup.age_group === 'preschool' ? 'bg-pink-100 text-pink-800' :
                                      ageGroup.age_group === 'elementary' ? 'bg-green-100 text-green-800' :
                                      ageGroup.age_group === 'high_school' ? 'bg-blue-100 text-blue-800' :
                                      ageGroup.age_group === 'adult' ? 'bg-indigo-100 text-indigo-800' :
                                      ageGroup.age_group === 'older_adult' ? 'bg-gray-100 text-gray-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}
                                    title={`${Math.round(ageGroup.conf * 100)}% confidence`}
                                  >
                                    {ageGroup.count} {ageGroup.age_group}
                                  </span>
                                ))}
                              </>
                            )}
                          </div>
                          {image.credit && (
                            <div className="text-xs text-gray-600">
                              <span className="font-medium">Credit:</span> {image.credit}
                            </div>
                          )}
                          {image.ocr_text && (
                            <div className="mt-1 p-1 bg-gray-50 rounded text-xs max-w-xs">
                              <span className="font-medium">OCR:</span> {image.ocr_text.substring(0, 100)}{image.ocr_text.length > 100 ? '...' : ''}
                            </div>
                          )}
                          {image.ocr_entities && image.ocr_entities.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {image.ocr_entities.map((entity, idx) => (
                                <span
                                  key={idx}
                                  className={`px-1 py-0.5 rounded text-xs ${
                                    entity.type === 'ORG' ? 'bg-red-100 text-red-800' :
                                    entity.type === 'PERSON' ? 'bg-yellow-100 text-yellow-800' :
                                    entity.type === 'LOC' ? 'bg-green-100 text-green-800' :
                                    entity.type === 'DATE' ? 'bg-blue-100 text-blue-800' :
                                    entity.type === 'TIME' ? 'bg-purple-100 text-purple-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}
                                  title={`${entity.type}: ${Math.round(entity.conf * 100)}% confidence`}
                                >
                                  {entity.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {editingImage === image.id ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(image.id)}
                              disabled={updating}
                              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                            >
                              {updating ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                          <button
                            onClick={() => handleStockPhotoLookup(image.id)}
                            disabled={loadingStockPhoto[image.id]}
                            className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Find original stock photo source"
                          >
                            {loadingStockPhoto[image.id] ? 'Looking up...' : 'Stock Photo'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(image)}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(image.id)}
                            disabled={deleting === image.id}
                            className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 disabled:opacity-50"
                          >
                            {deleting === image.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <ImageUpload
          onComplete={(results) => {
            const successfulUploads = results.filter(r => r.status === 'completed')
            if (successfulUploads.length > 0) {
              // Refresh the images list
              fetchImages()
            }
          }}
          onClose={() => setShowUploadModal(false)}
          maxFiles={10}
          maxSizeBytes={10 * 1024 * 1024}
        />
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="relative max-w-4xl max-h-[90vh] mx-4">
            {/* Close button */}
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold z-10"
              title="Close preview"
            >
              ×
            </button>

            {/* Image */}
            <img
              src={previewImage.variant_16x9_url || previewImage.cdn_url}
              alt={previewImage.ai_alt_text || 'Image preview'}
              className="max-w-full max-h-[90vh] object-contain rounded shadow-lg"
            />

            {/* Image info */}
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-4 rounded-b">
              <div className="text-sm">
                <p className="font-semibold">{previewImage.ai_caption || 'No caption'}</p>
                {previewImage.city && (
                  <p className="text-gray-300">📍 {previewImage.city}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  <span>{previewImage.width} × {previewImage.height}px</span>
                  {previewImage.has_text && <span>📝 Contains text</span>}
                  {previewImage.faces_count > 0 && <span>👤 {previewImage.faces_count} face(s)</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Click outside to close */}
          <div
            className="absolute inset-0 -z-10"
            onClick={() => setPreviewImage(null)}
          ></div>
        </div>
      )}
    </Layout>
  )
}