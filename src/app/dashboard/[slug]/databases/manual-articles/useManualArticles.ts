'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { usePublicationId } from '@/hooks/usePublicationId'
import { centerCrop, makeAspectCrop } from 'react-image-crop'
import type { Crop, PixelCrop } from 'react-image-crop'
import type { NewsArticle, ArticleCategory } from '@/types/database'

// Helper to generate slug from title
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Helper to format date string without timezone issues
export function formatDateString(dateStr: string): string {
  if (!dateStr) return '-'
  const [year, month, day] = dateStr.split('T')[0].split('-')
  if (!year || !month || !day) return dateStr
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  return date.toLocaleDateString()
}

export const SECTION_OPTIONS = [
  { value: 'primary_articles', label: 'Latest in Accounting AI (Primary)' },
  { value: 'secondary_articles', label: 'Updates in AI (Secondary)' }
]

export interface ArticleFormData {
  title: string
  slug: string
  body: string
  image_url: string
  section_type: string
  category_id: string
  publish_date: string
}

const INITIAL_FORM_DATA: ArticleFormData = {
  title: '',
  slug: '',
  body: '',
  image_url: '',
  section_type: 'primary_articles',
  category_id: '',
  publish_date: new Date().toISOString().split('T')[0]
}

export function useManualArticles() {
  const { publicationId } = usePublicationId()

  const [activeTab, setActiveTab] = useState<'draft' | 'published' | 'used'>('draft')
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [categories, setCategories] = useState<ArticleCategory[]>([])
  const [websiteDomain, setWebsiteDomain] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingArticle, setEditingArticle] = useState<NewsArticle | null>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  // Form state
  const [formData, setFormData] = useState<ArticleFormData>(INITIAL_FORM_DATA)
  const [slugEdited, setSlugEdited] = useState(false)
  const [saving, setSaving] = useState(false)

  // Image cropping state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageSrc, setImageSrc] = useState<string>('')
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const imgRef = useRef<HTMLImageElement>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    if (publicationId) {
      fetchArticles()
      fetchCategories()
    }
  }, [activeTab, publicationId])

  const fetchArticles = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/databases/manual-articles?status=${activeTab}&publication_id=${publicationId}`)
      if (response.ok) {
        const data = await response.json()
        setArticles(data.articles || [])
        if (data.website_domain) {
          setWebsiteDomain(data.website_domain)
        }
      }
    } catch (error) {
      console.error('Failed to fetch articles:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch(`/api/databases/categories?publication_id=${publicationId}`)
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories || [])
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      slug: slugEdited ? prev.slug : generateSlug(title)
    }))
  }

  const handleSlugChange = (slug: string) => {
    setSlugEdited(true)
    setFormData(prev => ({ ...prev, slug: generateSlug(slug) }))
  }

  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM_DATA)
    setSlugEdited(false)
    setImageFile(null)
    setImageSrc('')
    setCrop(undefined)
    setCompletedCrop(undefined)
  }, [])

  const openAddModal = () => {
    resetForm()
    setEditingArticle(null)
    setShowAddModal(true)
  }

  const openEditModal = (article: NewsArticle) => {
    setFormData({
      title: article.title,
      slug: article.slug,
      body: article.body,
      image_url: article.image_url || '',
      section_type: article.section_type,
      category_id: article.category_id || '',
      publish_date: article.publish_date
    })
    setSlugEdited(true)
    setEditingArticle(article)
    setShowAddModal(true)
  }

  const closeModal = () => {
    setShowAddModal(false)
    setEditingArticle(null)
    resetForm()
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB')
      return
    }

    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    const newCrop = centerCrop(
      makeAspectCrop(
        { unit: '%', width: 90 },
        16 / 9,
        width,
        height
      ),
      width,
      height
    )
    setCrop(newCrop)
  }

  const getCroppedImageBlob = async (): Promise<Blob | null> => {
    if (!imgRef.current || !completedCrop) return null

    const canvas = document.createElement('canvas')
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height

    canvas.width = completedCrop.width * scaleX
    canvas.height = completedCrop.height * scaleY

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(
      imgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    )

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9)
    })
  }

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !completedCrop) return formData.image_url || null

    setUploadingImage(true)
    try {
      const blob = await getCroppedImageBlob()
      if (!blob) throw new Error('Failed to crop image')

      const formDataUpload = new FormData()
      formDataUpload.append('image', blob, 'article-image.jpg')

      const response = await fetch('/api/databases/manual-articles/upload-image', {
        method: 'POST',
        body: formDataUpload
      })

      if (!response.ok) throw new Error('Upload failed')

      const data = await response.json()
      return data.url
    } catch (error) {
      console.error('Image upload error:', error)
      alert('Failed to upload image')
      return null
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSave = async () => {
    if (!formData.title.trim()) {
      alert('Title is required')
      return
    }
    if (!formData.body.trim() || formData.body === '<p><br></p>') {
      alert('Article body is required')
      return
    }

    setSaving(true)
    try {
      let imageUrl = formData.image_url
      if (imageFile && completedCrop) {
        const uploadedUrl = await uploadImage()
        if (uploadedUrl) {
          imageUrl = uploadedUrl
        }
      }

      const payload = {
        ...formData,
        image_url: imageUrl || null,
        category_id: formData.category_id || null
      }

      const url = editingArticle
        ? `/api/databases/manual-articles/${editingArticle.id}?publication_id=${publicationId}`
        : `/api/databases/manual-articles?publication_id=${publicationId}`

      const response = await fetch(url, {
        method: editingArticle ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save article')
      }

      alert(editingArticle ? 'Article updated!' : 'Article created!')
      closeModal()
      fetchArticles()
    } catch (error: any) {
      console.error('Save error:', error)
      alert(error.message || 'Failed to save article')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (articleId: string, newStatus: 'draft' | 'published') => {
    try {
      const response = await fetch(`/api/databases/manual-articles/${articleId}?publication_id=${publicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) throw new Error('Failed to update status')

      fetchArticles()
    } catch (error) {
      console.error('Status change error:', error)
      alert('Failed to update status')
    }
  }

  const handleDelete = async (articleId: string) => {
    if (!confirm('Delete this article? This cannot be undone.')) return

    try {
      const response = await fetch(`/api/databases/manual-articles/${articleId}?publication_id=${publicationId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete')
      }

      fetchArticles()
    } catch (error: any) {
      console.error('Delete error:', error)
      alert(error.message || 'Failed to delete article')
    }
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      alert('Category name is required')
      return
    }

    try {
      const response = await fetch(`/api/databases/categories?publication_id=${publicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create category')
      }

      const data = await response.json()
      setCategories(prev => [...prev, data.category])
      setFormData(prev => ({ ...prev, category_id: data.category.id }))
      setNewCategoryName('')
      setShowCategoryModal(false)
    } catch (error: any) {
      console.error('Category creation error:', error)
      alert(error.message || 'Failed to create category')
    }
  }

  return {
    // Data
    activeTab,
    setActiveTab,
    articles,
    categories,
    websiteDomain,
    loading,
    showAddModal,
    editingArticle,
    showCategoryModal,
    setShowCategoryModal,
    newCategoryName,
    setNewCategoryName,
    formData,
    setFormData,
    saving,
    uploadingImage,

    // Image crop
    imageFile,
    imageSrc,
    crop,
    setCrop,
    completedCrop,
    setCompletedCrop,
    imgRef,

    // Handlers
    openAddModal,
    openEditModal,
    closeModal,
    handleTitleChange,
    handleSlugChange,
    handleImageSelect,
    onImageLoad,
    handleSave,
    handleStatusChange,
    handleDelete,
    handleAddCategory,
  }
}
