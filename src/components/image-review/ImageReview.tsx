'use client'

import type { ImageReviewProps } from './types'
import { useImageReview } from './useImageReview'
import { CropPreview } from './CropPreview'
import { TagManager } from './TagManager'
import { AnalysisPanel } from './AnalysisPanel'

export default function ImageReview({ uploadResults, onComplete, onClose, onUpdateUploadResults }: ImageReviewProps) {
  const {
    currentIndex,
    completedUploads,
    currentUpload,
    cropOffset,
    setCropOffset,
    tags,
    newTag,
    setNewTag,
    location,
    setLocation,
    ocrText,
    setOcrText,
    sourceFields,
    setSourceFields,
    isProcessing,
    tagSuggestions,
    setTagSuggestions,
    loadingSuggestions,
    canAdjustVertical,
    loadingStockPhoto,
    canvasRef,
    imageRef,
    updateCropPreview,
    handleNext,
    handlePrevious,
    handleSkip,
    handleAddTag,
    addManualTag,
    handleRemoveTag,
    addSuggestedTag,
    handleStockPhotoLookup,
    handleFinish,
  } = useImageReview(uploadResults, onComplete, onClose, onUpdateUploadResults)

  if (completedUploads.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h2 className="text-xl font-semibold mb-4">No Images to Review</h2>
          <p className="text-gray-600 mb-4">No successfully analyzed images found to review.</p>
          <button
            onClick={onClose}
            className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  if (!currentUpload) {
    return null
  }

  const imageUrl = URL.createObjectURL(currentUpload.file)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 max-w-7xl w-full mx-4 h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold">Review Images</h2>
            <p className="text-sm text-gray-600">
              Image {currentIndex + 1} of {completedUploads.length}: {currentUpload.file.name}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            &#10005;
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
          {/* Left Column: Original Image and Crop Preview */}
          <div className="flex flex-col min-h-0 space-y-4">
            <div className="flex flex-col min-h-0">
              <h3 className="text-md font-medium mb-2">Original Image</h3>
              <div className="flex-1 flex items-center justify-center min-h-0">
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt={currentUpload.file.name}
                  className="max-w-full max-h-full object-contain rounded border shadow-sm"
                  onLoad={updateCropPreview}
                />
              </div>
            </div>

            <CropPreview
              canvasRef={canvasRef}
              cropOffset={cropOffset}
              setCropOffset={setCropOffset}
              canAdjustVertical={canAdjustVertical}
            />
          </div>

          {/* Right Column: Tag Management */}
          <div className="flex flex-col min-h-0 overflow-y-auto">
            <h3 className="text-md font-medium mb-2">Review Tags</h3>

            {/* AI Caption */}
            {currentUpload.analysisResult?.caption &&
             currentUpload.analysisResult.caption.trim().length > 0 &&
             currentUpload.analysisResult.caption.trim() !== 'No caption' &&
             currentUpload.analysisResult.caption.trim() !== 'None' &&
             currentUpload.analysisResult.caption.trim() !== 'N/A' && (
              <div className="mb-3 p-2 bg-blue-50 rounded text-xs">
                <p className="font-medium text-blue-900 mb-1">AI Caption:</p>
                <p className="text-blue-800">{currentUpload.analysisResult.caption}</p>
              </div>
            )}

            {/* AI Determined Data Section */}
            {currentUpload.analysisResult && (
              <AnalysisPanel
                analysisResult={currentUpload.analysisResult}
                sourceFields={sourceFields}
                setSourceFields={setSourceFields}
                loadingStockPhoto={loadingStockPhoto}
                onStockPhotoLookup={handleStockPhotoLookup}
              />
            )}

            <TagManager
              tags={tags}
              newTag={newTag}
              setNewTag={setNewTag}
              tagSuggestions={tagSuggestions}
              setTagSuggestions={setTagSuggestions}
              loadingSuggestions={loadingSuggestions}
              onAddTag={handleAddTag}
              onAddManualTag={addManualTag}
              onRemoveTag={handleRemoveTag}
              onAddSuggestedTag={addSuggestedTag}
            />

            {/* City Field */}
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-700 mb-2">City:</p>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., St. Cloud"
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>

            {/* OCR Text Field */}
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-700 mb-2">OCR Text:</p>
              <textarea
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                placeholder="Text found in image (editable)"
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                Edit or add text that appears in the image for better searchability
              </p>
            </div>

            {/* AI Analysis Info */}
            {currentUpload.analysisResult && (
              <div className="text-xs text-gray-500 space-y-1 mt-auto">
                <p>Dimensions: {currentUpload.analysisResult.width} &times; {currentUpload.analysisResult.height}</p>
                <p>Safety Score: {Math.round((currentUpload.analysisResult.safe_score || 0) * 100)}%</p>
                {currentUpload.analysisResult.faces_count > 0 && (
                  <p>Faces: {currentUpload.analysisResult.faces_count}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="flex justify-between items-center mt-4 pt-3 border-t flex-shrink-0">
          <div className="flex space-x-2">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &larr; Previous
            </button>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleSkip}
              className="px-4 py-2 border border-red-300 text-red-700 rounded-md text-sm hover:bg-red-50"
            >
              Skip This Image
            </button>
            <button
              onClick={currentIndex === completedUploads.length - 1 ? handleFinish : handleNext}
              disabled={isProcessing}
              className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isProcessing ? 'Processing...' : (currentIndex === completedUploads.length - 1 ? 'Finish' : 'Next \u2192')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
