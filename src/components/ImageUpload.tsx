'use client'

import ImageReview from './ImageReview'
import { useImageUpload, type UploadProgress } from './useImageUpload'

interface ImageUploadProps {
  onComplete?: (results: UploadProgress[]) => void
  onClose?: () => void
  maxFiles?: number
  maxSizeBytes?: number
}

export default function ImageUpload({
  onComplete, onClose, maxFiles = 10, maxSizeBytes = 10 * 1024 * 1024
}: ImageUploadProps) {
  const {
    uploads, setUploads, isDragging, isProcessing, showReview, fileInputRef,
    completedCount, errorCount, allCompleted,
    handleDragOver, handleDragLeave, handleDrop, handleFileInput,
    getStatusColor, getStatusText,
    handleReviewComplete, handleReviewClose, startOver,
  } = useImageUpload({ onComplete, maxFiles, maxSizeBytes })

  if (showReview) {
    return (
      <ImageReview
        uploadResults={uploads}
        onComplete={handleReviewComplete}
        onClose={handleReviewClose}
        onUpdateUploadResults={setUploads}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Upload Images</h2>
          {onClose && <button onClick={onClose} className="text-gray-500 hover:text-gray-700">&#x2715;</button>}
        </div>

        {uploads.length === 0 ? (
          <>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            >
              <div className="space-y-4">
                <div className="text-4xl text-gray-400">&#x1F4F7;</div>
                <div>
                  <p className="text-lg font-medium text-gray-900">Drop images here or click to browse</p>
                  <p className="text-sm text-gray-500 mt-2">PNG, JPG, GIF, WebP up to {Math.round(maxSizeBytes / 1024 / 1024)}MB each</p>
                  <p className="text-sm text-gray-500">Maximum {maxFiles} files</p>
                </div>
                <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">Choose Files</button>
              </div>
            </div>
            <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileInput} className="hidden" />
          </>
        ) : (
          <>
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Processing {uploads.length} file{uploads.length !== 1 ? 's' : ''}</span>
                <span className="text-sm text-gray-600">{completedCount} completed, {errorCount} errors</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploads.length > 0 ? (completedCount + errorCount) / uploads.length * 100 : 0}%` }} />
              </div>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {uploads.map((upload, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <div className="flex-shrink-0">
                    {upload.file.type.startsWith('image/') && <img src={URL.createObjectURL(upload.file)} alt={upload.file.name} className="w-12 h-12 object-cover rounded" />}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-medium truncate">{upload.file.name}</p>
                    <p className="text-xs text-gray-500">{Math.round(upload.file.size / 1024)} KB</p>
                    {upload.analysisResult && <p className="text-xs text-gray-600 truncate">{upload.analysisResult.caption}</p>}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className={`text-sm font-medium ${getStatusColor(upload.status)}`}>{getStatusText(upload)}</p>
                    {upload.status !== 'error' && upload.status !== 'completed' && (
                      <div className="w-16 bg-gray-200 rounded-full h-1 mt-1"><div className="bg-blue-600 h-1 rounded-full transition-all duration-300" style={{ width: `${upload.progress}%` }} /></div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center mt-6">
              <button onClick={startOver} disabled={isProcessing} className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50">Start Over</button>
              <div className="space-x-3">
                {allCompleted && onClose && <button onClick={onClose} className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700">Done ({completedCount} uploaded)</button>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
