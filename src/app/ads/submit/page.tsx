'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import RichTextEditor from '@/components/RichTextEditor'
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { getCroppedImage } from '@/utils/imageCrop'

interface AdFormData {
  title: string
  body: string
  button_text: string
  button_url: string
  submitter_email: string
}

export default function SubmitAdPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const [formData, setFormData] = useState<AdFormData>({
    title: '',
    body: '',
    button_text: '',
    button_url: 'https://',
    submitter_email: ''
  })

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        setSelectedImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.title || !formData.body) {
      alert('Please fill in title and ad content')
      return
    }

    if (!formData.button_text || !formData.button_url || !formData.submitter_email) {
      alert('Please fill in button text, button URL, and email')
      return
    }

    // Check word count
    const text = formData.body.replace(/<[^>]*>/g, '').trim()
    const words = text.split(/\s+/).filter(w => w.length > 0)
    if (words.length > 100) {
      alert('Ad content must be 100 words or less')
      return
    }

    if (words.length === 0) {
      alert('Ad content cannot be empty')
      return
    }

    setLoading(true)

    try {
      let imageUrl = null

      // Upload image if present
      if (selectedImage && completedCrop) {
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
            throw new Error('Failed to upload image')
          }
        }
      }

      // Submit ad directly to database (no payment for now)
      const response = await fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          image_url: imageUrl,
          word_count: words.length,
          status: 'pending_review', // Goes straight to review
          paid: true // Bypassing payment for now
        })
      })

      if (!response.ok) {
        throw new Error('Failed to submit advertisement')
      }

      const data = await response.json()

      // Redirect to success page
      router.push('/ads/success')

    } catch (error) {
      console.error('Submission error:', error)
      alert('Failed to process submission. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Submit Your Advertorial
          </h1>
          <p className="text-gray-600 mb-8">
            Get featured in the newsletter's Advertorial section.
            Your ad will reach thousands of subscribers! Submit your ad for review today.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Ad Content Section */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">Advertisement Content</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ad Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., New Menu Items at Our Restaurant"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ad Content (Max 100 words) <span className="text-red-500">*</span>
                  </label>
                  <RichTextEditor
                    value={formData.body}
                    onChange={(html) => setFormData({ ...formData, body: html })}
                    maxWords={100}
                    placeholder="Write your advertisement content here. You can use bold, italic, underline, and add links."
                  />
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Advertisement Image (Optional)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Upload an image to make your ad stand out! It will be cropped to 16:9 ratio.
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
              </div>
            </div>

            {/* Button Information Section */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">Call-to-Action Button</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Button Text <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.button_text}
                    onChange={(e) => setFormData({ ...formData, button_text: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Learn More, Visit Website, Get Started"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Button URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.button_url}
                    onChange={(e) => {
                      let value = e.target.value;
                      // Ensure https:// prefix
                      if (!value.startsWith('http://') && !value.startsWith('https://')) {
                        value = 'https://' + value.replace(/^https?:\/\//, '');
                      }
                      setFormData({ ...formData, button_url: value });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">Your Contact Information</h2>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.submitter_email}
                    onChange={(e) => setFormData({ ...formData, submitter_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="your.email@example.com"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    We'll use this email to notify you about your ad's status
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Submitting...' : 'Submit Advertorial for Review'}
              </button>
            </div>
          </form>
        </div>

        {/* Information Section */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">How It Works</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Fill out the form above with your advertorial content and call-to-action button</li>
            <li>Submit your ad for review - no payment required at this time</li>
            <li>Our team will review your submission (typically within 1 business day)</li>
            <li>Once approved, your ad will be added to the rotation queue</li>
            <li>Your ad will appear in upcoming newsletters with a centered button linking to your destination</li>
            <li>You'll receive notifications via email about your ad's status</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
