'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { UploadResult, ProcessedImage, SourceFields } from './types'

export function useImageReview(
  uploadResults: UploadResult[],
  onComplete: (processedImages: ProcessedImage[]) => void,
  onClose: () => void,
  onUpdateUploadResults: (updatedResults: UploadResult[]) => void
) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([])
  const [cropOffset, setCropOffset] = useState(0.5)
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [location, setLocation] = useState('')
  const [ocrText, setOcrText] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [source, setSource] = useState('')
  const [license, setLicense] = useState('')
  const [credit, setCredit] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [tagSuggestions, setTagSuggestions] = useState<any[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [canAdjustVertical, setCanAdjustVertical] = useState(true)
  const [loadingStockPhoto, setLoadingStockPhoto] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const completedUploads = uploadResults.filter(
    result => result.status === 'completed' && result.analysisResult && result.imageId
  )

  const currentUpload = completedUploads[currentIndex]

  // Initialize current image data
  useEffect(() => {
    if (currentUpload?.analysisResult) {
      const existingProcessed = processedImages.find(p => p.imageId === currentUpload.imageId)
      if (existingProcessed) {
        setCropOffset(existingProcessed.cropOffset)
        setTags(existingProcessed.tags)
        setLocation(existingProcessed.location)
        setOcrText(existingProcessed.ocrText)
        setSourceUrl('')
        setSource('')
        setLicense('')
        setCredit('')
      } else {
        setCropOffset(0.5)
        setTags(currentUpload.analysisResult.top_tags || [])
        setLocation('')
        setOcrText(currentUpload.analysisResult.ocr_text || '')
        setSourceUrl('')
        setSource('')
        setLicense('')
        setCredit('')
      }
    }
  }, [currentIndex, currentUpload, processedImages])

  const updateCropPreview = useCallback(() => {
    if (!canvasRef.current || !imageRef.current || !currentUpload) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = imageRef.current

    if (!ctx || !img.complete) return

    const targetWidth = 400
    const targetHeight = Math.round(targetWidth / (16 / 9))
    canvas.width = targetWidth
    canvas.height = targetHeight

    const originalWidth = img.naturalWidth
    const originalHeight = img.naturalHeight
    const targetAspectRatio = 16 / 9
    const originalAspectRatio = originalWidth / originalHeight

    let sourceWidth, sourceHeight, sourceX, sourceY

    if (originalAspectRatio > targetAspectRatio) {
      sourceHeight = originalHeight
      sourceWidth = Math.round(sourceHeight * targetAspectRatio)
      sourceX = Math.round((originalWidth - sourceWidth) / 2)
      sourceY = 0
      setCanAdjustVertical(false)
    } else {
      sourceWidth = originalWidth
      sourceHeight = Math.round(sourceWidth / targetAspectRatio)
      sourceX = 0
      const maxTop = originalHeight - sourceHeight
      sourceY = Math.round(cropOffset * maxTop)
      setCanAdjustVertical(true)
    }

    ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight)
    ctx.strokeStyle = '#3B82F6'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, targetWidth, targetHeight)
  }, [cropOffset, currentUpload])

  // Update crop preview when offset changes
  useEffect(() => {
    updateCropPreview()
  }, [updateCropPreview])

  const saveCurrentImage = useCallback(() => {
    if (!currentUpload?.imageId) return

    const processed: ProcessedImage = {
      imageId: currentUpload.imageId,
      tags,
      cropOffset,
      location,
      ocrText,
      skipped: false
    }

    setProcessedImages(prev => {
      const filtered = prev.filter(p => p.imageId !== currentUpload.imageId)
      return [...filtered, processed]
    })
  }, [currentUpload, tags, cropOffset, location, ocrText])

  const handleNext = useCallback(() => {
    saveCurrentImage()
    if (currentIndex < completedUploads.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }, [saveCurrentImage, currentIndex, completedUploads.length])

  const handlePrevious = useCallback(() => {
    saveCurrentImage()
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }, [saveCurrentImage, currentIndex])

  const handleSkip = useCallback(async () => {
    if (!currentUpload?.imageId) return

    try {
      const response = await fetch(`/api/images/${currentUpload.imageId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete image')

      const updatedUploads = uploadResults.filter(upload => upload.imageId !== currentUpload.imageId)
      onUpdateUploadResults(updatedUploads)

      const newCompletedUploads = updatedUploads.filter(
        result => result.status === 'completed' && result.analysisResult && result.imageId
      )

      if (newCompletedUploads.length === 0) {
        onComplete([])
        return
      }

      if (currentIndex >= newCompletedUploads.length) {
        setCurrentIndex(Math.max(0, newCompletedUploads.length - 1))
      }
    } catch (error) {
      console.error('Error deleting image:', error)
      alert('Failed to delete image. Please try again.')
    }
  }, [currentUpload, uploadResults, onUpdateUploadResults, onComplete, currentIndex])

  const fetchTagSuggestions = useCallback(async (input: string) => {
    if (input.length < 2) {
      setTagSuggestions([])
      return
    }

    setLoadingSuggestions(true)
    try {
      const response = await fetch('/api/tags/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, existing_tags: tags })
      })
      if (response.ok) {
        const data = await response.json()
        setTagSuggestions(data.suggestions || [])
      }
    } catch (error) {
      console.error('Failed to fetch tag suggestions:', error)
      setTagSuggestions([])
    } finally {
      setLoadingSuggestions(false)
    }
  }, [tags])

  const handleAddTag = useCallback(async () => {
    if (newTag.trim()) {
      await fetchTagSuggestions(newTag.trim())
    }
  }, [newTag, fetchTagSuggestions])

  const addManualTag = useCallback(() => {
    if (newTag.trim() && !tags.includes(newTag.trim().toLowerCase())) {
      setTags([...tags, newTag.trim().toLowerCase()])
      setNewTag('')
      setTagSuggestions([])
    }
  }, [newTag, tags])

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }, [tags])

  const addSuggestedTag = useCallback((formattedTag: string) => {
    if (!tags.includes(formattedTag)) {
      setTags([...tags, formattedTag])
    }
    setTagSuggestions([])
    setNewTag('')
  }, [tags])

  const handleStockPhotoLookup = useCallback(async () => {
    if (!currentUpload?.imageId) return

    setLoadingStockPhoto(true)
    try {
      const response = await fetch('/api/images/reverse-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id: currentUpload.imageId })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.results && data.results.length > 0) {
          const bestResult = data.results[0]
          if (bestResult.source_url) setSourceUrl(bestResult.source_url)
          if (bestResult.source_name) {
            const sourceName = bestResult.source_name.toLowerCase()
            if (sourceName.includes('shutterstock')) setSource('Shutterstock')
            else if (sourceName.includes('getty')) setSource('Getty Images')
            else if (sourceName.includes('unsplash')) setSource('Unsplash')
            else if (sourceName.includes('pexels')) setSource('Pexels')
            else if (sourceName.includes('pixabay')) setSource('Pixabay')
            else setSource(bestResult.source_name)
          }
          if (bestResult.license_info) setLicense(bestResult.license_info)
          if (bestResult.creator) setCredit(bestResult.creator)
          alert(`Found ${data.results.length} potential source(s). Best match auto-populated.`)
        } else {
          alert('No stock photo sources found for this image.')
        }
      } else {
        const errorData = await response.json()
        alert(`Lookup failed: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Stock photo lookup error:', error)
      alert('Failed to perform reverse image lookup. Please try again.')
    } finally {
      setLoadingStockPhoto(false)
    }
  }, [currentUpload])

  const handleFinish = useCallback(async () => {
    saveCurrentImage()
    setIsProcessing(true)

    try {
      const finalProcessed = [...processedImages]

      if (currentUpload?.imageId && !finalProcessed.find(p => p.imageId === currentUpload.imageId)) {
        finalProcessed.push({
          imageId: currentUpload.imageId,
          tags,
          cropOffset,
          location,
          ocrText,
          skipped: false
        })
      }

      for (const processed of finalProcessed.filter(p => !p.skipped)) {
        await fetch('/api/images/review/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_id: processed.imageId,
            ai_tags: processed.tags,
            crop_v_offset: processed.cropOffset,
            city: processed.location,
            source_url: sourceUrl,
            source: source,
            license: license,
            credit: credit
          })
        })
      }

      onComplete(finalProcessed)
      onClose()
    } catch (error) {
      console.error('Error processing images:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [saveCurrentImage, processedImages, currentUpload, tags, cropOffset, location, ocrText, sourceUrl, source, license, credit, onComplete, onClose])

  const sourceFields: SourceFields = { sourceUrl, source, license, credit }
  const setSourceFields = {
    setSourceUrl,
    setSource,
    setLicense,
    setCredit
  }

  return {
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
  }
}
