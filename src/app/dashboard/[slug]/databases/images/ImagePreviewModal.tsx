'use client'

import { Image } from '@/types/database'

interface ImagePreviewModalProps {
  image: Image
  onClose: () => void
}

export default function ImagePreviewModal({ image, onClose }: ImagePreviewModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="relative max-w-4xl max-h-[90vh] mx-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold z-10"
          title="Close preview"
        >
          x
        </button>

        {/* Image */}
        <img
          src={image.variant_16x9_url || image.cdn_url}
          alt={image.ai_alt_text || 'Image preview'}
          className="max-w-full max-h-[90vh] object-contain rounded shadow-lg"
        />

        {/* Image info */}
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-4 rounded-b">
          <div className="text-sm">
            <p className="font-semibold">{image.ai_caption || 'No caption'}</p>
            {image.city && (
              <p className="text-gray-300">{image.city}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
              <span>{image.width} x {image.height}px</span>
              {image.has_text && <span>Contains text</span>}
              {image.faces_count > 0 && <span>{image.faces_count} face(s)</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Click outside to close */}
      <div
        className="absolute inset-0 -z-10"
        onClick={onClose}
      ></div>
    </div>
  )
}
