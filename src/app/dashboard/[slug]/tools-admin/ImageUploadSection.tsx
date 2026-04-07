'use client'

import { useState, useRef } from 'react'
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { getCroppedImage } from '@/utils/imageCrop'
import { isValidImageUrl } from './types'

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

interface ImageUploadSectionProps {
  label: string
  currentUrl: string | null
  aspectRatio: number
  aspectLabel: string
  previewSize: { width: number; height: number }
  onCropComplete: (blob: Blob) => void
  disabled?: boolean
}

export default function ImageUploadSection({
  label,
  currentUrl,
  aspectRatio,
  aspectLabel,
  previewSize,
  onCropComplete,
  disabled
}: ImageUploadSectionProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [newPreview, setNewPreview] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        setSelectedImage(reader.result as string)
        setCrop(undefined)
        setCompletedCrop(undefined)
        setNewPreview(null)
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
        setNewPreview(URL.createObjectURL(croppedBlob))
        onCropComplete(croppedBlob)
        setSelectedImage(null)
      }
    } catch (err) {
      console.error('Failed to crop image:', err)
    }
  }

  const displayUrl = newPreview || (isValidImageUrl(currentUrl) ? currentUrl : null)

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>

      {/* Show current/new preview */}
      {displayUrl && !selectedImage && (
        <div className="flex items-center gap-4 mb-2">
          <img
            src={displayUrl}
            alt={label}
            className="rounded-lg object-cover border border-gray-200"
            style={{ width: previewSize.width, height: previewSize.height }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
            disabled={disabled}
          >
            Replace
          </button>
        </div>
      )}

      {/* Upload button when no image */}
      {!displayUrl && !selectedImage && (
        <div className="mb-2">
          <label
            className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors"
            style={{ width: previewSize.width, height: previewSize.height }}
          >
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="mt-1 text-xs text-gray-500">Upload</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
              disabled={disabled}
            />
          </label>
        </div>
      )}

      {/* Hidden file input for replace button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
        disabled={disabled}
      />

      {/* Crop UI */}
      {selectedImage && (
        <div className="space-y-3">
          <div className="border rounded-lg p-3 bg-gray-50">
            <p className="text-xs text-gray-600 mb-2">Crop to {aspectLabel}</p>
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspectRatio}
            >
              <img
                ref={imgRef}
                src={selectedImage}
                alt="Crop preview"
                onLoad={onImageLoad}
                style={{ maxWidth: '100%', maxHeight: '200px' }}
              />
            </ReactCrop>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApplyCrop}
              disabled={!completedCrop}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedImage(null)
                setCrop(undefined)
                setCompletedCrop(undefined)
              }}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <p className="text-xs text-gray-500 mt-1">{aspectLabel} ratio</p>
    </div>
  )
}
