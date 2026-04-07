'use client'

import { useState, useEffect, useRef } from 'react'
import { Crop, PixelCrop } from 'react-image-crop'

interface FormData {
  title: string
  body: string
  button_url: string
  image_alt: string
  cta_text: string
}

interface Advertiser {
  id: string
  company_name: string
}

export function useAddAdModal(
  publicationId: string | null,
  selectedSection: string,
  onSuccess: () => void
) {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    body: '',
    button_url: '',
    image_alt: '',
    cta_text: ''
  })
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [submitting, setSubmitting] = useState(false)

  const [advertisers, setAdvertisers] = useState<Advertiser[]>([])
  const [selectedAdvertiserId, setSelectedAdvertiserId] = useState<string>('')
  const [newCompanyName, setNewCompanyName] = useState('')
  const [companyMode, setCompanyMode] = useState<'existing' | 'new'>('new')

  useEffect(() => {
    if (publicationId) {
      fetch(`/api/advertisers?publication_id=${publicationId}`)
        .then(res => res.json())
        .then(data => {
          if (data.advertisers) {
            setAdvertisers(data.advertisers)
          }
        })
        .catch(err => console.error('Failed to fetch advertisers:', err))
    }
  }, [publicationId])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        setSelectedImage(reader.result as string)
        setCrop({
          unit: '%',
          x: 10,
          y: 10,
          width: 80,
          height: 45
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      let imageUrl = null

      if (selectedImage && completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
        const { getCroppedImage } = await import('@/utils/imageCrop')
        const croppedBlob = await getCroppedImage(imgRef.current, completedCrop)
        if (croppedBlob) {
          const imageFormData = new FormData()
          imageFormData.append('image', croppedBlob, 'ad-image.jpg')

          const uploadResponse = await fetch('/api/ads/upload-image', {
            method: 'POST',
            body: imageFormData
          })

          if (uploadResponse.ok) {
            const { url } = await uploadResponse.json()
            imageUrl = url
          } else {
            const errorData = await uploadResponse.json().catch(() => ({ error: 'Unknown error' }))
            throw new Error(errorData.error || 'Failed to upload image')
          }
        }
      }

      if (companyMode === 'existing' && !selectedAdvertiserId) {
        alert('Please select a company')
        setSubmitting(false)
        return
      }
      if (companyMode === 'new' && !newCompanyName.trim()) {
        alert('Please enter a company name')
        setSubmitting(false)
        return
      }

      let advertiserId = null
      let companyName = ''

      if (companyMode === 'existing' && selectedAdvertiserId) {
        advertiserId = selectedAdvertiserId
        const selectedAd = advertisers.find(a => a.id === selectedAdvertiserId)
        companyName = selectedAd?.company_name || ''
      } else if (companyMode === 'new' && newCompanyName.trim()) {
        const advertiserResponse = await fetch('/api/advertisers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publication_id: publicationId,
            company_name: newCompanyName.trim()
          })
        })

        if (advertiserResponse.ok) {
          const advertiserData = await advertiserResponse.json()
          advertiserId = advertiserData.advertiser.id
          companyName = newCompanyName.trim()
        } else {
          console.warn('Failed to create advertiser, continuing without')
          companyName = newCompanyName.trim()
        }
      }

      const text = formData.body.replace(/<[^>]*>/g, '').trim()
      const words = text.split(/\s+/).filter(w => w.length > 0)
      const wordCount = words.length

      const response = await fetch(`/api/ads?publication_id=${publicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          word_count: wordCount,
          image_url: imageUrl,
          payment_amount: 0,
          payment_status: 'manual',
          paid: true,
          status: 'active',
          advertiser_id: advertiserId,
          company_name: companyName,
          ad_module_id: selectedSection,
          ad_type: selectedSection
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to create advertisement')
      }

      if (!data.ad) {
        throw new Error('Server returned success but no ad data - please try again')
      }

      alert('Advertisement created successfully!')
      onSuccess()
    } catch (error) {
      console.error('Create error:', error)
      alert(error instanceof Error ? error.message : 'Failed to create advertisement')
    } finally {
      setSubmitting(false)
    }
  }

  return {
    formData,
    setFormData,
    selectedImage,
    crop,
    setCrop,
    completedCrop,
    setCompletedCrop,
    fileInputRef,
    imgRef,
    submitting,
    advertisers,
    selectedAdvertiserId,
    setSelectedAdvertiserId,
    newCompanyName,
    setNewCompanyName,
    companyMode,
    setCompanyMode,
    handleImageSelect,
    handleSubmit,
  }
}
