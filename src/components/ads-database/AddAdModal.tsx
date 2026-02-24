'use client'

import { useEffect, useState, useRef } from 'react'
import RichTextEditor from '@/components/RichTextEditor'
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { getCroppedImage } from '@/utils/imageCrop'

interface AddAdModalProps {
  onClose: () => void
  onSuccess: () => void
  publicationId: string | null
  selectedSection: string  // ad_module_id
  sectionName: string
}

// Add Advertisement Modal Component (Simplified - No frequency/payment fields)
export default function AddAdModal({ onClose, onSuccess, publicationId, selectedSection, sectionName }: AddAdModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    button_url: '',
    image_alt: ''
  })
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [submitting, setSubmitting] = useState(false)

  // Company/Advertiser state
  const [advertisers, setAdvertisers] = useState<Array<{ id: string; company_name: string }>>([])
  const [selectedAdvertiserId, setSelectedAdvertiserId] = useState<string>('')
  const [newCompanyName, setNewCompanyName] = useState('')
  const [companyMode, setCompanyMode] = useState<'existing' | 'new'>('new')

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
      let imageUrl = null

      // Upload image if present
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

      // Validate company is provided
      if (companyMode === 'existing' && !selectedAdvertiserId) {
        alert('Please select a company')
        setSubmitting(false)
        return
      }
      if (companyMode === 'new' && !newCompanyName.trim()) {
        alert('Please enter a company name')
        setSubmitting(false)
        return
      }

      // Handle company/advertiser
      let advertiserId = null
      let companyName = ''

      if (companyMode === 'existing' && selectedAdvertiserId) {
        advertiserId = selectedAdvertiserId
        const selectedAd = advertisers.find(a => a.id === selectedAdvertiserId)
        companyName = selectedAd?.company_name || ''
      } else if (companyMode === 'new' && newCompanyName.trim()) {
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
          companyName = newCompanyName.trim()
        }
      }

      // Calculate word count
      const text = formData.body.replace(/<[^>]*>/g, '').trim()
      const words = text.split(/\s+/).filter(w => w.length > 0)
      const wordCount = words.length

      const response = await fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          word_count: wordCount,
          image_url: imageUrl,
          payment_amount: 0,
          payment_status: 'manual',
          paid: true,
          status: 'active', // Admin-created ads go directly to active status
          advertiser_id: advertiserId,
          company_name: companyName,
          ad_module_id: selectedSection, // Link to ad module
          ad_type: selectedSection // Store section ID
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to create advertisement')
      }

      if (!data.ad) {
        throw new Error('Server returned success but no ad data - please try again')
      }

      alert('Advertisement created successfully!')
      onSuccess()
    } catch (error) {
      console.error('Create error:', error)
      alert(error instanceof Error ? error.message : 'Failed to create advertisement')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Add Advertisement - {sectionName}</h2>
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
              placeholder="Enter ad title"
            />
          </div>

          {/* Company/Advertiser */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company *
            </label>
            <div className="space-y-3">
              {/* Mode toggle */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="companyMode"
                    checked={companyMode === 'new'}
                    onChange={() => setCompanyMode('new')}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">New Company</span>
                </label>
                {advertisers.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="companyMode"
                      checked={companyMode === 'existing'}
                      onChange={() => setCompanyMode('existing')}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Existing Company</span>
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

          {/* Image Upload and Cropper */}
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

          {/* Image Cropper */}
          {selectedImage && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Crop Image (16:9 ratio)
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
            </div>
          )}

          {/* Image Alt Text */}
          {selectedImage && (
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
                Accessible description for the ad image.
              </p>
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
              {submitting ? 'Creating...' : 'Create Advertisement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
