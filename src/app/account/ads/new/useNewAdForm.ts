import { useState, useRef } from 'react'
import { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import { getCroppedImage } from '@/utils/imageCrop'

// Pricing constants
export const PRICE_PER_DAY = 250
export const DISCOUNTED_PRICE_PER_DAY = 200
export const DISCOUNT_THRESHOLD = 4

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) {
  return centerCrop(
    makeAspectCrop(
      { unit: '%', width: 90 },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  )
}

export function calculatePricing(numDays: number) {
  const hasDiscount = numDays >= DISCOUNT_THRESHOLD
  const pricePerDay = hasDiscount ? DISCOUNTED_PRICE_PER_DAY : PRICE_PER_DAY
  const total = numDays * pricePerDay
  const savings = hasDiscount ? numDays * (PRICE_PER_DAY - DISCOUNTED_PRICE_PER_DAY) : 0
  return { pricePerDay, total, hasDiscount, savings }
}

export function useNewAdForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    companyName: '',
    headline: '',
    description: '',
    destinationUrl: '',
    buttonText: 'Learn More',
  })

  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [useNextAvailable, setUseNextAvailable] = useState(false)
  const [nextAvailableDays, setNextAvailableDays] = useState(1)

  // Image state
  const [imageBlob, setImageBlob] = useState<Blob | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const imgRef = useRef<HTMLImageElement>(null)

  const numDays = useNextAvailable ? nextAvailableDays : selectedDates.length
  const pricing = calculatePricing(numDays)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        setSelectedImage(reader.result as string)
        setCrop(undefined)
        setCompletedCrop(undefined)
      }
      reader.readAsDataURL(file)
    }
  }

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    setCrop(centerAspectCrop(width, height, 5 / 4))
  }

  const handleApplyCrop = async () => {
    if (!completedCrop || !imgRef.current) return
    try {
      const croppedBlob = await getCroppedImage(imgRef.current, completedCrop)
      if (croppedBlob) {
        setImageBlob(croppedBlob)
        setImagePreview(URL.createObjectURL(croppedBlob))
        setSelectedImage(null)
      }
    } catch (err) {
      console.error('Failed to crop image:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (!formData.companyName.trim()) throw new Error('Company name is required')
      if (!formData.headline.trim()) throw new Error('Headline is required')
      if (!formData.description.trim()) throw new Error('Description is required')
      if (!formData.destinationUrl.trim()) throw new Error('Destination URL is required')
      if (numDays === 0) throw new Error('Please select at least one date or use next available')

      const response = await fetch('/api/account/ads/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          selectedDates: useNextAvailable ? [] : selectedDates.map(d => d.toISOString().split('T')[0]),
          useNextAvailable,
          nextAvailableDays: useNextAvailable ? nextAvailableDays : 0,
          numDays,
          total: pricing.total,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create checkout session')
      }

      const { checkoutUrl } = await response.json()
      window.location.href = checkoutUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsSubmitting(false)
    }
  }

  const handleToggleNextAvailable = () => {
    setUseNextAvailable(!useNextAvailable)
    if (!useNextAvailable) setSelectedDates([])
  }

  const clearImage = () => {
    setImageBlob(null)
    setImagePreview(null)
  }

  const cancelCrop = () => {
    setSelectedImage(null)
    setCrop(undefined)
    setCompletedCrop(undefined)
  }

  return {
    isSubmitting,
    error,
    success,
    formData,
    setFormData,
    selectedDates,
    setSelectedDates,
    useNextAvailable,
    nextAvailableDays,
    setNextAvailableDays,
    imageBlob,
    imagePreview,
    selectedImage,
    crop,
    setCrop,
    completedCrop,
    setCompletedCrop,
    imgRef,
    numDays,
    pricing,
    handleImageSelect,
    onImageLoad,
    handleApplyCrop,
    handleSubmit,
    handleToggleNextAvailable,
    clearImage,
    cancelCrop,
  }
}
