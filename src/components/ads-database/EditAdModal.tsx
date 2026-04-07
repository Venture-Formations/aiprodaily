'use client'

import RichTextEditor from '@/components/RichTextEditor'
import type { Advertisement } from '@/types/database'
import { useEditAdForm } from './edit-ad-modal/useEditAdForm'
import CompanyField from './edit-ad-modal/CompanyField'
import ImageSection from './edit-ad-modal/ImageSection'

interface AdWithRelations extends Advertisement {
  ad_module?: { id: string; name: string } | null
  advertiser?: { id: string; company_name: string; logo_url?: string } | null
}

interface EditAdModalProps {
  ad: AdWithRelations
  onClose: () => void
  onSuccess: () => void
  publicationId: string | null
}

// Edit Advertisement Modal Component
export default function EditAdModal({ ad, onClose, onSuccess, publicationId }: EditAdModalProps) {
  const {
    formData,
    setFormData,
    submitting,
    selectedImage,
    crop,
    setCrop,
    completedCrop,
    setCompletedCrop,
    fileInputRef,
    imgRef,
    advertisers,
    selectedAdvertiserId,
    setSelectedAdvertiserId,
    newCompanyName,
    setNewCompanyName,
    companyMode,
    setCompanyMode,
    handleImageSelect,
    clearImage,
    handleSubmit,
  } = useEditAdForm(ad, publicationId, onSuccess)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Edit Advertisement</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ad Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {/* Company/Advertiser */}
          <CompanyField
            currentCompanyName={ad.advertiser?.company_name}
            advertiserId={ad.advertiser_id}
            advertisers={advertisers}
            selectedAdvertiserId={selectedAdvertiserId}
            setSelectedAdvertiserId={setSelectedAdvertiserId}
            newCompanyName={newCompanyName}
            setNewCompanyName={setNewCompanyName}
            companyMode={companyMode}
            setCompanyMode={setCompanyMode}
            companyName={ad.company_name}
          />

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ad Content *
            </label>
            <RichTextEditor
              value={formData.body}
              onChange={(html) => setFormData(prev => ({ ...prev, body: html }))}
              maxWords={10000}
            />
          </div>

          {/* Call to Action */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Call to Action (Optional)
            </label>
            <input
              type="text"
              value={formData.cta_text}
              onChange={(e) => setFormData(prev => ({ ...prev, cta_text: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="e.g. Try it free for 14 days"
            />
            <p className="text-xs text-gray-500 mt-1">
              Text that will be linked to the URL below. Leave blank to omit.
            </p>
          </div>

          {/* Image Section */}
          <ImageSection
            adImageUrl={ad.image_url}
            adTitle={ad.title}
            selectedImage={selectedImage}
            crop={crop}
            setCrop={setCrop}
            completedCrop={completedCrop}
            setCompletedCrop={setCompletedCrop}
            fileInputRef={fileInputRef}
            imgRef={imgRef}
            imageAlt={formData.image_alt}
            onImageAltChange={(value) => setFormData(prev => ({ ...prev, image_alt: value }))}
            onImageSelect={handleImageSelect}
            onClearImage={clearImage}
          />

          {/* Status Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Advertisement Status
              </label>
              <p className="text-xs text-gray-600">
                {formData.status === 'active' ? 'Ad is active and will appear in newsletters' : 'Ad is inactive (approved but not in rotation)'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormData(prev => ({
                ...prev,
                status: prev.status === 'active' ? 'approved' : 'active'
              }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.status === 'active' ? 'bg-green-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Sponsored Ad Toggle */}
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sponsored Ad
              </label>
              <p className="text-xs text-gray-600">
                {formData.paid ? 'This is a paid/sponsored ad with scheduling limits' : 'Standard ad without weekly limits'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, paid: !prev.paid }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.paid ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.paid ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Frequency and Weeks Purchased (only for sponsored/paid ads) */}
          {formData.paid && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50/50 rounded-lg border border-blue-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frequency
                </label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value as 'single' | 'weekly' | 'monthly' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="single">Single (One-time)</option>
                </select>
              </div>
              {formData.frequency === 'weekly' && (() => {
                const timesUsed = ad.times_used || 0
                const remaining = Math.max(0, formData.times_paid - timesUsed)
                return (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Weeks Remaining
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={remaining}
                      onChange={(e) => {
                        const newRemaining = parseInt(e.target.value) || 0
                        setFormData(prev => ({ ...prev, times_paid: timesUsed + newRemaining }))
                      }}
                      placeholder="e.g., 8"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Already used: {timesUsed} times • Total purchased: {formData.times_paid}
                    </p>
                  </div>
                )
              })()}
            </div>
          )}

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL *
            </label>
            <input
              type="text"
              required
              value={formData.button_url}
              onChange={(e) => {
                let value = e.target.value;
                if (!value.startsWith('http://') && !value.startsWith('https://')) {
                  value = 'https://' + value.replace(/^https?:\/\//, '');
                }
                setFormData(prev => ({ ...prev, button_url: value }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="https://example.com"
            />
            <p className="text-xs text-gray-500 mt-1">
              The image and Call to Action will link to this URL
            </p>
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
              {submitting ? 'Updating...' : 'Update Advertisement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
