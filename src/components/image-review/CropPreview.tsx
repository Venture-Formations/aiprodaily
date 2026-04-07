'use client'

import { RefObject } from 'react'

interface CropPreviewProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  cropOffset: number
  setCropOffset: (value: number) => void
  canAdjustVertical: boolean
}

export function CropPreview({ canvasRef, cropOffset, setCropOffset, canAdjustVertical }: CropPreviewProps) {
  return (
    <div className="flex flex-col min-h-0">
      <h3 className="text-md font-medium mb-2">16:9 Crop Preview</h3>
      <div className="flex flex-col justify-center">
        <canvas
          ref={canvasRef}
          className="border rounded shadow-sm mx-auto"
          style={{ maxWidth: '100%', height: 'auto' }}
        />

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Vertical Position
          </label>
          {canAdjustVertical ? (
            <>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">Top</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={cropOffset}
                  onChange={(e) => setCropOffset(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-xs text-gray-500">Bottom</span>
              </div>
              <div className="text-center text-xs text-gray-500 mt-1">
                Position: {Math.round(cropOffset * 100)}%
              </div>
            </>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">
                Vertical position adjustment not available
              </div>
              <div className="text-xs text-gray-400">
                This image is wider than 16:9, so the full height is used for the crop.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
