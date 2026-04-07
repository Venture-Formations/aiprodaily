'use client'

import { useEffect, useState, useRef } from 'react'
import type { Crop, PixelCrop } from 'react-image-crop'
import type { Advertisement } from '@/types/database'
import { getCroppedImage } from '@/utils/imageCrop'

interface AdWithRelations extends Advertisement {
  ad_module?: { id: string; name: string } | null
  advertiser?: { id: string; company_name: string; logo_url?: string } | null
}

export function useEditAdForm(
  ad: AdWithRelations,
  publicationId: string | null,
  onSuccess: () => void
) {
  const [formData, setFormData] = useState({
    title: ad.title,
    body: ad.body,
    button_url: ad.button_url,
    image_alt: ad.image_alt || '',
    cta_text: ad.cta_text || '',
    status: ad.status,
    paid: ad.paid || false,
    frequency: ad.frequency || 'weekly',
    times_paid: ad.times_paid || 0
  })
  const [submitting, setSubmitting] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // Company/Advertiser state
  const [advertisers, setAdvertisers] = useState<Array<{ id: string; company_name: string }>>([])
  const [selectedAdvertiserId, setSelectedAdvertiserId] = useState<string>(ad.advertiser_id || '')
  const [newCompanyName, setNewCompanyName] = useState('')
  const [companyMode, setCompanyMode] = useState<'existing' | 'new'>(ad.advertiser_id ? 'existing' : 'new')

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

  useEffect(() => {
    if (!ad.advertiser_id && ad.company_name) {
      setNewCompanyName(ad.company_name)
      setCompanyMode('new')
    }
  }, [ad])

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

  const clearImage = () => {
    setSelectedImage(null)
    setCrop(undefined)
    setCompletedCrop(undefined)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      let imageUrl = ad.image_url

      if (selectedImage && completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
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

      let advertiserId = ad.advertiser_id
      let companyName = ad.company_name || ''

      if (companyMode === 'existing' && selectedAdvertiserId) {
        advertiserId = selectedAdvertiserId
        const selectedAdv = advertisers.find(a => a.id === selectedAdvertiserId)
        companyName = selectedAdv?.company_name || ''
      } else if (companyMode === 'new' && newCompanyName.trim()) {
        if (!ad.advertiser_id || newCompanyName.trim() !== ad.company_name) {
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
            advertiserId = null
            companyName = newCompanyName.trim()
          }
        } else {
          companyName = newCompanyName.trim()
        }
      }

      console.log('[EditAdModal] Sending update:', {
        id: ad.id,
        title: formData.title,
        body: formData.body?.substring(0, 100) + '...',
        button_url: formData.button_url,
        status: formData.status,
        image_url: imageUrl,
        advertiser_id: advertiserId,
        company_name: companyName
      })

      const response = await fetch(`/api/ads/${ad.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          image_url: imageUrl,
          advertiser_id: advertiserId,
          company_name: companyName
        })
      })

      const data = await response.json()
      console.log('[EditAdModal] API response:', response.status, data)

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to update advertisement')
      }

      if (!data.ad) {
        throw new Error('Server returned success but no ad data - please try again')
      }

      if (data.ad.body !== formData.body) {
        console.warn('[EditAdModal] Body mismatch! Sent:', formData.body?.substring(0, 50), 'Got:', data.ad.body?.substring(0, 50))
      }

      alert('Advertisement updated successfully!')
      onSuccess()
    } catch (error) {
      console.error('[EditAdModal] Update error:', error)
      alert(error instanceof Error ? error.message : 'Failed to update advertisement')
    } finally {
      setSubmitting(false)
    }
  }

  return {
    formData,
    setFormData,
    submitting,
    selectedImage,
    crop,
    setCrop,
    completedCrop,
    setCompletedCrop,
    fileInputRef,
    imgRef,
    advertisers,
    selectedAdvertiserId,
    setSelectedAdvertiserId,
    newCompanyName,
    setNewCompanyName,
    companyMode,
    setCompanyMode,
    handleImageSelect,
    clearImage,
    handleSubmit,
  }
}
