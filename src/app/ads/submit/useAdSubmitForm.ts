'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Crop, PixelCrop } from 'react-image-crop'
import { getCroppedImage } from '@/utils/imageCrop'

interface AdFormData {
  title: string
  body: string
  button_text: string
  button_url: string
  submitter_email: string
}

export function useAdSubmitForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const [formData, setFormData] = useState<AdFormData>({
    title: '',
    body: '',
    button_text: '',
    button_url: 'https://',
    submitter_email: ''
  })

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        setSelectedImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title || !formData.body) {
      alert('Please fill in title and ad content')
      return
    }

    if (!formData.button_text || !formData.button_url || !formData.submitter_email) {
      alert('Please fill in button text, button URL, and email')
      return
    }

    const text = formData.body.replace(/<[^>]*?>/g, '').trim()
    const words = text.split(/\s+/).filter(w => w.length > 0)
    if (words.length > 100) {
      alert('Ad content must be 100 words or less')
      return
    }

    if (words.length === 0) {
      alert('Ad content cannot be empty')
      return
    }

    setLoading(true)

    try {
      let imageUrl = null

      if (selectedImage && completedCrop) {
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
            throw new Error('Failed to upload image')
          }
        }
      }

      const response = await fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          image_url: imageUrl,
          word_count: words.length,
          status: 'pending_review',
          paid: true
        })
      })

      if (!response.ok) {
        throw new Error('Failed to submit advertisement')
      }

      router.push('/ads/success')
    } catch (error) {
      console.error('Submission error:', error)
      alert('Failed to process submission. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    selectedImage,
    crop,
    setCrop,
    completedCrop,
    setCompletedCrop,
    fileInputRef,
    imgRef,
    formData,
    setFormData,
    handleImageSelect,
    handleSubmit
  }
}
