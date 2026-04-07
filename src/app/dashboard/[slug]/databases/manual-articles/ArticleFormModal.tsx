'use client'

import { RefObject } from 'react'
import ReactCrop from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import RichTextEditor from '@/components/RichTextEditor'
import type { Crop, PixelCrop } from 'react-image-crop'
import type { NewsArticle, ArticleCategory } from '@/types/database'
import { SECTION_OPTIONS, ArticleFormData } from './useManualArticles'

interface CategoryModalProps {
  showCategoryModal: boolean
  setShowCategoryModal: (show: boolean) => void
  newCategoryName: string
  setNewCategoryName: (name: string) => void
  handleAddCategory: () => void
}

function CategoryModal({
  showCategoryModal,
  setShowCategoryModal,
  newCategoryName,
  setNewCategoryName,
  handleAddCategory
}: CategoryModalProps) {
  if (!showCategoryModal) return null

  return (
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
  )
}

interface ArticleFormModalProps {
  editingArticle: NewsArticle | null
  formData: ArticleFormData
  setFormData: React.Dispatch<React.SetStateAction<ArticleFormData>>
  categories: ArticleCategory[]
  saving: boolean
  uploadingImage: boolean

  // Image crop
  imageSrc: string
  crop: Crop | undefined
  setCrop: (crop: Crop) => void
  completedCrop: PixelCrop | undefined
  setCompletedCrop: (crop: PixelCrop) => void
  imgRef: RefObject<HTMLImageElement | null>

  // Handlers
  handleTitleChange: (title: string) => void
  handleSlugChange: (slug: string) => void
  handleImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void
  handleSave: () => void
  closeModal: () => void

  // Category modal
  showCategoryModal: boolean
  setShowCategoryModal: (show: boolean) => void
  newCategoryName: string
  setNewCategoryName: (name: string) => void
  handleAddCategory: () => void
}

export default function ArticleFormModal({
  editingArticle,
  formData,
  setFormData,
  categories,
  saving,
  uploadingImage,
  imageSrc,
  crop,
  setCrop,
  completedCrop,
  setCompletedCrop,
  imgRef,
  handleTitleChange,
  handleSlugChange,
  handleImageSelect,
  onImageLoad,
  handleSave,
  closeModal,
  showCategoryModal,
  setShowCategoryModal,
  newCategoryName,
  setNewCategoryName,
  handleAddCategory,
}: ArticleFormModalProps) {
  return (
    <>
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

      <CategoryModal
        showCategoryModal={showCategoryModal}
        setShowCategoryModal={setShowCategoryModal}
        newCategoryName={newCategoryName}
        setNewCategoryName={setNewCategoryName}
        handleAddCategory={handleAddCategory}
      />
    </>
  )
}
