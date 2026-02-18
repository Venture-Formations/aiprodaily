'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, Info, CheckCircle, CreditCard } from 'lucide-react'
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { getCroppedImage } from '@/utils/imageCrop'
import { DatePicker } from './components/DatePicker'

// Pricing constants
const PRICE_PER_DAY = 250
const DISCOUNTED_PRICE_PER_DAY = 200
const DISCOUNT_THRESHOLD = 4

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

function calculatePricing(numDays: number) {
  const hasDiscount = numDays >= DISCOUNT_THRESHOLD
  const pricePerDay = hasDiscount ? DISCOUNTED_PRICE_PER_DAY : PRICE_PER_DAY
  const total = numDays * pricePerDay
  const savings = hasDiscount ? numDays * (PRICE_PER_DAY - DISCOUNTED_PRICE_PER_DAY) : 0
  
  return { pricePerDay, total, hasDiscount, savings }
}

// This page is wrapped by /account/layout.tsx which handles authentication
// via Clerk's SignedIn/SignedOut components

export default function NewAdPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    companyName: '',
    headline: '',
    description: '',
    destinationUrl: '',
    buttonText: 'Learn More',
  })

  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [useNextAvailable, setUseNextAvailable] = useState(false)
  const [nextAvailableDays, setNextAvailableDays] = useState(1)

  // Image state
  const [imageBlob, setImageBlob] = useState<Blob | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const imgRef = useRef<HTMLImageElement>(null)

  // Calculate pricing
  const numDays = useNextAvailable ? nextAvailableDays : selectedDates.length
  const pricing = calculatePricing(numDays)

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
    setCrop(centerAspectCrop(width, height, 5 / 4)) // 5:4 ratio for ads
  }

  const handleApplyCrop = async () => {
    if (!completedCrop || !imgRef.current) return
    try {
      const croppedBlob = await getCroppedImage(imgRef.current, completedCrop)
      if (croppedBlob) {
        setImageBlob(croppedBlob)
        setImagePreview(URL.createObjectURL(croppedBlob))
        setSelectedImage(null)
      }
    } catch (err) {
      console.error('Failed to crop image:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      // Validation
      if (!formData.companyName.trim()) throw new Error('Company name is required')
      if (!formData.headline.trim()) throw new Error('Headline is required')
      if (!formData.description.trim()) throw new Error('Description is required')
      if (!formData.destinationUrl.trim()) throw new Error('Destination URL is required')
      if (numDays === 0) throw new Error('Please select at least one date or use next available')

      // Create the ad and redirect to Stripe checkout
      const response = await fetch('/api/account/ads/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          selectedDates: useNextAvailable ? [] : selectedDates.map(d => d.toISOString().split('T')[0]),
          useNextAvailable,
          nextAvailableDays: useNextAvailable ? nextAvailableDays : 0,
          numDays,
          total: pricing.total,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create checkout session')
      }

      const { checkoutUrl } = await response.json()
      
      // Redirect to Stripe checkout
      window.location.href = checkoutUrl

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsSubmitting(false)
    }
  }

  const handleToggleNextAvailable = () => {
    setUseNextAvailable(!useNextAvailable)
    if (!useNextAvailable) {
      setSelectedDates([])
    }
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Ad Request Submitted!</h2>
          <p className="text-gray-600 mb-8">
            Your ad request has been submitted. Our team will create your ad creative and send it back for approval.
          </p>
          <Link
            href="/account/ads/newsletter"
            className="px-5 py-2.5 bg-[#1c293d] text-white rounded-lg font-medium hover:bg-[#1c293d]/90 transition-colors"
          >
            View My Newsletter Ads
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/account/ads/newsletter"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Newsletter Ads
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create Newsletter Ad</h1>
        <p className="text-gray-600 mt-1">
          Submit your Main Sponsor ad for our newsletter
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-[#a855f7]/10 via-[#06b6d4]/10 to-[#14b8a6]/10 border border-[#06b6d4]/20 rounded-xl p-4 mb-8">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-[#06b6d4] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-gray-900">How it works</h3>
            <p className="text-sm text-gray-600 mt-1">
              Submit your ad details below. Our team will create a polished ad creative and send it back for your approval before it goes live.
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Company Info Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Ad Content</h2>
          
          <div className="space-y-5">
            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company/Product Name *
              </label>
              <input
                type="text"
                required
                value={formData.companyName}
                onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#06b6d4] focus:border-transparent"
                placeholder="e.g., AccountingAI Pro"
                disabled={isSubmitting}
              />
            </div>

            {/* Headline */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Headline *
              </label>
              <input
                type="text"
                required
                value={formData.headline}
                onChange={(e) => setFormData(prev => ({ ...prev, headline: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#06b6d4] focus:border-transparent"
                placeholder="e.g., Automate Your Bookkeeping in Minutes"
                disabled={isSubmitting}
              />
              <p className="mt-1 text-xs text-gray-500">Keep it short and attention-grabbing</p>
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
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#06b6d4] focus:border-transparent"
                placeholder="Describe your product/offer and why readers should care..."
                disabled={isSubmitting}
              />
            </div>

            {/* Destination URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Destination URL *
              </label>
              <input
                type="url"
                required
                value={formData.destinationUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, destinationUrl: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#06b6d4] focus:border-transparent"
                placeholder="https://yourwebsite.com/offer"
                disabled={isSubmitting}
              />
            </div>

            {/* Button Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Button Text
              </label>
              <input
                type="text"
                value={formData.buttonText}
                onChange={(e) => setFormData(prev => ({ ...prev, buttonText: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#06b6d4] focus:border-transparent"
                placeholder="e.g., Learn More, Get Started, Try Free"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* Image Upload Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Ad Image</h2>
          
          {imagePreview && !selectedImage ? (
            <div className="flex items-start gap-4">
              <img
                src={imagePreview}
                alt="Ad preview"
                className="w-40 h-32 rounded-lg object-cover border border-gray-200"
              />
              <div>
                <p className="text-sm text-gray-600 mb-2">Image uploaded successfully</p>
                <button
                  type="button"
                  onClick={() => {
                    setImageBlob(null)
                    setImagePreview(null)
                  }}
                  className="text-sm text-[#06b6d4] hover:underline"
                >
                  Remove and upload different image
                </button>
              </div>
            </div>
          ) : selectedImage ? (
            <div className="space-y-4">
              <div className="border rounded-lg p-4 bg-gray-50">
                <p className="text-sm text-gray-600 mb-3">Crop your image (5:4 ratio recommended)</p>
                <div className="max-w-md mx-auto">
                  <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={5 / 4}
                  >
                    <img
                      ref={imgRef}
                      src={selectedImage}
                      alt="Crop preview"
                      onLoad={onImageLoad}
                      className="max-h-64"
                    />
                  </ReactCrop>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleApplyCrop}
                  disabled={!completedCrop}
                  className="px-4 py-2 bg-[#06b6d4] text-white rounded-lg text-sm font-medium hover:bg-[#06b6d4]/90 disabled:opacity-50"
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
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-[#06b6d4] transition-colors">
              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700">Upload Image</span>
              <span className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                disabled={isSubmitting}
              />
            </label>
          )}
          <p className="mt-3 text-xs text-gray-500">
            Upload your logo or a product image. We&apos;ll incorporate it into the final ad design.
          </p>
        </div>

        {/* Date Selection Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Select Newsletter Dates</h2>
          
          <DatePicker
            selectedDates={selectedDates}
            onDatesChange={setSelectedDates}
            useNextAvailable={useNextAvailable}
            onToggleNextAvailable={handleToggleNextAvailable}
            nextAvailableDays={nextAvailableDays}
            onNextAvailableDaysChange={setNextAvailableDays}
          />
        </div>

        {/* Pricing Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Number of days</span>
              <span className="font-medium text-gray-900">{numDays}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Price per day</span>
              <div className="text-right">
                {pricing.hasDiscount ? (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 line-through text-sm">${PRICE_PER_DAY}</span>
                    <span className="font-medium text-emerald-600">${pricing.pricePerDay}</span>
                  </div>
                ) : (
                  <span className="font-medium text-gray-900">${pricing.pricePerDay}</span>
                )}
              </div>
            </div>

            {pricing.hasDiscount && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-emerald-600">Volume discount (4+ days)</span>
                <span className="font-medium text-emerald-600">-${pricing.savings}</span>
              </div>
            )}
            
            <div className="pt-3 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-gray-900">${pricing.total.toLocaleString()}</span>
              </div>
            </div>

            {!pricing.hasDiscount && numDays > 0 && numDays < DISCOUNT_THRESHOLD && (
              <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                💡 Add {DISCOUNT_THRESHOLD - numDays} more {DISCOUNT_THRESHOLD - numDays === 1 ? 'day' : 'days'} to save ${(PRICE_PER_DAY - DISCOUNTED_PRICE_PER_DAY) * DISCOUNT_THRESHOLD} with our volume discount!
              </p>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-between items-center">
          <Link
            href="/account/ads/newsletter"
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || numDays === 0}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#a855f7] via-[#06b6d4] to-[#14b8a6] text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <CreditCard className="w-5 h-5" />
            {isSubmitting ? 'Processing...' : `Proceed to Checkout • $${pricing.total.toLocaleString()}`}
          </button>
        </div>
      </form>
    </div>
  )
}
