import { ImageAnalysisResult } from '@/types/database'

export interface UploadResult {
  file: File
  status: 'pending' | 'uploading' | 'analyzing' | 'completed' | 'error' | 'skipped'
  progress: number
  error?: string
  imageId?: string
  analysisResult?: ImageAnalysisResult
}

export interface ProcessedImage {
  imageId: string
  tags: string[]
  cropOffset: number
  location: string
  ocrText: string
  skipped: boolean
}

export interface ImageReviewProps {
  uploadResults: UploadResult[]
  onComplete: (processedImages: ProcessedImage[]) => void
  onClose: () => void
  onUpdateUploadResults: (updatedResults: UploadResult[]) => void
}

export interface SourceFields {
  sourceUrl: string
  source: string
  license: string
  credit: string
}
