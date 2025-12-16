'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ChevronDown } from 'lucide-react'
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { getCroppedImage } from '@/utils/imageCrop'

// Simplified type for edit modal - works with transformed ai_applications data
interface ProfileTool {
  id: string
  tool_name: string
  description: string | null
  website_url: string
  tool_image_url: string | null
  logo_image_url: string | null
  is_sponsored: boolean
  is_featured?: boolean
  listing_type?: 'free' | 'paid_placement' | 'featured'
  status: string
  rejection_reason: string | null
  view_count: number
  click_count: number
  clerk_user_id: string | null
  categories: { id: string; name: string; slug: string }[]
}

interface CategoryWithStatus {
  id: string
  name: string
  slug: string
  hasFeatured?: boolean
  isDisabled?: boolean
  disabledReason?: string | null
}

interface EditProfileModalProps {
  tool: ProfileTool
  isOpen: boolean
  onClose: () => void
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) {
  return centerCrop(
    makeAspectCrop(
      { unit: '%', width: 90 },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  )
}

export function EditProfileModal({ tool, isOpen, onClose }: EditProfileModalProps) {
  const [formData, setFormData] = useState({
    toolName: tool.tool_name,
    description: tool.description || '',
    websiteUrl: tool.website_url,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<CategoryWithStatus[]>([])
  // Single category selection - use name to match ai_applications.category field
  const [selectedCategory, setSelectedCategory] = useState<string>(
    tool.categories[0]?.name || ''
  )

  // Image state
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [listingBlob, setListingBlob] = useState<Blob | null>(null)
  const [listingPreview, setListingPreview] = useState<string | null>(null)

  // Fetch categories on mount
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/tools/categories')
        const data = await res.json()
        if (data.categories) {
          setCategories(data.categories)
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err)
      }
    }
    if (isOpen) {
      fetchCategories()
    }
  }, [isOpen])

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(e.target.value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedCategory) {
      setError('Please select a category')
      return
    }

    setIsSubmitting(true)

    try {
      // Upload images if changed
      let logoFileName = ''
      let listingFileName = ''

      if (logoBlob) {
        logoFileName = `${tool.clerk_user_id}/logo-${Date.now()}.jpg`
        const formDataUpload = new FormData()
        formDataUpload.append('file', logoBlob, 'logo.jpg')
        const uploadRes = await fetch(`/api/tools/upload-image?fileName=${encodeURIComponent(logoFileName)}`, {
          method: 'POST',
          body: formDataUpload
        })
        if (!uploadRes.ok) throw new Error('Failed to upload logo')
      }

      if (listingBlob) {
        listingFileName = `${tool.clerk_user_id}/listing-${Date.now()}.jpg`
        const formDataUpload = new FormData()
        formDataUpload.append('file', listingBlob, 'listing.jpg')
        const uploadRes = await fetch(`/api/tools/upload-image?fileName=${encodeURIComponent(listingFileName)}`, {
          method: 'POST',
          body: formDataUpload
        })
        if (!uploadRes.ok) throw new Error('Failed to upload listing image')
      }

      // Update profile
      const res = await fetch('/api/account/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: tool.id,
          ...formData,
          category: selectedCategory,
          logoFileName: logoFileName || undefined,
          listingFileName: listingFileName || undefined,
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update profile')
      }

      // Refresh page to show updated data
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-bold text-slate-900">Edit Profile</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Tool Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tool Name *
            </label>
            <input
              type="text"
              required
              value={formData.toolName}
              onChange={(e) => setFormData(prev => ({ ...prev, toolName: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isSubmitting}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description *
            </label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isSubmitting}
            />
          </div>

          {/* Website URL */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Website URL *
            </label>
            <input
              type="url"
              required
              value={formData.websiteUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, websiteUrl: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isSubmitting}
            />
          </div>

          {/* Category - Dropdown Select */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Category *
            </label>
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={handleCategoryChange}
                disabled={isSubmitting}
                className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
              >
                <option value="">Select a category</option>
                {categories.map(category => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Images */}
          <div className="grid grid-cols-2 gap-6">
            {/* Logo */}
            <ImageUploadField
              label="Logo Image"
              currentUrl={tool.logo_image_url}
              aspectRatio={1}
              aspectLabel="1:1 square"
              previewSize={{ width: 100, height: 100 }}
              preview={logoPreview}
              onCropComplete={(blob) => {
                setLogoBlob(blob)
                setLogoPreview(URL.createObjectURL(blob))
              }}
              onClear={() => {
                setLogoBlob(null)
                setLogoPreview(null)
              }}
              disabled={isSubmitting}
            />

            {/* Listing Image */}
            <ImageUploadField
              label="Listing Image"
              currentUrl={tool.tool_image_url}
              aspectRatio={16 / 9}
              aspectLabel="16:9 wide"
              previewSize={{ width: 160, height: 90 }}
              preview={listingPreview}
              onCropComplete={(blob) => {
                setListingBlob(blob)
                setListingPreview(URL.createObjectURL(blob))
              }}
              onClear={() => {
                setListingBlob(null)
                setListingPreview(null)
              }}
              disabled={isSubmitting}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-full font-medium hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-full font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Image Upload Field Component
interface ImageUploadFieldProps {
  label: string
  currentUrl: string | null
  aspectRatio: number
  aspectLabel: string
  previewSize: { width: number; height: number }
  preview: string | null
  onCropComplete: (blob: Blob) => void
  onClear: () => void
  disabled?: boolean
}

function ImageUploadField({
  label,
  currentUrl,
  aspectRatio,
  aspectLabel,
  previewSize,
  preview,
  onCropComplete,
  onClear,
  disabled
}: ImageUploadFieldProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const imgRef = useRef<HTMLImageElement>(null)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        setSelectedImage(reader.result as string)
        setCrop(undefined)
        setCompletedCrop(undefined)
      }
      reader.readAsDataURL(file)
    }
  }

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    setCrop(centerAspectCrop(width, height, aspectRatio))
  }

  const handleApplyCrop = async () => {
    if (!completedCrop || !imgRef.current) return
    try {
      const croppedBlob = await getCroppedImage(imgRef.current, completedCrop)
      if (croppedBlob) {
        onCropComplete(croppedBlob)
        setSelectedImage(null)
      }
    } catch (err) {
      console.error('Failed to crop image:', err)
    }
  }

  const displayUrl = preview || currentUrl

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>

      {displayUrl && !selectedImage && (
        <div className="flex items-center gap-3 mb-2">
          <img
            src={displayUrl}
            alt={label}
            className="rounded-lg object-cover border border-slate-200"
            style={{ width: previewSize.width, height: previewSize.height }}
          />
          <button
            type="button"
            onClick={() => document.getElementById(`upload-${label}`)?.click()}
            className="text-sm text-blue-600 hover:underline"
            disabled={disabled}
          >
            Replace
          </button>
        </div>
      )}

      {!displayUrl && !selectedImage && (
        <label
          className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-600 transition-colors"
          style={{ width: previewSize.width, height: previewSize.height }}
        >
          <span className="text-sm text-slate-500">Upload</span>
          <input
            id={`upload-${label}`}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
            disabled={disabled}
          />
        </label>
      )}

      <input
        id={`upload-${label}`}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
        disabled={disabled}
      />

      {selectedImage && (
        <div className="space-y-3">
          <div className="border rounded-lg p-3 bg-slate-50">
            <p className="text-xs text-slate-600 mb-2">Crop to {aspectLabel}</p>
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspectRatio}
            >
              <img
                ref={imgRef}
                src={selectedImage}
                alt="Crop preview"
                onLoad={onImageLoad}
                style={{ maxWidth: '100%', maxHeight: '200px' }}
              />
            </ReactCrop>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApplyCrop}
              disabled={!completedCrop}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-full text-sm hover:bg-blue-500 disabled:opacity-50"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedImage(null)
                setCrop(undefined)
                setCompletedCrop(undefined)
              }}
              className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-full text-sm hover:bg-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
