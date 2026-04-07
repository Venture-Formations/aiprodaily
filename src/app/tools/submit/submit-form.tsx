'use client'

import type { DirectoryCategory } from '@/lib/directory'
import type { AIAppCategory } from '@/types/database'
import { useSubmitToolForm } from './useSubmitToolForm'
import { ImageUpload, FeaturedUpgradeModal } from './SubmitFormComponents'

interface SubmitToolFormProps {
  categories: DirectoryCategory[]
  featuredCategories: string[]
  featuredMonthlyPrice: number
}

export function SubmitToolForm({ categories, featuredCategories, featuredMonthlyPrice }: SubmitToolFormProps) {
  const {
    formData,
    updateField,
    isSubmitting,
    error,
    showUpgradeModal,
    isProcessingUpgrade,
    logoPreview,
    listingPreview,
    handleLogoCropComplete,
    handleListingCropComplete,
    clearLogo,
    clearListing,
    handleSubmit,
    handleUpgrade,
    handleContinueFree,
  } = useSubmitToolForm({ featuredCategories })

  return (
    <>
      <FeaturedUpgradeModal
        isOpen={showUpgradeModal}
        categoryName={formData.category}
        monthlyPrice={featuredMonthlyPrice}
        onUpgrade={handleUpgrade}
        onContinueFree={handleContinueFree}
        isLoading={isProcessingUpgrade}
      />

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
            onChange={(e) => updateField('toolName', e.target.value)}
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
            onChange={(e) => updateField('email', e.target.value)}
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
            onChange={(e) => updateField('websiteUrl', e.target.value)}
            onBlur={(e) => {
              const url = e.target.value.trim()
              if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
                updateField('websiteUrl', `https://${url}`)
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
            onChange={(e) => updateField('description', e.target.value)}
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
            onChange={(e) => updateField('category', e.target.value as AIAppCategory)}
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
          <ImageUpload
            label="Logo Image"
            description="Square logo for list cards (1:1 ratio)"
            aspectRatio={1}
            aspectLabel="1:1 square"
            previewSize={{ width: 120, height: 120 }}
            croppedPreview={logoPreview}
            onCropComplete={handleLogoCropComplete}
            onClear={clearLogo}
            disabled={isSubmitting}
          />
          <ImageUpload
            label="Listing Image"
            description="Wide image for tool detail page (16:9 ratio)"
            aspectRatio={16 / 9}
            aspectLabel="16:9 wide"
            previewSize={{ width: 192, height: 108 }}
            croppedPreview={listingPreview}
            onCropComplete={handleListingCropComplete}
            onClear={clearListing}
            disabled={isSubmitting}
          />
        </div>

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
            'Submit Tool'
          )}
        </button>

        <p className="text-sm text-gray-500 text-center">
          By submitting, you agree to our terms of service. All submissions are reviewed before publishing.
        </p>
      </form>
    </>
  )
}
