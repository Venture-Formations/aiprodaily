'use client'

import { useState, useRef } from 'react'
import { useUser, SignInButton } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { claimTool } from '../actions'
import { getCroppedImage } from '@/utils/imageCrop'
import type { AIAppCategory } from '@/types/database'

interface ClaimListingButtonProps {
  toolId: string
  toolName: string
  description: string
  websiteUrl: string
  category: string
  currentLogoUrl: string | null
  currentImageUrl: string | null
  isToolClaimed: boolean
  currentUserHasListing: boolean
}

interface Category {
  id: string
  name: string
  slug: string
}

const CATEGORIES: Category[] = [
  { id: 'accounting-bookkeeping', name: 'Accounting & Bookkeeping', slug: 'accounting-bookkeeping' },
  { id: 'tax-compliance', name: 'Tax & Compliance', slug: 'tax-compliance' },
  { id: 'payroll', name: 'Payroll', slug: 'payroll' },
  { id: 'finance-analysis', name: 'Finance & Analysis', slug: 'finance-analysis' },
  { id: 'expense-management', name: 'Expense Management', slug: 'expense-management' },
  { id: 'client-management', name: 'Client Management', slug: 'client-management' },
  { id: 'productivity', name: 'Productivity', slug: 'productivity' },
  { id: 'hr', name: 'HR', slug: 'hr' },
  { id: 'banking-payments', name: 'Banking & Payments', slug: 'banking-payments' }
]

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  )
}

// Image upload component
interface ImageUploadProps {
  label: string
  description: string
  aspectRatio: number
  aspectLabel: string
  previewSize: { width: number; height: number }
  croppedPreview: string | null
  existingImageUrl: string | null
  onCropComplete: (blob: Blob) => void
  onClear: () => void
  disabled?: boolean
}

function ImageUpload({
  label,
  description,
  aspectRatio,
  aspectLabel,
  previewSize,
  croppedPreview,
  existingImageUrl,
  onCropComplete,
  onClear,
  disabled
}: ImageUploadProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const imgRef = useRef<HTMLImageElement>(null)

  // Display either cropped preview (new upload) or existing image
  const displayImage = croppedPreview || existingImageUrl

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
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

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      {/* Show preview if available */}
      {displayImage && !selectedImage && (
        <div className="mb-4">
          <div
            className="relative rounded-lg overflow-hidden bg-gray-100 border border-gray-200"
            style={{ width: previewSize.width, height: previewSize.height }}
          >
            <img src={displayImage} alt="Preview" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={onClear}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="mt-2 text-sm text-blue-600 hover:text-blue-500"
          >
            Choose different image
          </button>
        </div>
      )}

      {/* Image selection and crop UI */}
      {!displayImage && (
        <>
          {selectedImage ? (
            <div className="space-y-4">
              <div className="border rounded-lg p-4 bg-gray-50">
                <p className="text-sm text-gray-600 mb-3">Drag to adjust the crop area ({aspectLabel})</p>
                <div className="max-w-md mx-auto">
                  <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={aspectRatio}
                    className="max-h-80"
                  >
                    <img
                      ref={imgRef}
                      src={selectedImage}
                      alt="Crop preview"
                      onLoad={onImageLoad}
                      className="max-h-80"
                    />
                  </ReactCrop>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleApplyCrop}
                  disabled={!completedCrop}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply Crop
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedImage(null)
                    setCrop(undefined)
                    setCompletedCrop(undefined)
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-1">
              <label
                className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors"
                style={{ width: previewSize.width, height: previewSize.height }}
              >
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="mt-1 text-sm text-gray-500">Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  disabled={disabled}
                />
              </label>
            </div>
          )}
        </>
      )}
      <p className="mt-2 text-sm text-gray-500">{description}</p>
    </div>
  )
}

// Claim Modal
interface ClaimModalProps {
  isOpen: boolean
  onClose: () => void
  toolId: string
  initialData: {
    toolName: string
    description: string
    websiteUrl: string
    category: string
    logoUrl: string | null
    imageUrl: string | null
  }
}

