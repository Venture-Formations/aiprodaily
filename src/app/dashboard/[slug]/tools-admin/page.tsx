'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { getCroppedImage } from '@/utils/imageCrop'

interface Tool {
  id: string
  tool_name: string
  tagline: string | null
  description: string
  website_url: string
  tool_image_url: string | null
  logo_image_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  plan: 'free' | 'monthly' | 'yearly'
  is_sponsored: boolean
  is_featured: boolean
  submitter_email: string
  submitter_name: string | null
  created_at: string
  rejection_reason: string | null
  categories: { id: string; name: string; slug: string }[]
}

interface Category {
  id: string
  name: string
  slug: string
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

// Helper to check if a URL is valid
const isValidImageUrl = (url: string | null): boolean => {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export default function ToolsAdminPage() {
  const params = useParams()
  const [tools, setTools] = useState<Tool[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [editingTool, setEditingTool] = useState<Tool | null>(null)

  // Fetch categories once on mount
  useEffect(() => {
    fetchCategories()
  }, [])

  // Fetch tools when filter changes
  useEffect(() => {
    fetchTools()
  }, [filter])

  async function fetchTools() {
    setLoading(true)
    try {
      const res = await fetch(`/api/tools/admin?status=${filter}`)
      const data = await res.json()
      if (data.success) {
        setTools(data.tools)
      }
    } catch (error) {
      console.error('Failed to fetch tools:', error)
    }
    setLoading(false)
  }

  async function fetchCategories() {
    try {
      const res = await fetch('/api/tools/categories')
      const data = await res.json()
      if (data.categories) {
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  async function handleApprove(toolId: string) {
    setActionLoading(toolId)
    try {
      const res = await fetch('/api/tools/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId })
      })
      if (res.ok) {
        fetchTools()
      }
    } catch (error) {
      console.error('Failed to approve tool:', error)
    }
    setActionLoading(null)
  }

  async function handleReject(toolId: string) {
    if (!rejectReason.trim()) {
      alert('Please provide a rejection reason')
      return
    }
    setActionLoading(toolId)
    try {
      const res = await fetch('/api/tools/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, reason: rejectReason })
      })
      if (res.ok) {
        setRejectingId(null)
        setRejectReason('')
        fetchTools()
      }
    } catch (error) {
      console.error('Failed to reject tool:', error)
    }
    setActionLoading(null)
  }

  async function handleDelete(toolId: string) {
    if (!confirm('Are you sure you want to delete this tool? This cannot be undone.')) {
      return
    }
    setActionLoading(toolId)
    try {
      const res = await fetch('/api/tools/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId })
      })
      if (res.ok) {
        fetchTools()
      }
    } catch (error) {
      console.error('Failed to delete tool:', error)
    }
    setActionLoading(null)
  }

  async function handleToggleFeatured(toolId: string, currentValue: boolean) {
    setActionLoading(toolId)
    try {
      const res = await fetch('/api/tools/admin/toggle-featured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, isFeatured: !currentValue })
      })
      if (res.ok) {
        fetchTools()
      }
    } catch (error) {
      console.error('Failed to toggle featured:', error)
    }
    setActionLoading(null)
  }

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800'
  }

  const planLabels = {
    free: 'Free',
    monthly: 'Monthly Sponsor',
    yearly: 'Yearly Sponsor'
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tools Directory Admin</h1>
        <p className="text-gray-600 mt-1">Review and manage tool submissions</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Tools List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading tools...</p>
        </div>
      ) : tools.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No {filter === 'all' ? '' : filter} tools found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tools.map((tool) => (
            <div key={tool.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex gap-4">
                {/* Images - Logo (1:1) and Listing (16:9) */}
                <div className="flex-shrink-0 flex gap-2">
                  {/* Logo */}
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Logo</p>
                    {isValidImageUrl(tool.logo_image_url) ? (
                      <Image
                        src={tool.logo_image_url!}
                        alt={`${tool.tool_name} logo`}
                        width={64}
                        height={64}
                        className="rounded-lg object-cover"
                        style={{ width: '64px', height: '64px' }}
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                        <span className="text-xl text-gray-400">
                          {tool.tool_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Listing Image */}
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Listing</p>
                    {isValidImageUrl(tool.tool_image_url) ? (
                      <Image
                        src={tool.tool_image_url!}
                        alt={tool.tool_name}
                        width={114}
                        height={64}
                        className="rounded-lg object-cover"
                        style={{ width: '114px', height: '64px' }}
                      />
                    ) : (
                      <div className="w-[114px] h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                        <span className="text-xs text-gray-400">No image</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tool Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{tool.tool_name}</h3>
                      {tool.tagline && (
                        <p className="text-sm text-gray-600 mt-0.5">{tool.tagline}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[tool.status]}`}>
                        {tool.status}
                      </span>
                      {tool.is_sponsored && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                          {planLabels[tool.plan]}
                        </span>
                      )}
                      {tool.is_featured && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          Featured
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-gray-700 mt-2 line-clamp-2">{tool.description}</p>

                  <div className="flex flex-wrap gap-2 mt-2">
                    {tool.categories.map((cat) => (
                      <span key={cat.id} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                        {cat.name}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                    <a
                      href={tool.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {tool.website_url}
                    </a>
                    <span>|</span>
                    <span>Submitted by: {tool.submitter_name || tool.submitter_email}</span>
                    <span>|</span>
                    <span>{new Date(tool.created_at).toLocaleDateString()}</span>
                  </div>

                  {tool.rejection_reason && (
                    <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                      <strong>Rejection reason:</strong> {tool.rejection_reason}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                {tool.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleApprove(tool.id)}
                      disabled={actionLoading === tool.id}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === tool.id ? 'Processing...' : 'Approve'}
                    </button>
                    {rejectingId === tool.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Rejection reason..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <button
                          onClick={() => handleReject(tool.id)}
                          disabled={actionLoading === tool.id}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => {
                            setRejectingId(null)
                            setRejectReason('')
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRejectingId(tool.id)}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        Reject
                      </button>
                    )}
                  </>
                )}

                {tool.status === 'approved' && (
                  <button
                    onClick={() => handleToggleFeatured(tool.id, tool.is_featured)}
                    disabled={actionLoading === tool.id}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      tool.is_featured
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tool.is_featured ? 'Remove Featured' : 'Make Featured'}
                  </button>
                )}

                <button
                  onClick={() => setEditingTool(tool)}
                  disabled={actionLoading === tool.id}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  Edit
                </button>

                <button
                  onClick={() => handleDelete(tool.id)}
                  disabled={actionLoading === tool.id}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors ml-auto"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Tool Modal */}
      {editingTool && (
        <EditToolModal
          key={editingTool.id}
          tool={editingTool}
          categories={categories}
          onClose={() => setEditingTool(null)}
          onSuccess={() => {
            setEditingTool(null)
            fetchTools()
          }}
        />
      )}
    </div>
  )
}

// Image Upload Component for the Edit Modal
interface ImageUploadSectionProps {
  label: string
  currentUrl: string | null
  aspectRatio: number
  aspectLabel: string
  previewSize: { width: number; height: number }
  onCropComplete: (blob: Blob) => void
  disabled?: boolean
}

function ImageUploadSection({
  label,
  currentUrl,
  aspectRatio,
  aspectLabel,
  previewSize,
  onCropComplete,
  disabled
}: ImageUploadSectionProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [newPreview, setNewPreview] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        setSelectedImage(reader.result as string)
        setCrop(undefined)
        setCompletedCrop(undefined)
        setNewPreview(null)
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
        setNewPreview(URL.createObjectURL(croppedBlob))
        onCropComplete(croppedBlob)
        setSelectedImage(null)
      }
    } catch (err) {
      console.error('Failed to crop image:', err)
    }
  }

  const displayUrl = newPreview || (isValidImageUrl(currentUrl) ? currentUrl : null)

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>

      {/* Show current/new preview */}
      {displayUrl && !selectedImage && (
        <div className="flex items-center gap-4 mb-2">
          <img
            src={displayUrl}
            alt={label}
            className="rounded-lg object-cover border border-gray-200"
            style={{ width: previewSize.width, height: previewSize.height }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
            disabled={disabled}
          >
            Replace
          </button>
        </div>
      )}

      {/* Upload button when no image */}
      {!displayUrl && !selectedImage && (
        <div className="mb-2">
          <label
            className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors"
            style={{ width: previewSize.width, height: previewSize.height }}
          >
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="mt-1 text-xs text-gray-500">Upload</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
              disabled={disabled}
            />
          </label>
        </div>
      )}

      {/* Hidden file input for replace button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
        disabled={disabled}
      />

      {/* Crop UI */}
      {selectedImage && (
        <div className="space-y-3">
          <div className="border rounded-lg p-3 bg-gray-50">
            <p className="text-xs text-gray-600 mb-2">Crop to {aspectLabel}</p>
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
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
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
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <p className="text-xs text-gray-500 mt-1">{aspectLabel} ratio</p>
    </div>
  )
}

// Edit Tool Modal Component
function EditToolModal({
  tool,
  categories,
  onClose,
  onSuccess
}: {
  tool: Tool
  categories: Category[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState(() => ({
    toolName: tool.tool_name || '',
    tagline: tool.tagline || '',
    description: tool.description || '',
    websiteUrl: tool.website_url || '',
    email: tool.submitter_email || '',
    categoryIds: tool.categories?.map(c => c.id) || []
  }))
  const [submitting, setSubmitting] = useState(false)
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null)
  const [listingBlob, setListingBlob] = useState<Blob | null>(null)

  // Reset form when tool changes
  useEffect(() => {
    setFormData({
      toolName: tool.tool_name || '',
      tagline: tool.tagline || '',
      description: tool.description || '',
      websiteUrl: tool.website_url || '',
      email: tool.submitter_email || '',
      categoryIds: tool.categories?.map(c => c.id) || []
    })
  }, [tool])

  const toggleCategory = (categoryId: string) => {
    setFormData(prev => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(categoryId)
        ? prev.categoryIds.filter(id => id !== categoryId)
        : [...prev.categoryIds, categoryId]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      let logoImageFileName = ''
      let listingImageFileName = ''

      // Upload logo if changed
      if (logoBlob) {
        logoImageFileName = `admin/logo-${Date.now()}.jpg`
        const formDataUpload = new FormData()
        formDataUpload.append('file', logoBlob, 'logo.jpg')

        const uploadResponse = await fetch(`/api/tools/upload-image?fileName=${encodeURIComponent(logoImageFileName)}`, {
          method: 'POST',
          body: formDataUpload
        })

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload logo image')
        }
      }

      // Upload listing image if changed
      if (listingBlob) {
        listingImageFileName = `admin/listing-${Date.now()}.jpg`
        const formDataUpload = new FormData()
        formDataUpload.append('file', listingBlob, 'listing.jpg')

        const uploadResponse = await fetch(`/api/tools/upload-image?fileName=${encodeURIComponent(listingImageFileName)}`, {
          method: 'POST',
          body: formDataUpload
        })

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload listing image')
        }
      }

      const response = await fetch('/api/tools/admin/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: tool.id,
          data: formData,
          listingImageFileName: listingImageFileName || undefined,
          logoImageFileName: logoImageFileName || undefined
        })
      })

      if (response.ok) {
        alert('Tool updated successfully!')
        onSuccess()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update tool')
      }
    } catch (error) {
      console.error('Update error:', error)
      alert(error instanceof Error ? error.message : 'Failed to update tool')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Edit Tool</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
              &times;
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Tool Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tool Name *
            </label>
            <input
              type="text"
              required
              value={formData.toolName}
              onChange={(e) => setFormData({ ...formData, toolName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {/* Tagline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tagline
            </label>
            <input
              type="text"
              value={formData.tagline}
              onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="A short catchy phrase about the tool"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {/* Website URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website URL *
            </label>
            <input
              type="url"
              required
              value={formData.websiteUrl}
              onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {/* Submitter Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {/* Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categories
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map(category => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    formData.categoryIds.includes(category.id)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Images - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ImageUploadSection
              label="Logo Image"
              currentUrl={tool.logo_image_url}
              aspectRatio={1}
              aspectLabel="1:1 square"
              previewSize={{ width: 100, height: 100 }}
              onCropComplete={setLogoBlob}
              disabled={submitting}
            />
            <ImageUploadSection
              label="Listing Image"
              currentUrl={tool.tool_image_url}
              aspectRatio={16 / 9}
              aspectLabel="16:9 wide"
              previewSize={{ width: 160, height: 90 }}
              onCropComplete={setListingBlob}
              disabled={submitting}
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-blue-300"
              disabled={submitting}
            >
              {submitting ? 'Updating...' : 'Update Tool'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
