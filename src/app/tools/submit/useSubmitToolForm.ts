'use client'

import { useState, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { addTool, createCheckoutSession } from '../actions'
import type { AIAppCategory } from '@/types/database'

interface FormData {
  toolName: string
  email: string
  websiteUrl: string
  description: string
  category: AIAppCategory
}

interface UseSubmitToolFormOptions {
  featuredCategories: string[]
}

export function useSubmitToolForm({ featuredCategories }: UseSubmitToolFormOptions) {
  const { user } = useUser()
  const router = useRouter()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [submittedToolId, setSubmittedToolId] = useState<string | null>(null)
  const [isProcessingUpgrade, setIsProcessingUpgrade] = useState(false)

  const [formData, setFormData] = useState<FormData>({
    toolName: '',
    email: user?.primaryEmailAddress?.emailAddress || '',
    websiteUrl: '',
    description: '',
    category: 'Accounting & Bookkeeping' as AIAppCategory,
  })

  const categoryHasFeatured = featuredCategories.includes(formData.category)

  // Image state
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [listingBlob, setListingBlob] = useState<Blob | null>(null)
  const [listingPreview, setListingPreview] = useState<string | null>(null)

  const handleLogoCropComplete = useCallback((blob: Blob) => {
    setLogoBlob(blob)
    setLogoPreview(URL.createObjectURL(blob))
  }, [])

  const handleListingCropComplete = useCallback((blob: Blob) => {
    setListingBlob(blob)
    setListingPreview(URL.createObjectURL(blob))
  }, [])

  const clearLogo = useCallback(() => {
    setLogoBlob(null)
    setLogoPreview(null)
  }, [])

  const clearListing = useCallback(() => {
    setListingBlob(null)
    setListingPreview(null)
  }, [])

  const updateField = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (!formData.toolName.trim()) throw new Error('Tool name is required')
      if (!formData.websiteUrl.trim()) throw new Error('Website URL is required')
      if (!formData.description.trim()) throw new Error('Description is required')

      // Upload logo image if provided
      let logoFileName = ''
      if (logoBlob) {
        logoFileName = `${user?.id || 'anonymous'}/logo-${Date.now()}.jpg`
        const formDataUpload = new FormData()
        formDataUpload.append('file', logoBlob, 'logo.jpg')
        const uploadResponse = await fetch(`/api/tools/upload-image?fileName=${encodeURIComponent(logoFileName)}`, {
          method: 'POST',
          body: formDataUpload,
        })
        if (!uploadResponse.ok) {
          const err = await uploadResponse.json()
          throw new Error(err.error || 'Failed to upload logo image')
        }
      }

      // Upload listing image if provided
      let listingFileName = ''
      if (listingBlob) {
        listingFileName = `${user?.id || 'anonymous'}/listing-${Date.now()}.jpg`
        const formDataUpload = new FormData()
        formDataUpload.append('file', listingBlob, 'listing.jpg')
        const uploadResponse = await fetch(`/api/tools/upload-image?fileName=${encodeURIComponent(listingFileName)}`, {
          method: 'POST',
          body: formDataUpload,
        })
        if (!uploadResponse.ok) {
          const err = await uploadResponse.json()
          throw new Error(err.error || 'Failed to upload listing image')
        }
      }

      const result = await addTool(
        {
          toolName: formData.toolName,
          email: formData.email,
          websiteUrl: formData.websiteUrl,
          description: formData.description,
          category: formData.category,
          plan: 'free',
          listingType: 'free',
          billingPeriod: undefined,
        },
        user?.id || null,
        listingFileName,
        user?.fullName || 'Anonymous',
        user?.imageUrl || '',
        logoFileName
      )

      if (result.error) throw new Error(result.error)

      if (!categoryHasFeatured && result.tool) {
        setSubmittedToolId(result.tool.id)
        setShowUpgradeModal(true)
        setIsSubmitting(false)
        return
      }

      router.push('/tools?submitted=true')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsSubmitting(false)
    }
  }, [formData, logoBlob, listingBlob, user, categoryHasFeatured, router])

  const handleUpgrade = useCallback(async () => {
    if (!submittedToolId) return
    setIsProcessingUpgrade(true)
    try {
      const checkoutUrl = await createCheckoutSession(submittedToolId, 'featured', 'monthly')
      if (checkoutUrl) {
        window.location.href = checkoutUrl
        return
      }
      router.push('/tools?submitted=true')
    } catch (err) {
      console.error('Failed to create checkout session:', err)
      router.push('/tools?submitted=true')
    }
  }, [submittedToolId, router])

  const handleContinueFree = useCallback(() => {
    setShowUpgradeModal(false)
    router.push('/tools?submitted=true')
  }, [router])

  return {
    formData,
    updateField,
    isSubmitting,
    error,
    showUpgradeModal,
    isProcessingUpgrade,
    logoPreview,
    listingPreview,
    handleLogoCropComplete,
    handleListingCropComplete,
    clearLogo,
    clearListing,
    handleSubmit,
    handleUpgrade,
    handleContinueFree,
  }
}
