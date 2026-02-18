'use client'

import { useState, useRef } from 'react'
import type { FeedbackTeamMember } from '@/types/database'

interface TeamPhotoManagerProps {
  photos: FeedbackTeamMember[]
  onChange: (photos: FeedbackTeamMember[]) => void
  maxPhotos?: number
  disabled?: boolean
}

export function TeamPhotoManager({ photos, onChange, maxPhotos = 10, disabled = false }: TeamPhotoManagerProps) {
  const [uploading, setUploading] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (photos.length >= maxPhotos) {
      alert(`Maximum ${maxPhotos} team photos allowed`)
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB')
      return
    }

    setUploading(true)

    try {
      // Upload to GitHub storage
      const formData = new FormData()
      formData.append('image', file)
      formData.append('type', 'team-photo')

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.url) {
        const newPhoto: FeedbackTeamMember = {
          name: '',
          image_url: data.url
        }
        onChange([...photos, newPhoto])
      } else {
        throw new Error(data.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Failed to upload image. Please try again.')
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const updatePhoto = (index: number, updates: Partial<FeedbackTeamMember>) => {
    const newPhotos = [...photos]
    newPhotos[index] = { ...newPhotos[index], ...updates }
    onChange(newPhotos)
  }

  const removePhoto = (index: number) => {
    onChange(photos.filter((_, i) => i !== index))
  }

  const movePhoto = (index: number, direction: 'left' | 'right') => {
    const newIndex = direction === 'left' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= photos.length) return

    const newPhotos = [...photos]
    const [removed] = newPhotos.splice(index, 1)
    newPhotos.splice(newIndex, 0, removed)
    onChange(newPhotos)
  }

  return (
    <div className="space-y-4">
      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-4">
          {photos.map((photo, index) => (
            <div key={index} className="relative group">
              {/* Photo */}
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100">
                <img
                  src={photo.image_url}
                  alt={photo.name || 'Team member'}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Edit/Delete overlay */}
              <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute inset-0 bg-black bg-opacity-40 rounded-full" />
                <button
                  onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                  className="relative z-10 p-1 bg-white rounded-full text-gray-700 hover:bg-gray-100"
                  title="Edit name"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => removePhoto(index)}
                  className="relative z-10 p-1 bg-white rounded-full text-red-600 hover:bg-gray-100"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Move buttons */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {index > 0 && (
                  <button
                    onClick={() => movePhoto(index, 'left')}
                    className="p-0.5 bg-white border border-gray-300 rounded text-gray-500 hover:text-gray-700"
                    title="Move left"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                {index < photos.length - 1 && (
                  <button
                    onClick={() => movePhoto(index, 'right')}
                    className="p-0.5 bg-white border border-gray-300 rounded text-gray-500 hover:text-gray-700"
                    title="Move right"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Name input (when editing) */}
              {editingIndex === index && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-20">
                  <input
                    type="text"
                    value={photo.name}
                    onChange={(e) => updatePhoto(index, { name: e.target.value })}
                    onBlur={() => setEditingIndex(null)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingIndex(null)}
                    autoFocus
                    placeholder="Name"
                    className="w-32 px-2 py-1 text-sm border border-gray-300 rounded shadow-lg focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              )}

              {/* Name display */}
              {photo.name && editingIndex !== index && (
                <p className="mt-1 text-xs text-center text-gray-600 truncate w-20">
                  {photo.name}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Photo Button */}
      {photos.length < maxPhotos && (
        <div className="flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-cyan-500 hover:text-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-600"></div>
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Team Photo</span>
              </>
            )}
          </button>
          <span className="text-sm text-gray-500">
            {photos.length} / {maxPhotos} photos
          </span>
        </div>
      )}

      {photos.length === 0 && (
        <p className="text-sm text-gray-400 italic">
          No team photos added yet. Click &quot;Add Team Photo&quot; to add your first one.
        </p>
      )}
    </div>
  )
}