function ClaimModal({ isOpen, onClose, toolId, initialData }: ClaimModalProps) {
  const { user } = useUser()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    toolName: initialData.toolName,
    email: user?.primaryEmailAddress?.emailAddress || '',
    websiteUrl: initialData.websiteUrl,
    description: initialData.description,
    category: initialData.category as AIAppCategory
  })

  // Image state
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [listingBlob, setListingBlob] = useState<Blob | null>(null)
  const [listingPreview, setListingPreview] = useState<string | null>(null)
  const [keepExistingLogo, setKeepExistingLogo] = useState(true)
  const [keepExistingImage, setKeepExistingImage] = useState(true)

  const handleLogoCropComplete = (blob: Blob) => {
    setLogoBlob(blob)
    setLogoPreview(URL.createObjectURL(blob))
    setKeepExistingLogo(false)
  }

  const handleListingCropComplete = (blob: Blob) => {
    setListingBlob(blob)
    setListingPreview(URL.createObjectURL(blob))
    setKeepExistingImage(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      // Validate
      if (!formData.toolName.trim()) {
        throw new Error('Tool name is required')
      }
      if (!formData.websiteUrl.trim()) {
        throw new Error('Website URL is required')
      }
      if (!formData.description.trim()) {
        throw new Error('Description is required')
      }

      // Upload logo image if new one provided
      let logoFileName = ''
      if (logoBlob) {
        logoFileName = `${user?.id || 'anonymous'}/logo-${Date.now()}.jpg`
        const formDataUpload = new FormData()
        formDataUpload.append('file', logoBlob, 'logo.jpg')

        const uploadResponse = await fetch(`/api/tools/upload-image?fileName=${encodeURIComponent(logoFileName)}`, {
          method: 'POST',
          body: formDataUpload
        })

        if (!uploadResponse.ok) {
          const err = await uploadResponse.json()
          throw new Error(err.error || 'Failed to upload logo image')
        }
      }

      // Upload listing image if new one provided
      let listingFileName = ''
      if (listingBlob) {
        listingFileName = `${user?.id || 'anonymous'}/listing-${Date.now()}.jpg`
        const formDataUpload = new FormData()
        formDataUpload.append('file', listingBlob, 'listing.jpg')

        const uploadResponse = await fetch(`/api/tools/upload-image?fileName=${encodeURIComponent(listingFileName)}`, {
          method: 'POST',
          body: formDataUpload
        })

        if (!uploadResponse.ok) {
          const err = await uploadResponse.json()
          throw new Error(err.error || 'Failed to upload listing image')
        }
      }

      // Claim the tool
      const result = await claimTool(
        toolId,
        {
          toolName: formData.toolName,
          email: formData.email,
          websiteUrl: formData.websiteUrl,
          description: formData.description,
          category: formData.category
        },
        user?.id || null,
        listingFileName || undefined,
        user?.fullName || 'Anonymous',
        user?.imageUrl || '',
        logoFileName || undefined,
        keepExistingLogo,
        keepExistingImage
      )

      if (result.error) {
        throw new Error(result.error)
      }

      // Success - redirect to account page
      router.push('/account?claimed=true')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Claim This Listing</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Update the information below and submit to claim this listing. Your submission will be reviewed before being published.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Tool Name */}
          <div>
            <label htmlFor="toolName" className="block text-sm font-medium text-gray-700 mb-1">
              Tool Name *
            </label>
            <input
              type="text"
              id="toolName"
              value={formData.toolName}
              onChange={(e) => setFormData(prev => ({ ...prev, toolName: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., My AI Tool"
              disabled={isSubmitting}
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Contact Email *
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="you@example.com"
              disabled={isSubmitting}
            />
          </div>

          {/* Website URL */}
          <div>
            <label htmlFor="websiteUrl" className="block text-sm font-medium text-gray-700 mb-1">
              Website URL *
            </label>
            <input
              type="text"
              id="websiteUrl"
              value={formData.websiteUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, websiteUrl: e.target.value }))}
              onBlur={(e) => {
                const url = e.target.value.trim()
                if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
                  setFormData(prev => ({ ...prev, websiteUrl: `https://${url}` }))
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="yourwebsite.com"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-sm text-gray-500">https:// will be added automatically if not included</p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description * (max 200 characters)
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              maxLength={200}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe what your tool does and how it helps accountants..."
              disabled={isSubmitting}
            />
            <p className="mt-1 text-sm text-gray-500">{formData.description.length}/200 characters</p>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as AIAppCategory }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
            >
              {CATEGORIES.map(category => (
                <option key={category.id} value={category.name}>{category.name}</option>
              ))}
            </select>
          </div>

          {/* Image Uploads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo Image (1:1) */}
            <ImageUpload
              label="Logo Image"
              description="Square logo for list cards (1:1 ratio)"
              aspectRatio={1}
              aspectLabel="1:1 square"
              previewSize={{ width: 120, height: 120 }}
              croppedPreview={logoPreview}
              existingImageUrl={keepExistingLogo ? initialData.logoUrl : null}
              onCropComplete={handleLogoCropComplete}
              onClear={() => {
                setLogoBlob(null)
                setLogoPreview(null)
                setKeepExistingLogo(false)
              }}
              disabled={isSubmitting}
            />

            {/* Listing Image (16:9) */}
            <ImageUpload
              label="Listing Image"
              description="Wide image for tool detail page (16:9 ratio)"
              aspectRatio={16 / 9}
              aspectLabel="16:9 wide"
              previewSize={{ width: 192, height: 108 }}
              croppedPreview={listingPreview}
              existingImageUrl={keepExistingImage ? initialData.imageUrl : null}
              onCropComplete={handleListingCropComplete}
              onClear={() => {
                setListingBlob(null)
                setListingPreview(null)
                setKeepExistingImage(false)
              }}
              disabled={isSubmitting}
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Submitting...
                </>
              ) : (
                'Claim Listing'
              )}
            </button>
          </div>

          <p className="text-sm text-gray-500 text-center">
            By claiming, you agree to our terms of service. Your claim will be reviewed before being published.
          </p>
        </form>
      </div>
    </div>
  )
}

// Main component
export function ClaimListingButton({
  toolId,
  toolName,
  description,
  websiteUrl,
  category,
  currentLogoUrl,
  currentImageUrl,
  isToolClaimed,
  currentUserHasListing
}: ClaimListingButtonProps) {
  const { isSignedIn, user } = useUser()
  const [showModal, setShowModal] = useState(false)

  // Don't show button if tool is already claimed
  if (isToolClaimed) {
    return null
  }

  // Don't show button if current user already has a listing
  if (isSignedIn && currentUserHasListing) {
    return null
  }

  // If not signed in, show sign-in button
  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button className="group inline-flex items-center justify-center rounded-full py-3 px-6 text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300 transition-colors">
          Claim Listing
          <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </SignInButton>
    )
  }

  // Signed in and no existing listing - show claim button
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="group inline-flex items-center justify-center rounded-full py-3 px-6 text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300 transition-colors"
      >
        Claim Listing
        <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      <ClaimModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        toolId={toolId}
        initialData={{
          toolName,
          description,
          websiteUrl,
          category,
          logoUrl: currentLogoUrl,
          imageUrl: currentImageUrl
        }}
      />
    </>
  )
}
