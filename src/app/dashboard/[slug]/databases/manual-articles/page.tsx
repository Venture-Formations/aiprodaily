'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Layout from '@/components/Layout'
import RichTextEditor from '@/components/RichTextEditor'
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import type { NewsArticle, ArticleCategory } from '@/types/database'

// Helper to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Helper to format date string without timezone issues
// Parses YYYY-MM-DD directly to avoid UTC interpretation
function formatDateString(dateStr: string): string {
  if (!dateStr) return '-'
  const [year, month, day] = dateStr.split('T')[0].split('-')
  if (!year || !month || !day) return dateStr
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  return date.toLocaleDateString()
}

// Section options
const SECTION_OPTIONS = [
  { value: 'primary_articles', label: 'Latest in Accounting AI (Primary)' },
  { value: 'secondary_articles', label: 'Updates in AI (Secondary)' }
]

export default function ManualArticlesPage() {
  const params = useParams()
  const slug = params?.slug as string || ''

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
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    body: '',
    image_url: '',
    section_type: 'primary_articles',
    category_id: '',
    publish_date: new Date().toISOString().split('T')[0]
  })
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
    fetchArticles()
    fetchCategories()
  }, [activeTab])

  const fetchArticles = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/databases/manual-articles?status=${activeTab}`)
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
      const response = await fetch('/api/databases/categories')
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

  const resetForm = () => {
    setFormData({
      title: '',
      slug: '',
      body: '',
      image_url: '',
      section_type: 'primary_articles',
      category_id: '',
      publish_date: new Date().toISOString().split('T')[0]
    })
    setSlugEdited(false)
    setImageFile(null)
    setImageSrc('')
    setCrop(undefined)
    setCompletedCrop(undefined)
  }

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

  // Image handling
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type and size
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
    // Create a centered 16:9 crop
    const crop = centerCrop(
      makeAspectCrop(
        { unit: '%', width: 90 },
        16 / 9,
        width,
        height
      ),
      width,
      height
    )
    setCrop(crop)
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
      // Upload image if selected
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
        ? `/api/databases/manual-articles/${editingArticle.id}`
        : '/api/databases/manual-articles'

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
      const response = await fetch(`/api/databases/manual-articles/${articleId}`, {
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
      const response = await fetch(`/api/databases/manual-articles/${articleId}`, {
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
      const response = await fetch('/api/databases/categories', {
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

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-yellow-100 text-yellow-800',
      published: 'bg-green-100 text-green-800',
      used: 'bg-blue-100 text-blue-800'
    }

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.toUpperCase()}
      </span>
    )
  }

  const getSectionLabel = (sectionType: string) => {
    return SECTION_OPTIONS.find(s => s.value === sectionType)?.label || sectionType
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <nav className="flex mb-4" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              <li>
                <Link href={`/dashboard/${slug}/databases`} className="text-gray-500 hover:text-gray-700">
                  Databases
                </Link>
              </li>
              <li>
                <span className="text-gray-500">/</span>
              </li>
              <li>
                <span className="text-gray-900 font-medium">Manual Articles</span>
              </li>
            </ol>
          </nav>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Manual Articles</h1>
              <p className="text-gray-600 mt-1">
                {articles.length} {activeTab} {articles.length === 1 ? 'article' : 'articles'}
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Add Article
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {(['draft', 'published', 'used'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {/* Articles Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">No {activeTab} articles found</p>
            <button
              onClick={openAddModal}
              className="mt-4 text-blue-600 hover:text-blue-800"
            >
              Create your first article
            </button>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Article
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Section
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {articles.map((article) => (
                  <tr key={article.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {article.image_url && (
                          <img
                            src={article.image_url}
                            alt=""
                            className="w-16 h-9 object-cover rounded mr-3"
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {article.title}
                          </div>
                          <div className="text-xs text-gray-500">
                            {websiteDomain ? `${websiteDomain}/news/${article.slug}` : `/news/${article.slug}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {article.section_type === 'primary_articles' ? 'Primary' : 'Secondary'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {article.category?.name || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {formatDateString(article.publish_date)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(article.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {article.status === 'draft' && (
                          <>
                            <button
                              onClick={() => openEditModal(article)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleStatusChange(article.id, 'published')}
                              className="text-green-600 hover:text-green-900"
                            >
                              Publish
                            </button>
                            <button
                              onClick={() => handleDelete(article.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {article.status === 'published' && (
                          <>
                            <a
                              href={websiteDomain ? `https://${websiteDomain}/news/${article.slug}` : `/news/${article.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-600 hover:text-green-900"
                            >
                              View
                            </a>
                            <button
                              onClick={() => openEditModal(article)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleStatusChange(article.id, 'draft')}
                              className="text-yellow-600 hover:text-yellow-900"
                            >
                              Unpublish
                            </button>
                            <button
                              onClick={() => handleDelete(article.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {article.status === 'used' && (
                          <a
                            href={websiteDomain ? `https://${websiteDomain}/news/${article.slug}` : `/news/${article.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">
                    {editingArticle ? 'Edit Article' : 'Add Article'}
                  </h2>
                  <button
                    onClick={closeModal}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter article title"
                    />
                  </div>

                  {/* Slug */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL Slug
                    </label>
                    <div className="flex items-center">
                      <span className="text-gray-500 mr-2">/news/</span>
                      <input
                        type="text"
                        value={formData.slug}
                        onChange={(e) => handleSlugChange(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="article-slug"
                      />
                    </div>
                  </div>

                  {/* Body */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Article Body <span className="text-red-500">*</span>
                    </label>
                    <RichTextEditor
                      value={formData.body}
                      onChange={(html) => setFormData(prev => ({ ...prev, body: html }))}
                      maxWords={2000}
                      placeholder="Write your article content..."
                    />
                  </div>

                  {/* Two-column layout for dropdowns */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Section */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Section <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.section_type}
                        onChange={(e) => setFormData(prev => ({ ...prev, section_type: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {SECTION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Category */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={formData.category_id}
                          onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">No category</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setShowCategoryModal(true)}
                          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                          title="Add Category"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Publish Date
                    </label>
                    <input
                      type="date"
                      value={formData.publish_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, publish_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Image Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Featured Image (16:9)
                    </label>

                    {formData.image_url && !imageSrc && (
                      <div className="mb-4">
                        <img
                          src={formData.image_url}
                          alt="Current image"
                          className="w-64 h-36 object-cover rounded"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                          className="mt-2 text-sm text-red-600 hover:text-red-800"
                        >
                          Remove image
                        </button>
                      </div>
                    )}

                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />

                    {imageSrc && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-500 mb-2">Crop image to 16:9 ratio:</p>
                        <ReactCrop
                          crop={crop}
                          onChange={(c) => setCrop(c)}
                          onComplete={(c) => setCompletedCrop(c)}
                          aspect={16 / 9}
                          className="max-w-full"
                        >
                          <img
                            ref={imgRef}
                            src={imageSrc}
                            onLoad={onImageLoad}
                            alt="Upload preview"
                            className="max-h-96"
                          />
                        </ReactCrop>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || uploadingImage}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving || uploadingImage ? 'Saving...' : (editingArticle ? 'Update Article' : 'Create Article')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Category Modal */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold mb-4">Add Category</h3>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                placeholder="Category name"
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryModal(false)
                    setNewCategoryName('')
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
