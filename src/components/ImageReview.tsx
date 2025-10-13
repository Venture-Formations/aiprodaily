'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { ImageAnalysisResult, ImageTag } from '@/types/database'

interface UploadResult {
  file: File
  status: 'pending' | 'uploading' | 'analyzing' | 'completed' | 'error' | 'skipped'
  progress: number
  error?: string
  imageId?: string
  analysisResult?: ImageAnalysisResult
}

interface ImageReviewProps {
  uploadResults: UploadResult[]
  onComplete: (processedImages: ProcessedImage[]) => void
  onClose: () => void
  onUpdateUploadResults: (updatedResults: UploadResult[]) => void
}

interface ProcessedImage {
  imageId: string
  tags: string[]
  cropOffset: number
  location: string
  ocrText: string
  skipped: boolean
}

export default function ImageReview({ uploadResults, onComplete, onClose, onUpdateUploadResults }: ImageReviewProps) {

  const [currentIndex, setCurrentIndex] = useState(0)
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([])
  const [cropOffset, setCropOffset] = useState(0.5) // 0 = top, 0.5 = center, 1 = bottom
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

  // Filter to only completed uploads with analysis results
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
        // Initialize the new fields as empty since they're not in ProcessedImage yet
        setSourceUrl('')
        setSource('')
        setLicense('')
        setCredit('')
      } else {
        setCropOffset(0.5) // Default to center
        setTags(currentUpload.analysisResult.top_tags || [])
        setLocation('') // Default to empty
        setOcrText(currentUpload.analysisResult.ocr_text || '') // Initialize with OCR text from analysis
        setSourceUrl('')
        setSource('')
        setLicense('')
        setCredit('')
      }
    }
  }, [currentIndex, currentUpload, processedImages])

  // Update crop preview when offset changes
  useEffect(() => {
    updateCropPreview()
  }, [cropOffset, currentUpload])

  const updateCropPreview = () => {
    if (!canvasRef.current || !imageRef.current || !currentUpload) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = imageRef.current

    if (!ctx || !img.complete) return

    // Set canvas size to 16:9 aspect ratio
    const targetWidth = 400
    const targetHeight = Math.round(targetWidth / (16/9))
    canvas.width = targetWidth
    canvas.height = targetHeight

    // Calculate crop area from original image (matching backend Sharp.js logic exactly)
    const originalWidth = img.naturalWidth
    const originalHeight = img.naturalHeight
    const targetAspectRatio = 16 / 9
    const originalAspectRatio = originalWidth / originalHeight

    let sourceWidth, sourceHeight, sourceX, sourceY

    if (originalAspectRatio > targetAspectRatio) {
      // Image is wider than 16:9, crop horizontally
      sourceHeight = originalHeight
      sourceWidth = Math.round(sourceHeight * targetAspectRatio)
      sourceX = Math.round((originalWidth - sourceWidth) / 2)
      sourceY = 0

      // Update state to indicate vertical adjustment is not available
      setCanAdjustVertical(false)
    } else {
      // Image is taller than 16:9, crop vertically
      sourceWidth = originalWidth
      sourceHeight = Math.round(sourceWidth / targetAspectRatio)
      sourceX = 0
      // Apply vertical offset (matching backend exactly)
      const maxTop = originalHeight - sourceHeight
      sourceY = Math.round(cropOffset * maxTop)

      // Update state to indicate vertical adjustment is available
      setCanAdjustVertical(true)
    }


    // Draw the cropped image on canvas
    ctx.drawImage(
      img,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, targetWidth, targetHeight
    )

    // Add a subtle border to show the crop area
    ctx.strokeStyle = '#3B82F6'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, targetWidth, targetHeight)
  }

  const saveCurrentImage = () => {
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
  }

  const handleNext = () => {
    saveCurrentImage()
    if (currentIndex < completedUploads.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handlePrevious = () => {
    saveCurrentImage()
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleSkip = async () => {
    if (!currentUpload?.imageId) return

    try {
      // Delete the image from the database
      const response = await fetch(`/api/images/${currentUpload.imageId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete image')
      }

      // Remove from uploadResults and update parent component
      const updatedUploads = uploadResults.filter(upload => upload.imageId !== currentUpload.imageId)
      onUpdateUploadResults(updatedUploads)

      // Update the completedUploads array
      const newCompletedUploads = updatedUploads.filter(
        result => result.status === 'completed' && result.analysisResult && result.imageId
      )

      if (newCompletedUploads.length === 0) {
        // No more images, close the review
        onComplete([])
        return
      }

      // Navigate to next image or previous if this was the last
      if (currentIndex >= newCompletedUploads.length) {
        // Was the last image, go to previous
        setCurrentIndex(Math.max(0, newCompletedUploads.length - 1))
      }
      // If still images left, stay on current index (will show next image)
      // If this was the last image and there are no more, it will handle automatically

    } catch (error) {
      console.error('Error deleting image:', error)
      alert('Failed to delete image. Please try again.')
    }
  }

  const handleAddTag = async () => {
    if (newTag.trim()) {
      // Fetch AI suggestions for the current input
      await fetchTagSuggestions(newTag.trim())
    }
  }

  const addManualTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim().toLowerCase())) {
      setTags([...tags, newTag.trim().toLowerCase()])
      setNewTag('')
      setTagSuggestions([])
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const fetchTagSuggestions = async (input: string) => {
    if (input.length < 2) {
      setTagSuggestions([])
      return
    }

    setLoadingSuggestions(true)

    try {
      const response = await fetch('/api/tags/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input,
          existing_tags: tags // Pass existing tags to exclude duplicates
        })
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
  }

  const addSuggestedTag = (formattedTag: string) => {
    if (!tags.includes(formattedTag)) {
      setTags([...tags, formattedTag])
    }
    setTagSuggestions([])
    setNewTag('')
  }

  const handleStockPhotoLookup = async () => {
    if (!currentUpload?.imageId) return

    setLoadingStockPhoto(true)
    try {
      const response = await fetch('/api/images/reverse-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_id: currentUpload.imageId
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.results && data.results.length > 0) {
          const bestResult = data.results[0] // Use the first/best result

          // Auto-populate the source fields
          if (bestResult.source_url) {
            setSourceUrl(bestResult.source_url)
          }
          if (bestResult.source_name) {
            // Determine source based on the URL or source name
            const sourceName = bestResult.source_name.toLowerCase()
            if (sourceName.includes('shutterstock')) {
              setSource('Shutterstock')
            } else if (sourceName.includes('getty')) {
              setSource('Getty Images')
            } else if (sourceName.includes('unsplash')) {
              setSource('Unsplash')
            } else if (sourceName.includes('pexels')) {
              setSource('Pexels')
            } else if (sourceName.includes('pixabay')) {
              setSource('Pixabay')
            } else {
              setSource(bestResult.source_name)
            }
          }
          if (bestResult.license_info) {
            setLicense(bestResult.license_info)
          }
          if (bestResult.creator) {
            setCredit(bestResult.creator)
          }

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
  }

  const handleFinish = async () => {
    saveCurrentImage() // Save current image before finishing
    setIsProcessing(true)

    try {
      // Process each image through the commit endpoint
      const finalProcessed = [...processedImages]

      // Add current image if not already processed
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

      // Send each non-skipped image to the commit endpoint
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
      onClose() // Close the upload popup after review is complete
    } catch (error) {
      console.error('Error processing images:', error)
    } finally {
      setIsProcessing(false)
    }
  }

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
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
          {/* Left Column: Original Image and Crop Preview */}
          <div className="flex flex-col min-h-0 space-y-4">
            {/* Original Image */}
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

            {/* Crop Preview and Controls */}
            <div className="flex flex-col min-h-0">
              <h3 className="text-md font-medium mb-2">16:9 Crop Preview</h3>
              <div className="flex flex-col justify-center">
                <canvas
                  ref={canvasRef}
                  className="border rounded shadow-sm mx-auto"
                  style={{ maxWidth: '100%', height: 'auto' }}
                />

                {/* Crop Adjustment */}
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
          </div>

          {/* Right Column: Tag Management */}
          <div className="flex flex-col min-h-0 overflow-y-auto">
            <h3 className="text-md font-medium mb-2">Review Tags</h3>

            {/* AI Caption - only show if caption exists and has meaningful content */}
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
              <div className="mb-3 p-3 bg-gray-50 rounded">
                <div className="flex justify-between items-center mb-2">
                  <button
                    onClick={handleStockPhotoLookup}
                    disabled={loadingStockPhoto}
                    className="bg-purple-600 text-white px-3 py-1 rounded text-xs hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Find original stock photo source"
                  >
                    {loadingStockPhoto ? (
                      <span className="flex items-center gap-1">
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Looking up...
                      </span>
                    ) : (
                      'Stock Photo'
                    )}
                  </button>
                </div>
                <div className="space-y-2 text-xs">
                  {/* Faces Count */}
                  {currentUpload.analysisResult.faces_count > 0 && (
                    <div>
                      <span className="font-medium text-gray-700">Faces:</span>
                      <span className="text-gray-600 ml-1">{currentUpload.analysisResult.faces_count} detected</span>
                    </div>
                  )}

                  {/* Age Groups */}
                  {currentUpload.analysisResult.age_groups && currentUpload.analysisResult.age_groups.length > 0 && (
                    <div>
                      <span className="font-medium text-gray-700">Age Groups:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {currentUpload.analysisResult.age_groups.map((ageGroup, idx) => (
                          <span
                            key={idx}
                            className={`px-2 py-1 rounded text-xs ${
                              ageGroup.age_group === 'preschool' ? 'bg-pink-100 text-pink-800' :
                              ageGroup.age_group === 'elementary' ? 'bg-green-100 text-green-800' :
                              ageGroup.age_group === 'high_school' ? 'bg-blue-100 text-blue-800' :
                              ageGroup.age_group === 'adult' ? 'bg-indigo-100 text-indigo-800' :
                              ageGroup.age_group === 'older_adult' ? 'bg-gray-100 text-gray-800' :
                              'bg-gray-100 text-gray-800'
                            }`}
                            title={`${Math.round(ageGroup.conf * 100)}% confidence`}
                          >
                            {ageGroup.count} {ageGroup.age_group}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Source URL */}
                  <div>
                    <label className="block font-medium text-gray-700 mb-1">Source URL:</label>
                    <input
                      type="url"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      placeholder="Enter source URL"
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    />
                  </div>

                  {/* Source */}
                  <div>
                    <label className="block font-medium text-gray-700 mb-1">Source:</label>
                    <input
                      type="text"
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      placeholder="Enter source name (e.g., Shutterstock, Getty Images)"
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    />
                  </div>

                  {/* License */}
                  <div>
                    <label className="block font-medium text-gray-700 mb-1">License:</label>
                    <input
                      type="text"
                      value={license}
                      onChange={(e) => setLicense(e.target.value)}
                      placeholder="e.g., Creative Commons, Public Domain"
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    />
                  </div>

                  {/* Credit */}
                  <div>
                    <label className="block font-medium text-gray-700 mb-1">Credit:</label>
                    <input
                      type="text"
                      value={credit}
                      onChange={(e) => setCredit(e.target.value)}
                      placeholder="e.g., Photographer name or organization"
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tag Management */}
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Tags:</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {tags.map((tag, index) => (
                  <button
                    key={index}
                    onClick={() => handleRemoveTag(tag)}
                    className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 hover:bg-red-100 hover:text-red-800 transition-colors"
                    title="Click to remove"
                  >
                    {tag}
                    <span className="ml-1">×</span>
                  </button>
                ))}
              </div>

              {/* Add New Tag with AI Suggestions */}
              <div className="space-y-2">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="Describe what you see in the image..."
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                  <button
                    onClick={handleAddTag}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    Suggest
                  </button>
                </div>

                {/* AI Tag Suggestions */}
                {tagSuggestions.length > 0 && (
                  <div className="border border-gray-200 rounded bg-white shadow-sm p-2 max-h-32 overflow-y-auto">
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-xs text-gray-500">AI Suggestions:</div>
                      <button
                        onClick={() => setTagSuggestions([])}
                        className="text-xs text-gray-400 hover:text-gray-600"
                        title="Close suggestions"
                      >
                        ×
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      <button
                        onClick={() => addManualTag()}
                        className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
                      >
                        Add as typed: "{newTag}"
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {tagSuggestions.map((suggestion: any, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => addSuggestedTag(suggestion.formatted_tag)}
                          className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 transition-colors"
                          title={`Confidence: ${Math.round(suggestion.confidence * 100)}%`}
                        >
                          {suggestion.display_name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {loadingSuggestions && (
                  <div className="text-xs text-gray-500">
                    Getting AI suggestions...
                  </div>
                )}
              </div>
            </div>

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
                <p>Dimensions: {currentUpload.analysisResult.width} × {currentUpload.analysisResult.height}</p>
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
              ← Previous
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
              {isProcessing ? 'Processing...' : (currentIndex === completedUploads.length - 1 ? 'Finish' : 'Next →')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}