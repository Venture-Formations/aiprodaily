'use client'

import Layout from '@/components/Layout'
import ImageUpload from '@/components/ImageUpload'
import { useImagesDatabase } from './useImagesDatabase'
import ImagesTable from './ImagesTable'
import ImagePreviewModal from './ImagePreviewModal'

export default function ImagesDatabasePage() {
  const hook = useImagesDatabase()

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Images Database</h1>
          <button
            onClick={() => hook.setShowUploadModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Upload Images
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={hook.filter.search}
                onChange={(e) => hook.setFilter({ ...hook.filter, search: e.target.value })}
                placeholder="Search captions, tags..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Has Text
              </label>
              <select
                value={hook.filter.hasText}
                onChange={(e) => hook.setFilter({ ...hook.filter, hasText: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Has Faces
              </label>
              <select
                value={hook.filter.hasFaces}
                onChange={(e) => hook.setFilter({ ...hook.filter, hasFaces: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="text-sm text-gray-600">
          Showing {hook.filteredAndSortedImages.length} of {hook.images.length} images
          {hook.selectedImages.size > 0 && (
            <span className="ml-4 font-medium">
              {hook.selectedImages.size} selected
            </span>
          )}
        </div>

        {/* Content */}
        {hook.loading ? (
          <div className="text-center py-8">Loading images...</div>
        ) : hook.filteredAndSortedImages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No images found matching your filters.
          </div>
        ) : (
          <ImagesTable
            images={hook.filteredAndSortedImages}
            selectedImages={hook.selectedImages}
            editingImage={hook.editingImage}
            editData={hook.editData}
            setEditData={hook.setEditData}
            updating={hook.updating}
            deleting={hook.deleting}
            sortField={hook.sortField}
            sortDirection={hook.sortDirection}
            newTagInput={hook.newTagInput}
            setNewTagInput={hook.setNewTagInput}
            tagSuggestions={hook.tagSuggestions}
            setTagSuggestions={hook.setTagSuggestions}
            loadingSuggestions={hook.loadingSuggestions}
            loadingStockPhoto={hook.loadingStockPhoto}
            onSort={hook.handleSort}
            onSelectImage={hook.handleSelectImage}
            onSelectAll={hook.handleSelectAll}
            onPreview={hook.setPreviewImage}
            onEdit={hook.handleEdit}
            onCancelEdit={hook.handleCancelEdit}
            onSaveEdit={hook.handleSaveEdit}
            onDelete={hook.handleDelete}
            onStockPhotoLookup={hook.handleStockPhotoLookup}
            fetchTagSuggestions={hook.fetchTagSuggestions}
            addSuggestedTag={hook.addSuggestedTag}
            addManualTag={hook.addManualTag}
          />
        )}
      </div>

      {/* Upload Modal */}
      {hook.showUploadModal && (
        <ImageUpload
          onComplete={(results) => {
            const successfulUploads = results.filter(r => r.status === 'completed')
            if (successfulUploads.length > 0) {
              hook.fetchImages()
            }
          }}
          onClose={() => hook.setShowUploadModal(false)}
          maxFiles={10}
          maxSizeBytes={10 * 1024 * 1024}
        />
      )}

      {/* Image Preview Modal */}
      {hook.previewImage && (
        <ImagePreviewModal
          image={hook.previewImage}
          onClose={() => hook.setPreviewImage(null)}
        />
      )}
    </Layout>
  )
}
