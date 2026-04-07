'use client'

import { useState, useRef } from 'react'
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { getCroppedImage } from '@/utils/imageCrop'

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

// --- Image Upload Component ---

export interface ImageUploadProps {
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

export function ImageUpload({
  label,
  description,
  aspectRatio,
  aspectLabel,
  previewSize,
  croppedPreview,
  onCropComplete,
  onClear,
  disabled,
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
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>

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
          <button type="button" onClick={onClear} className="mt-2 text-sm text-blue-600 hover:text-blue-500">
            Choose different image
          </button>
        </div>
      )}

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
                    <img ref={imgRef} src={selectedImage} alt="Crop preview" onLoad={onImageLoad} className="max-h-80" />
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
                  onClick={() => { setSelectedImage(null); setCrop(undefined); setCompletedCrop(undefined) }}
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
                <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" disabled={disabled} />
              </label>
            </div>
          )}
        </>
      )}
      <p className="mt-2 text-sm text-gray-500">{description}</p>
    </div>
  )
}

// --- Featured Upgrade Modal ---

interface FeaturedUpgradeModalProps {
  isOpen: boolean
  categoryName: string
  monthlyPrice: number
  onUpgrade: () => void
  onContinueFree: () => void
  isLoading: boolean
}

export function FeaturedUpgradeModal({
  isOpen,
  categoryName,
  monthlyPrice,
  onUpgrade,
  onContinueFree,
  isLoading,
}: FeaturedUpgradeModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onContinueFree} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-amber-500 text-white text-center py-3 px-4">
          <p className="font-bold text-lg">Only 1 Featured Listing Per Category</p>
        </div>
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">
            Claim the #1 Position in {categoryName}!
          </h2>
          <p className="text-gray-600 text-center mb-4">
            This category doesn&apos;t have a featured listing yet — <span className="font-semibold text-amber-600">the spot is yours for the taking!</span>
          </p>
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-lg p-4 mb-6">
            <p className="text-amber-800 text-center font-medium">
              Once claimed, no other tool in {categoryName} can be featured until you cancel.
            </p>
          </div>
          <ul className="space-y-2 mb-6">
            {[`#1 position in ${categoryName}`, '"Featured" badge on your listing', 'Highlighted card design', 'Priority in search results'].map((benefit) => (
              <li key={benefit} className="flex items-center gap-2 text-sm text-gray-700">
                <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {benefit}
              </li>
            ))}
          </ul>
          <div className="text-center mb-6">
            <span className="text-3xl font-bold text-gray-900">${monthlyPrice}</span>
            <span className="text-gray-500">/month</span>
          </div>
          <div className="space-y-3">
            <button
              onClick={onUpgrade}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </>
              ) : (
                `Upgrade to Featured - $${monthlyPrice}/mo`
              )}
            </button>
            <button
              onClick={onContinueFree}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Continue with Free Listing
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
