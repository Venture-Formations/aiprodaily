import { useState, useEffect } from 'react'

interface ProfileTool {
  id: string
  tool_name: string
  description: string | null
  website_url: string
  tool_image_url: string | null
  logo_image_url: string | null
  is_sponsored: boolean
  is_featured?: boolean
  listing_type?: 'free' | 'paid_placement' | 'featured'
  status: string
  rejection_reason: string | null
  view_count: number
  click_count: number
  clerk_user_id: string | null
  categories: { id: string; name: string; slug: string }[]
}

interface CategoryWithStatus {
  id: string
  name: string
  slug: string
  hasFeatured?: boolean
  isDisabled?: boolean
  disabledReason?: string | null
}

export function useEditProfile(tool: ProfileTool, isOpen: boolean) {
  const [formData, setFormData] = useState({
    toolName: tool.tool_name,
    description: tool.description || '',
    websiteUrl: tool.website_url,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<CategoryWithStatus[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>(
    tool.categories[0]?.name || ''
  )

  // Image state
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [listingBlob, setListingBlob] = useState<Blob | null>(null)
  const [listingPreview, setListingPreview] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/tools/categories')
        const data = await res.json()
        if (data.categories) setCategories(data.categories)
      } catch (err) {
        console.error('Failed to fetch categories:', err)
      }
    }
    if (isOpen) fetchCategories()
  }, [isOpen])

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(e.target.value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedCategory) {
      setError('Please select a category')
      return
    }

    setIsSubmitting(true)

    try {
      let logoUrl = ''
      let listingUrl = ''

      if (logoBlob) {
        const logoFileName = `${tool.clerk_user_id}/logo-${Date.now()}.jpg`
        const formDataUpload = new FormData()
        formDataUpload.append('file', logoBlob, 'logo.jpg')
        const uploadRes = await fetch(`/api/tools/upload-image?fileName=${encodeURIComponent(logoFileName)}`, {
          method: 'POST',
          body: formDataUpload
        })
        if (!uploadRes.ok) throw new Error('Failed to upload logo')
        const uploadData = await uploadRes.json()
        logoUrl = uploadData.url
      }

      if (listingBlob) {
        const listingFileName = `${tool.clerk_user_id}/listing-${Date.now()}.jpg`
        const formDataUpload = new FormData()
        formDataUpload.append('file', listingBlob, 'listing.jpg')
        const uploadRes = await fetch(`/api/tools/upload-image?fileName=${encodeURIComponent(listingFileName)}`, {
          method: 'POST',
          body: formDataUpload
        })
        if (!uploadRes.ok) throw new Error('Failed to upload listing image')
        const uploadData = await uploadRes.json()
        listingUrl = uploadData.url
      }

      const res = await fetch('/api/account/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: tool.id,
          ...formData,
          category: selectedCategory,
          logoUrl: logoUrl || undefined,
          listingUrl: listingUrl || undefined,
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update profile')
      }

      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    formData,
    setFormData,
    isSubmitting,
    error,
    categories,
    selectedCategory,
    handleCategoryChange,
    handleSubmit,
    logoBlob,
    setLogoBlob,
    logoPreview,
    setLogoPreview,
    listingBlob,
    setListingBlob,
    listingPreview,
    setListingPreview,
  }
}
