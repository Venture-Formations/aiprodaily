'use client'

import { useState, useRef, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { addTool, createCheckoutSession } from '../actions'
import { getCroppedImage } from '@/utils/imageCrop'
import type { DirectoryCategory } from '@/lib/directory'
import type { AIAppCategory } from '@/types/database'

// Listing types
type ListingType = 'free' | 'paid_placement' | 'featured'
type BillingPeriod = 'monthly' | 'yearly'

interface SubmitToolFormProps {
  categories: DirectoryCategory[]
  featuredCategories: string[]
  pricing: {
    paidPlacementMonthly: number
    featuredMonthly: number
    yearlyDiscountMonths: number
  }
}

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

// Image upload component for reusability
interface ImageUploadProps {
  label: string
  description: string
  aspectRatio: number
  aspectLabel: string
  previewSize: { width: number; height: number }
  croppedPreview: string | null
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
  onCropComplete,
  onClear,
  disabled
}: ImageUploadProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const imgRef = useRef<HTMLImageElement>(null)

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

      {/* Show cropped preview if available */}
      {croppedPreview && !selectedImage && (
        <div className="mb-4">
          <div
            className="relative rounded-lg overflow-hidden bg-gray-100 border border-gray-200"
            style={{ width: previewSize.width, height: previewSize.height }}
          >
            <img src={croppedPreview} alt="Cropped preview" className="w-full h-full object-cover" />
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
      {!croppedPreview && (
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

export function SubmitToolForm({ categories, featuredCategories, pricing }: SubmitToolFormProps) {
  const { user } = useUser()
  const router = useRouter()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    toolName: '',
    email: user?.primaryEmailAddress?.emailAddress || '',
    websiteUrl: '',
    description: '',
    category: 'Accounting & Bookkeeping' as AIAppCategory,
    listingType: 'free' as ListingType,
    billingPeriod: 'monthly' as BillingPeriod
  })

  // Check if selected category already has a featured tool
  const categoryHasFeatured = featuredCategories.includes(formData.category)

  // If user selected featured but category now has one (e.g., after category change), reset to paid_placement
  useEffect(() => {
    if (formData.listingType === 'featured' && categoryHasFeatured) {
      setFormData(prev => ({ ...prev, listingType: 'paid_placement' }))
    }
  }, [formData.category, categoryHasFeatured, formData.listingType])

  // Image state - separate for logo (1:1) and listing (16:9)
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [listingBlob, setListingBlob] = useState<Blob | null>(null)
  const [listingPreview, setListingPreview] = useState<string | null>(null)

  const handleLogoCropComplete = (blob: Blob) => {
    setLogoBlob(blob)
    setLogoPreview(URL.createObjectURL(blob))
  }

  const handleListingCropComplete = (blob: Blob) => {
    setListingBlob(blob)
    setListingPreview(URL.createObjectURL(blob))
  }

  // Calculate pricing
  const getPrice = () => {
    if (formData.listingType === 'free') return 0

    const monthlyPrice = formData.listingType === 'featured'
      ? pricing.featuredMonthly
      : pricing.paidPlacementMonthly

    if (formData.billingPeriod === 'yearly') {
      return monthlyPrice * (12 - pricing.yearlyDiscountMonths)
    }
    return monthlyPrice
  }

  const getPriceLabel = () => {
    if (formData.listingType === 'free') return 'Free'

    const price = getPrice()
    if (formData.billingPeriod === 'yearly') {
      return `$${price}/year`
    }
    return `$${price}/month`
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

      // Upload logo image if provided
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

      // Upload listing image if provided
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

      // Convert listing type to plan format for backend
      const plan = formData.listingType === 'free' ? 'free' :
        formData.listingType === 'paid_placement' ?
          (formData.billingPeriod === 'yearly' ? 'paid_placement_yearly' : 'paid_placement_monthly') :
          (formData.billingPeriod === 'yearly' ? 'featured_yearly' : 'featured_monthly')

      // Submit tool with both image filenames
      const result = await addTool(
        {
          toolName: formData.toolName,
          email: formData.email,
          websiteUrl: formData.websiteUrl,
          description: formData.description,
          category: formData.category,
          plan: plan as any, // Will be updated to support new plan types
          listingType: formData.listingType,
          billingPeriod: formData.billingPeriod
        },
        user?.id || null,
        listingFileName, // screenshot_url (16:9 listing image)
        user?.fullName || 'Anonymous',
        user?.imageUrl || '',
        logoFileName // logo_url (1:1 logo)
      )

      if (result.error) {
        throw new Error(result.error)
      }

      // If paid plan, redirect to Stripe
      if (formData.listingType !== 'free' && result.tool) {
        const checkoutUrl = await createCheckoutSession(
          result.tool.id,
          formData.listingType,
          formData.billingPeriod
        )
        if (checkoutUrl) {
          window.location.href = checkoutUrl
          return
        }
      }

      // Success - redirect to tools page
      router.push('/tools?submitted=true')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
          type="url"
          id="websiteUrl"
          value={formData.websiteUrl}
          onChange={(e) => setFormData(prev => ({ ...prev, websiteUrl: e.target.value }))}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="https://yourwebsite.com"
          disabled={isSubmitting}
        />
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
          {categories.map(category => (
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
          onCropComplete={handleLogoCropComplete}
          onClear={() => {
            setLogoBlob(null)
            setLogoPreview(null)
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
          onCropComplete={handleListingCropComplete}
          onClear={() => {
            setListingBlob(null)
            setListingPreview(null)
          }}
          disabled={isSubmitting}
        />
      </div>

      {/* Listing Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Listing Type
        </label>
        <div className="grid grid-cols-3 gap-4">
          {/* Free */}
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, listingType: 'free' }))}
            disabled={isSubmitting}
            className={`p-4 rounded-lg border-2 text-center transition-all ${
              formData.listingType === 'free'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold text-gray-900">Free</div>
            <div className="text-sm text-gray-500">$0</div>
          </button>

          {/* Paid Placement */}
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, listingType: 'paid_placement' }))}
            disabled={isSubmitting}
            className={`p-4 rounded-lg border-2 text-center transition-all ${
              formData.listingType === 'paid_placement'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold text-gray-900">Paid Placement</div>
            <div className="text-sm text-gray-500">${pricing.paidPlacementMonthly}/mo</div>
          </button>

          {/* Featured */}
          <button
            type="button"
            onClick={() => !categoryHasFeatured && setFormData(prev => ({ ...prev, listingType: 'featured' }))}
            disabled={isSubmitting || categoryHasFeatured}
            className={`p-4 rounded-lg border-2 text-center transition-all ${
              categoryHasFeatured
                ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                : formData.listingType === 'featured'
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`font-semibold ${categoryHasFeatured ? 'text-gray-400' : 'text-gray-900'}`}>Featured</div>
            <div className={`text-sm ${categoryHasFeatured ? 'text-gray-400' : 'text-gray-500'}`}>${pricing.featuredMonthly}/mo</div>
            {categoryHasFeatured && (
              <div className="text-xs text-amber-600 mt-1">Slot taken</div>
            )}
          </button>
        </div>
      </div>

      {/* Billing Period Toggle - Only show for paid options */}
      {formData.listingType !== 'free' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Billing Period
          </label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, billingPeriod: 'monthly' }))}
              disabled={isSubmitting}
              className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${
                formData.billingPeriod === 'monthly'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold text-gray-900">Monthly</div>
              <div className="text-sm text-gray-500">
                ${formData.listingType === 'featured' ? pricing.featuredMonthly : pricing.paidPlacementMonthly}/month
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, billingPeriod: 'yearly' }))}
              disabled={isSubmitting}
              className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${
                formData.billingPeriod === 'yearly'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold text-gray-900">Yearly</div>
              <div className="text-sm text-gray-500">
                ${(formData.listingType === 'featured' ? pricing.featuredMonthly : pricing.paidPlacementMonthly) * (12 - pricing.yearlyDiscountMonths)}/year
              </div>
              <div className="text-xs text-green-600 font-medium">
                Save {pricing.yearlyDiscountMonths} months
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Price Summary */}
      {formData.listingType !== 'free' && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">
              {formData.listingType === 'featured' ? 'Featured Listing' : 'Paid Placement'} ({formData.billingPeriod})
            </span>
            <span className="text-lg font-semibold text-gray-900">{getPriceLabel()}</span>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          formData.listingType === 'free' ? 'Submit Tool' : `Continue to Payment (${getPriceLabel()})`
        )}
      </button>

      <p className="text-sm text-gray-500 text-center">
        By submitting, you agree to our terms of service. All submissions are reviewed before publishing.
      </p>
    </form>
  )
}
