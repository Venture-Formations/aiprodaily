'use client'

import { RefObject } from 'react'
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface ImageSectionProps {
  adImageUrl?: string | null
  adTitle: string
  selectedImage: string | null
  crop: Crop | undefined
  setCrop: (crop: Crop) => void
  completedCrop: PixelCrop | undefined
  setCompletedCrop: (crop: PixelCrop) => void
  fileInputRef: RefObject<HTMLInputElement | null>
  imgRef: RefObject<HTMLImageElement | null>
  imageAlt: string
  onImageAltChange: (value: string) => void
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClearImage: () => void
}

export default function ImageSection({
  adImageUrl,
  adTitle,
  selectedImage,
  crop,
  setCrop,
  setCompletedCrop,
  fileInputRef,
  imgRef,
  imageAlt,
  onImageAltChange,
  onImageSelect,
  onClearImage,
}: ImageSectionProps) {
  return (
    <>
      {/* Current Image Display */}
      {adImageUrl && !selectedImage && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Current Image
          </label>
          <img
            src={adImageUrl}
            alt={adTitle}
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
            onChange={onImageSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Image Upload (if no current image) */}
      {!adImageUrl && !selectedImage && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Advertisement Image (Optional)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onImageSelect}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <p className="text-xs text-gray-500 mt-1">
            Upload an image for your ad. It will be cropped to 16:9 ratio.
          </p>
        </div>
      )}

      {/* Image Alt Text */}
      {(adImageUrl || selectedImage) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Image Alt Text
          </label>
          <input
            type="text"
            maxLength={200}
            value={imageAlt}
            onChange={(e) => onImageAltChange(e.target.value)}
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
            onClick={onClearImage}
            className="mt-2 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-sm"
          >
            Cancel Image Change
          </button>
        </div>
      )}
    </>
  )
}
