'use client'

import { useEffect, useState, useRef } from 'react'
import RichTextEditor from '@/components/RichTextEditor'
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import type { Advertisement } from '@/types/database'
import { getCroppedImage } from '@/utils/imageCrop'

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
  const [formData, setFormData] = useState({
    title: ad.title,
    body: ad.body,
    button_url: ad.button_url,
    image_alt: ad.image_alt || '',
    status: ad.status,
    paid: ad.paid || false,
    frequency: ad.frequency || 'weekly',
    times_paid: ad.times_paid || 0
  })
  const [submitting, setSubmitting] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // Company/Advertiser state
  const [advertisers, setAdvertisers] = useState<Array<{ id: string; company_name: string }>>([])
  const [selectedAdvertiserId, setSelectedAdvertiserId] = useState<string>(ad.advertiser_id || '')
  const [newCompanyName, setNewCompanyName] = useState('')
  const [companyMode, setCompanyMode] = useState<'existing' | 'new'>(ad.advertiser_id ? 'existing' : 'new')

  // Fetch existing advertisers
  useEffect(() => {
    if (publicationId) {
      fetch(`/api/advertisers?publication_id=${publicationId}`)
        .then(res => res.json())
        .then(data => {
          if (data.advertisers) {
            setAdvertisers(data.advertisers)
          }
        })
        .catch(err => console.error('Failed to fetch advertisers:', err))
    }
  }, [publicationId])

  // Initialize company name if editing existing ad
  useEffect(() => {
    if (!ad.advertiser_id && ad.company_name) {
      setNewCompanyName(ad.company_name)
      setCompanyMode('new')
    }
  }, [ad])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        setSelectedImage(reader.result as string)
        // Set initial crop to show crop box immediately (16:9 aspect ratio, centered)
        setCrop({
          unit: '%',
          x: 10,
          y: 10,
          width: 80,
          height: 45 // 80 * (9/16) = 45 to maintain 16:9 aspect ratio
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      let imageUrl = ad.image_url // Keep existing image URL by default

      // Upload new image if one was selected
      if (selectedImage && completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
        const croppedBlob = await getCroppedImage(imgRef.current, completedCrop)
        if (croppedBlob) {
          const imageFormData = new FormData()
          imageFormData.append('image', croppedBlob, 'ad-image.jpg')

          const uploadResponse = await fetch('/api/ads/upload-image', {
            method: 'POST',
            body: imageFormData
          })

          if (uploadResponse.ok) {
            const { url } = await uploadResponse.json()
            imageUrl = url
          } else {
            const errorData = await uploadResponse.json().catch(() => ({ error: 'Unknown error' }))
            throw new Error(errorData.error || 'Failed to upload image')
          }
        }
      }

      // Handle company/advertiser
      let advertiserId = ad.advertiser_id
      let companyName = ad.company_name || ''

      if (companyMode === 'existing' && selectedAdvertiserId) {
        advertiserId = selectedAdvertiserId
        const selectedAdv = advertisers.find(a => a.id === selectedAdvertiserId)
        companyName = selectedAdv?.company_name || ''
      } else if (companyMode === 'new' && newCompanyName.trim()) {
        // Check if this is a new company name different from existing
        if (!ad.advertiser_id || newCompanyName.trim() !== ad.company_name) {
          // Create new advertiser
          const advertiserResponse = await fetch('/api/advertisers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              publication_id: publicationId,
              company_name: newCompanyName.trim()
            })
          })

          if (advertiserResponse.ok) {
            const advertiserData = await advertiserResponse.json()
            advertiserId = advertiserData.advertiser.id
            companyName = newCompanyName.trim()
          } else {
            console.warn('Failed to create advertiser, continuing without')
            advertiserId = null
            companyName = newCompanyName.trim()
          }
        } else {
          companyName = newCompanyName.trim()
        }
      }

      // Log what we're sending to help debug
      console.log('[EditAdModal] Sending update:', {
        id: ad.id,
        title: formData.title,
        body: formData.body?.substring(0, 100) + '...', // Truncate for logging
        button_url: formData.button_url,
        status: formData.status,
        image_url: imageUrl,
        advertiser_id: advertiserId,
        company_name: companyName
      })

      const response = await fetch(`/api/ads/${ad.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          image_url: imageUrl,
          advertiser_id: advertiserId,
          company_name: companyName
        })
      })

      const data = await response.json()
      console.log('[EditAdModal] API response:', response.status, data)

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to update advertisement')
      }

      if (!data.ad) {
        throw new Error('Server returned success but no ad data - please try again')
      }

      // Verify the saved data matches what we sent
      if (data.ad.body !== formData.body) {
        console.warn('[EditAdModal] Body mismatch! Sent:', formData.body?.substring(0, 50), 'Got:', data.ad.body?.substring(0, 50))
      }

      alert('Advertisement updated successfully!')
      onSuccess()
    } catch (error) {
      console.error('[EditAdModal] Update error:', error)
      alert(error instanceof Error ? error.message : 'Failed to update advertisement')
    } finally {
      setSubmitting(false)
    }
  }

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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company
            </label>
            <div className="space-y-3">
              {/* Current company display */}
              {ad.advertiser?.company_name && (
                <p className="text-sm text-gray-600">
                  Current: <span className="font-medium">{ad.advertiser.company_name}</span>
                </p>
              )}
              {!ad.advertiser?.company_name && ad.company_name && (
                <p className="text-sm text-gray-600">
                  Current: <span className="font-medium">{ad.company_name}</span>
                </p>
              )}

              {/* Mode toggle */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="editCompanyMode"
                    checked={companyMode === 'new'}
                    onChange={() => setCompanyMode('new')}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">{ad.advertiser_id || ad.company_name ? 'Change Company' : 'New Company'}</span>
                </label>
                {advertisers.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editCompanyMode"
                      checked={companyMode === 'existing'}
                      onChange={() => setCompanyMode('existing')}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Select Existing</span>
                  </label>
                )}
              </div>

              {/* New company input */}
              {companyMode === 'new' && (
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter company name"
                />
              )}

              {/* Existing company dropdown */}
              {companyMode === 'existing' && advertisers.length > 0 && (
                <select
                  value={selectedAdvertiserId}
                  onChange={(e) => setSelectedAdvertiserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select a company...</option>
                  {advertisers.map(adv => (
                    <option key={adv.id} value={adv.id}>
                      {adv.company_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

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

          {/* Current Image Display */}
          {ad.image_url && !selectedImage && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Image
              </label>
              <img
                src={ad.image_url}
                alt={ad.title}
                className="w-full max-w-md h-auto rounded border border-gray-200 mb-2"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
              >
                Replace Image
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Image Upload (if no current image) */}
          {!ad.image_url && !selectedImage && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Advertisement Image (Optional)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <p className="text-xs text-gray-500 mt-1">
                Upload an image for your ad. It will be cropped to 16:9 ratio.
              </p>
            </div>
          )}

          {/* Image Alt Text */}
          {(ad.image_url || selectedImage) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Image Alt Text
              </label>
              <input
                type="text"
                maxLength={200}
                value={formData.image_alt}
                onChange={(e) => setFormData(prev => ({ ...prev, image_alt: e.target.value }))}
                placeholder="Brief image description (max 200 chars)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <p className="text-xs text-gray-500 mt-1">
                Accessible description for the ad image. Keep it short and descriptive.
              </p>
            </div>
          )}

          {/* Image Cropper */}
          {selectedImage && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Crop New Image (16:9 ratio)
              </label>
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={16 / 9}
              >
                <img
                  ref={imgRef}
                  src={selectedImage}
                  alt="Crop preview"
                  style={{ maxWidth: '100%' }}
                />
              </ReactCrop>
              <button
                type="button"
                onClick={() => {
                  setSelectedImage(null)
                  setCrop(undefined)
                  setCompletedCrop(undefined)
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }}
                className="mt-2 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-sm"
              >
                Cancel Image Change
              </button>
            </div>
          )}

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
                // Ensure https:// prefix
                if (!value.startsWith('http://') && !value.startsWith('https://')) {
                  value = 'https://' + value.replace(/^https?:\/\//, '');
                }
                setFormData(prev => ({ ...prev, button_url: value }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="https://example.com"
            />
            <p className="text-xs text-gray-500 mt-1">
              The image and last line of the ad will link to this URL
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
