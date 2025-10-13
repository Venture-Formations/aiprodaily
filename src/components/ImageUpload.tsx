'use client'

import { useState, useCallback, useRef } from 'react'
import { ImageUploadRequest, ImageUploadResponse, ImageAnalysisResult } from '@/types/database'
import ImageReview from './ImageReview'

interface UploadProgress {
  file: File
  status: 'pending' | 'uploading' | 'analyzing' | 'completed' | 'error' | 'skipped'
  progress: number
  error?: string
  imageId?: string
  analysisResult?: ImageAnalysisResult
}

interface ImageUploadProps {
  onComplete?: (results: UploadProgress[]) => void
  onClose?: () => void
  maxFiles?: number
  maxSizeBytes?: number
}

export default function ImageUpload({
  onComplete,
  onClose,
  maxFiles = 10,
  maxSizeBytes = 10 * 1024 * 1024 // 10MB
}: ImageUploadProps) {
  const [uploads, setUploads] = useState<UploadProgress[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith('image/')) {
      return 'File must be an image'
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return 'Only JPEG, PNG, GIF, and WebP images are allowed'
    }

    if (file.size > maxSizeBytes) {
      return `File size must be less than ${Math.round(maxSizeBytes / 1024 / 1024)}MB`
    }

    return null
  }

  const updateUpload = (index: number, updates: Partial<UploadProgress>) => {
    setUploads(prev => prev.map((upload, i) =>
      i === index ? { ...upload, ...updates } : upload
    ))
  }

  const processFile = async (file: File, index: number) => {
    try {
      // Step 1: Get upload URL
      updateUpload(index, { status: 'uploading', progress: 10 })

      const uploadRequest: ImageUploadRequest = {
        filename: file.name,
        content_type: file.type,
        size: file.size
      }

      const uploadResponse = await fetch('/api/images/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uploadRequest)
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('Upload URL error:', uploadResponse.status, errorText)
        let error
        try {
          error = JSON.parse(errorText)
        } catch {
          error = { error: errorText }
        }
        throw new Error(error.error || `Failed to get upload URL: ${uploadResponse.status} ${uploadResponse.statusText}`)
      }

      const uploadData: ImageUploadResponse = await uploadResponse.json()
      updateUpload(index, { progress: 30, imageId: uploadData.image_id })

      // Step 2: Upload file to Supabase using proper headers
      const uploadFileResponse = await fetch(uploadData.upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          'Content-Length': file.size.toString()
        },
        body: file
      })

      if (!uploadFileResponse.ok) {
        const errorText = await uploadFileResponse.text()
        console.error('Upload file error:', uploadFileResponse.status, errorText)
        throw new Error(`Failed to upload file: ${uploadFileResponse.status} ${uploadFileResponse.statusText} - ${errorText}`)
      }

      updateUpload(index, { progress: 60 })

      // Step 3: Analyze with AI
      updateUpload(index, { status: 'analyzing', progress: 70 })

      const analysisResponse = await fetch('/api/images/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_id: uploadData.image_id
        })
      })

      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text()
        console.error('Analysis error:', analysisResponse.status, errorText)
        let error
        try {
          error = JSON.parse(errorText)
        } catch {
          error = { error: errorText }
        }
        throw new Error(error.error || `Failed to analyze image: ${analysisResponse.status} ${analysisResponse.statusText}`)
      }

      const analysisResult: ImageAnalysisResult = await analysisResponse.json()

      updateUpload(index, {
        status: 'completed',
        progress: 100,
        analysisResult
      })

    } catch (error) {
      console.error('Upload error:', error)
      updateUpload(index, {
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  const handleFiles = async (files: FileList) => {
    const fileArray = Array.from(files).slice(0, maxFiles)

    // Validate files
    const newUploads: UploadProgress[] = fileArray.map(file => {
      const error = validateFile(file)
      return {
        file,
        status: error ? 'error' : 'pending',
        progress: 0,
        error
      } as UploadProgress
    })

    setUploads(newUploads)
    setIsProcessing(true)

    // Process valid files
    const validUploads = newUploads.filter(upload => !upload.error)
    await Promise.all(
      validUploads.map((upload, index) => {
        const originalIndex = newUploads.findIndex(u => u.file === upload.file)
        return processFile(upload.file, originalIndex)
      })
    )

    setIsProcessing(false)

    // Wait for state updates to complete, then check current uploads state
    setTimeout(() => {
      setUploads(currentUploads => {
        const completedUploads = currentUploads.filter(
          upload => upload.status === 'completed' && upload.analysisResult && upload.imageId
        )

        if (completedUploads.length > 0) {
          setShowReview(true)
        } else {
          if (onComplete) {
            onComplete(currentUploads)
          }
        }

        return currentUploads // No state change, just checking
      })
    }, 100)
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files)
    }
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files)
    }
  }

  const getStatusColor = (status: UploadProgress['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600'
      case 'error': return 'text-red-600'
      case 'uploading':
      case 'analyzing': return 'text-blue-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusText = (upload: UploadProgress) => {
    switch (upload.status) {
      case 'pending': return 'Waiting...'
      case 'uploading': return 'Uploading...'
      case 'analyzing': return 'Analyzing...'
      case 'completed': return 'Complete'
      case 'error': return upload.error || 'Error'
      default: return 'Unknown'
    }
  }

  const handleReviewComplete = (processedImages: any[]) => {
    setShowReview(false)
    if (onComplete) {
      onComplete(uploads)
    }
  }

  const handleReviewClose = () => {
    setShowReview(false)
    if (onComplete) {
      onComplete(uploads)
    }
  }

  const completedCount = uploads.filter(u => u.status === 'completed').length
  const errorCount = uploads.filter(u => u.status === 'error').length
  const allCompleted = uploads.length > 0 && uploads.every(u => u.status === 'completed' || u.status === 'error')

  // Show review page if requested
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
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          )}
        </div>

        {uploads.length === 0 ? (
          <>
            {/* Upload Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="space-y-4">
                <div className="text-4xl text-gray-400">📷</div>
                <div>
                  <p className="text-lg font-medium text-gray-900">
                    Drop images here or click to browse
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    PNG, JPG, GIF, WebP up to {Math.round(maxSizeBytes / 1024 / 1024)}MB each
                  </p>
                  <p className="text-sm text-gray-500">
                    Maximum {maxFiles} files
                  </p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
                >
                  Choose Files
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
            />
          </>
        ) : (
          <>
            {/* Progress Summary */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">
                  Processing {uploads.length} file{uploads.length !== 1 ? 's' : ''}
                </span>
                <span className="text-sm text-gray-600">
                  {completedCount} completed, {errorCount} errors
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${uploads.length > 0 ? (completedCount + errorCount) / uploads.length * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            {/* File List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {uploads.map((upload, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <div className="flex-shrink-0">
                    {upload.file.type.startsWith('image/') && (
                      <img
                        src={URL.createObjectURL(upload.file)}
                        alt={upload.file.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}
                  </div>

                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-medium truncate">
                      {upload.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {Math.round(upload.file.size / 1024)} KB
                    </p>
                    {upload.analysisResult && (
                      <p className="text-xs text-gray-600 truncate">
                        {upload.analysisResult.caption}
                      </p>
                    )}
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <p className={`text-sm font-medium ${getStatusColor(upload.status)}`}>
                      {getStatusText(upload)}
                    </p>
                    {upload.status !== 'error' && upload.status !== 'completed' && (
                      <div className="w-16 bg-gray-200 rounded-full h-1 mt-1">
                        <div
                          className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${upload.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center mt-6">
              <button
                onClick={() => {
                  setUploads([])
                  setIsProcessing(false)
                }}
                disabled={isProcessing}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Start Over
              </button>

              <div className="space-x-3">
                {allCompleted && onClose && (
                  <button
                    onClick={onClose}
                    className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700"
                  >
                    Done ({completedCount} uploaded)
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}