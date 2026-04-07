import { useState, useCallback, useRef } from 'react'
import { ImageUploadRequest, ImageUploadResponse, ImageAnalysisResult } from '@/types/database'

export interface UploadProgress {
  file: File
  status: 'pending' | 'uploading' | 'analyzing' | 'completed' | 'error' | 'skipped'
  progress: number
  error?: string
  imageId?: string
  analysisResult?: ImageAnalysisResult
}

interface UseImageUploadProps {
  onComplete?: (results: UploadProgress[]) => void
  maxFiles?: number
  maxSizeBytes?: number
}

export function useImageUpload({
  onComplete,
  maxFiles = 10,
  maxSizeBytes = 10 * 1024 * 1024
}: UseImageUploadProps) {
  const [uploads, setUploads] = useState<UploadProgress[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith('image/')) return 'File must be an image'
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) return 'Only JPEG, PNG, GIF, and WebP images are allowed'
    if (file.size > maxSizeBytes) return `File size must be less than ${Math.round(maxSizeBytes / 1024 / 1024)}MB`
    return null
  }

  const updateUpload = (index: number, updates: Partial<UploadProgress>) => {
    setUploads(prev => prev.map((upload, i) =>
      i === index ? { ...upload, ...updates } : upload
    ))
  }

  const processFile = async (file: File, index: number) => {
    try {
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
        try { error = JSON.parse(errorText) } catch { error = { error: errorText } }
        throw new Error(error.error || `Failed to get upload URL: ${uploadResponse.status} ${uploadResponse.statusText}`)
      }

      const uploadData: ImageUploadResponse = await uploadResponse.json()
      updateUpload(index, { progress: 30, imageId: uploadData.image_id })

      const uploadFileResponse = await fetch(uploadData.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type, 'Content-Length': file.size.toString() },
        body: file
      })

      if (!uploadFileResponse.ok) {
        const errorText = await uploadFileResponse.text()
        console.error('Upload file error:', uploadFileResponse.status, errorText)
        throw new Error(`Failed to upload file: ${uploadFileResponse.status} ${uploadFileResponse.statusText} - ${errorText}`)
      }

      updateUpload(index, { progress: 60 })
      updateUpload(index, { status: 'analyzing', progress: 70 })

      const analysisResponse = await fetch('/api/images/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id: uploadData.image_id })
      })

      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text()
        console.error('Analysis error:', analysisResponse.status, errorText)
        let error
        try { error = JSON.parse(errorText) } catch { error = { error: errorText } }
        throw new Error(error.error || `Failed to analyze image: ${analysisResponse.status} ${analysisResponse.statusText}`)
      }

      const analysisResult: ImageAnalysisResult = await analysisResponse.json()
      updateUpload(index, { status: 'completed', progress: 100, analysisResult })
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
    const newUploads: UploadProgress[] = fileArray.map(file => {
      const error = validateFile(file)
      return { file, status: error ? 'error' : 'pending', progress: 0, error } as UploadProgress
    })

    setUploads(newUploads)
    setIsProcessing(true)

    const validUploads = newUploads.filter(upload => !upload.error)
    await Promise.all(
      validUploads.map((upload) => {
        const originalIndex = newUploads.findIndex(u => u.file === upload.file)
        return processFile(upload.file, originalIndex)
      })
    )

    setIsProcessing(false)

    setTimeout(() => {
      setUploads(currentUploads => {
        const completedUploads = currentUploads.filter(
          upload => upload.status === 'completed' && upload.analysisResult && upload.imageId
        )
        if (completedUploads.length > 0) {
          setShowReview(true)
        } else if (onComplete) {
          onComplete(currentUploads)
        }
        return currentUploads
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
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files)
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

  const handleReviewComplete = () => {
    setShowReview(false)
    if (onComplete) onComplete(uploads)
  }

  const handleReviewClose = () => {
    setShowReview(false)
    if (onComplete) onComplete(uploads)
  }

  const startOver = () => {
    setUploads([])
    setIsProcessing(false)
  }

  const completedCount = uploads.filter(u => u.status === 'completed').length
  const errorCount = uploads.filter(u => u.status === 'error').length
  const allCompleted = uploads.length > 0 && uploads.every(u => u.status === 'completed' || u.status === 'error')

  return {
    uploads,
    setUploads,
    isDragging,
    isProcessing,
    showReview,
    fileInputRef,
    completedCount,
    errorCount,
    allCompleted,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInput,
    getStatusColor,
    getStatusText,
    handleReviewComplete,
    handleReviewClose,
    startOver,
    maxSizeBytes,
    maxFiles,
  }
}
