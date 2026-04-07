'use client'

import { useState, useEffect } from 'react'
import type { Tool, Category } from './types'
import ImageUploadSection from './ImageUploadSection'

interface EditToolModalProps {
  tool: Tool
  categories: Category[]
  onClose: () => void
  onSuccess: () => void
}

export default function EditToolModal({
  tool,
  categories,
  onClose,
  onSuccess
}: EditToolModalProps) {
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
