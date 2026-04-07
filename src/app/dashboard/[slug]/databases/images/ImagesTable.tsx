'use client'

import { Image, ImageTag } from '@/types/database'
import type { SortField, SortDirection } from './useImagesDatabase'

function TagBadges({ tags, tagsScored }: { tags: string[] | null; tagsScored: ImageTag[] | null }) {
  if (!tags || tags.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 max-w-xs">
      {tags.slice(0, 5).map((tag, index) => {
        const scoredTag = tagsScored?.find(t => `${t.type}_${t.name}` === tag)
        const confidence = scoredTag ? Math.round(scoredTag.conf * 100) : null

        return (
          <span
            key={index}
            className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
            title={confidence ? `Confidence: ${confidence}%` : undefined}
          >
            {tag.replace('_', ': ')}
          </span>
        )
      })}
      {tags.length > 5 && (
        <span className="text-xs text-gray-500">+{tags.length - 5} more</span>
      )}
    </div>
  )
}

interface EditableTagsProps {
  image: Image
  editData: Partial<Image>
  setEditData: React.Dispatch<React.SetStateAction<Partial<Image>>>
  newTagInput: {[key: string]: string}
  setNewTagInput: React.Dispatch<React.SetStateAction<{[key: string]: string}>>
  tagSuggestions: {[key: string]: any[]}
  setTagSuggestions: React.Dispatch<React.SetStateAction<{[key: string]: any[]}>>
  loadingSuggestions: {[key: string]: boolean}
  fetchTagSuggestions: (input: string, imageId: string) => void
  addSuggestedTag: (imageId: string, formattedTag: string) => void
  addManualTag: (imageId: string) => void
}

function EditableTags({
  image,
  editData,
  setEditData,
  newTagInput,
  setNewTagInput,
  tagSuggestions,
  setTagSuggestions,
  loadingSuggestions,
  fetchTagSuggestions,
  addSuggestedTag,
  addManualTag,
}: EditableTagsProps) {
  return (
    <div className="max-w-xs space-y-2">
      {/* Existing tags as removable buttons */}
      <div className="flex flex-wrap gap-1">
        {(editData.ai_tags || []).map((tag, index) => (
          <button
            key={index}
            onClick={() => {
              const newTags = editData.ai_tags?.filter((_, i) => i !== index) || []
              setEditData({ ...editData, ai_tags: newTags })
            }}
            className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 hover:bg-red-100 hover:text-red-800 transition-colors"
            title="Click to remove"
          >
            {tag}
            <span className="ml-1">x</span>
          </button>
        ))}
      </div>

      {/* Add new tag input with AI suggestions */}
      <div className="space-y-2">
        <div className="flex space-x-1">
          <input
            type="text"
            placeholder="Describe what you see in the image..."
            value={newTagInput[image.id] || ''}
            onChange={(e) => {
              setNewTagInput(prev => ({ ...prev, [image.id]: e.target.value }))
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                const newTag = (newTagInput[image.id] || '').trim()
                if (newTag) fetchTagSuggestions(newTag, image.id)
              }
            }}
            className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
          />
          <button
            onClick={() => {
              const newTag = (newTagInput[image.id] || '').trim()
              if (newTag) fetchTagSuggestions(newTag, image.id)
            }}
            className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
          >
            Suggest
          </button>
        </div>

        {/* AI Tag Suggestions */}
        {(tagSuggestions[image.id] && tagSuggestions[image.id].length > 0) && (
          <div className="border border-gray-200 rounded bg-white shadow-sm p-2 max-h-32 overflow-y-auto">
            <div className="flex justify-between items-center mb-1">
              <div className="text-xs text-gray-500">AI Suggestions:</div>
              <div className="flex gap-1">
                <button
                  onClick={() => addManualTag(image.id)}
                  className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded hover:bg-gray-200"
                  title="Add as typed"
                >
                  Add &quot;{(newTagInput[image.id] || '').trim()}&quot;
                </button>
                <button
                  onClick={() => setTagSuggestions(prev => ({ ...prev, [image.id]: [] }))}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  x
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {tagSuggestions[image.id].map((suggestion: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => addSuggestedTag(image.id, suggestion.formatted_tag)}
                  className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 transition-colors"
                  title={`Confidence: ${Math.round(suggestion.confidence * 100)}%`}
                >
                  {suggestion.display_name}
                </button>
              ))}
            </div>
          </div>
        )}

        {loadingSuggestions[image.id] && (
          <div className="text-xs text-gray-500">
            Getting AI suggestions...
          </div>
        )}
      </div>
    </div>
  )
}

interface ImageInfoCellProps {
  image: Image
  isEditing: boolean
  editData: Partial<Image>
  setEditData: React.Dispatch<React.SetStateAction<Partial<Image>>>
}

function ImageInfoCell({ image, isEditing, editData, setEditData }: ImageInfoCellProps) {
  if (isEditing) {
    return (
      <div className="text-sm space-y-2 max-w-xs">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Source:</label>
          <input
            type="text"
            value={editData.source || ''}
            onChange={(e) => setEditData({ ...editData, source: e.target.value })}
            placeholder="Source"
            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Credit:</label>
          <input
            type="text"
            value={editData.credit || ''}
            onChange={(e) => setEditData({ ...editData, credit: e.target.value })}
            placeholder="Photographer/Creator"
            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="text-sm text-gray-500 space-y-1">
      <div className="flex flex-wrap gap-1">
        {image.source && (
          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-medium">
            {image.source}
          </span>
        )}
        {image.faces_count > 0 && (
          <span className="bg-purple-100 text-purple-800 px-1 py-0.5 rounded text-xs">
            {image.faces_count} face{image.faces_count !== 1 ? 's' : ''}
          </span>
        )}
        {image.age_groups && image.age_groups.length > 0 && (
          <>
            {image.age_groups.map((ageGroup, idx) => (
              <span
                key={idx}
                className={`px-1 py-0.5 rounded text-xs ${
                  ageGroup.age_group === 'preschool' ? 'bg-pink-100 text-pink-800' :
                  ageGroup.age_group === 'elementary' ? 'bg-green-100 text-green-800' :
                  ageGroup.age_group === 'high_school' ? 'bg-blue-100 text-blue-800' :
                  ageGroup.age_group === 'adult' ? 'bg-indigo-100 text-indigo-800' :
                  ageGroup.age_group === 'older_adult' ? 'bg-gray-100 text-gray-800' :
                  'bg-gray-100 text-gray-800'
                }`}
                title={`${Math.round(ageGroup.conf * 100)}% confidence`}
              >
                {ageGroup.count} {ageGroup.age_group}
              </span>
            ))}
          </>
        )}
      </div>
      {image.credit && (
        <div className="text-xs text-gray-600">
          <span className="font-medium">Credit:</span> {image.credit}
        </div>
      )}
      {image.ocr_text && (
        <div className="mt-1 p-1 bg-gray-50 rounded text-xs max-w-xs">
          <span className="font-medium">OCR:</span> {image.ocr_text.substring(0, 100)}{image.ocr_text.length > 100 ? '...' : ''}
        </div>
      )}
      {image.ocr_entities && image.ocr_entities.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {image.ocr_entities.map((entity, idx) => (
            <span
              key={idx}
              className={`px-1 py-0.5 rounded text-xs ${
                entity.type === 'ORG' ? 'bg-red-100 text-red-800' :
                entity.type === 'PERSON' ? 'bg-yellow-100 text-yellow-800' :
                entity.type === 'LOC' ? 'bg-green-100 text-green-800' :
                entity.type === 'DATE' ? 'bg-blue-100 text-blue-800' :
                entity.type === 'TIME' ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-800'
              }`}
              title={`${entity.type}: ${Math.round(entity.conf * 100)}% confidence`}
            >
              {entity.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

interface ImagesTableProps {
  images: Image[]
  selectedImages: Set<string>
  editingImage: string | null
  editData: Partial<Image>
  setEditData: React.Dispatch<React.SetStateAction<Partial<Image>>>
  updating: boolean
  deleting: string | null
  sortField: SortField
  sortDirection: SortDirection
  newTagInput: {[key: string]: string}
  setNewTagInput: React.Dispatch<React.SetStateAction<{[key: string]: string}>>
  tagSuggestions: {[key: string]: any[]}
  setTagSuggestions: React.Dispatch<React.SetStateAction<{[key: string]: any[]}>>
  loadingSuggestions: {[key: string]: boolean}
  loadingStockPhoto: {[key: string]: boolean}

  onSort: (field: SortField) => void
  onSelectImage: (imageId: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  onPreview: (image: Image) => void
  onEdit: (image: Image) => void
  onCancelEdit: () => void
  onSaveEdit: (imageId: string) => void
  onDelete: (imageId: string) => void
  onStockPhotoLookup: (imageId: string) => void
  fetchTagSuggestions: (input: string, imageId: string) => void
  addSuggestedTag: (imageId: string, formattedTag: string) => void
  addManualTag: (imageId: string) => void
}

export default function ImagesTable({
  images,
  selectedImages,
  editingImage,
  editData,
  setEditData,
  updating,
  deleting,
  sortField,
  sortDirection,
  newTagInput,
  setNewTagInput,
  tagSuggestions,
  setTagSuggestions,
  loadingSuggestions,
  loadingStockPhoto,
  onSort,
  onSelectImage,
  onSelectAll,
  onPreview,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onStockPhotoLookup,
  fetchTagSuggestions,
  addSuggestedTag,
  addManualTag,
}: ImagesTableProps) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left">
              <input
                type="checkbox"
                checked={selectedImages.size === images.length && images.length > 0}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="w-4 h-4"
              />
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Preview
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => onSort('ai_caption')}
            >
              Caption {sortField === 'ai_caption' && (sortDirection === 'asc' ? '\u2191' : '\u2193')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tags
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              City
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Info
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {images.map((image) => {
            const isEditing = editingImage === image.id

            return (
              <tr key={image.id} className="hover:bg-gray-50">
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedImages.has(image.id)}
                    onChange={(e) => onSelectImage(image.id, e.target.checked)}
                    className="w-4 h-4"
                  />
                </td>

                <td className="px-4 py-4">
                  <img
                    src={image.variant_16x9_url || image.cdn_url}
                    alt={image.ai_alt_text || 'Image'}
                    className="w-24 h-16 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => onPreview(image)}
                    onError={(e) => {
                      e.currentTarget.src = image.cdn_url || '/placeholder-image.png'
                    }}
                    title="Click to view full size"
                  />
                </td>

                <td className="px-4 py-4">
                  {isEditing ? (
                    <textarea
                      value={editData.ai_caption || ''}
                      onChange={(e) => setEditData({ ...editData, ai_caption: e.target.value })}
                      placeholder="Caption"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      rows={3}
                    />
                  ) : (
                    <div className="text-sm text-gray-900 max-w-xs">
                      {image.ai_caption || 'No caption'}
                    </div>
                  )}
                </td>

                <td className="px-4 py-4">
                  {isEditing ? (
                    <EditableTags
                      image={image}
                      editData={editData}
                      setEditData={setEditData}
                      newTagInput={newTagInput}
                      setNewTagInput={setNewTagInput}
                      tagSuggestions={tagSuggestions}
                      setTagSuggestions={setTagSuggestions}
                      loadingSuggestions={loadingSuggestions}
                      fetchTagSuggestions={fetchTagSuggestions}
                      addSuggestedTag={addSuggestedTag}
                      addManualTag={addManualTag}
                    />
                  ) : (
                    <div className="max-w-xs">
                      <TagBadges tags={image.ai_tags} tagsScored={image.ai_tags_scored} />
                    </div>
                  )}
                </td>

                <td className="px-4 py-4">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.city || ''}
                      onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                      placeholder="City"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  ) : (
                    <div className="text-sm text-gray-900">
                      {image.city || '-'}
                    </div>
                  )}
                </td>

                <td className="px-4 py-4">
                  <ImageInfoCell
                    image={image}
                    isEditing={isEditing}
                    editData={editData}
                    setEditData={setEditData}
                  />
                </td>

                <td className="px-4 py-4">
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => onSaveEdit(image.id)}
                          disabled={updating}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                        >
                          {updating ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={onCancelEdit}
                          className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                      <button
                        onClick={() => onStockPhotoLookup(image.id)}
                        disabled={loadingStockPhoto[image.id]}
                        className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Find original stock photo source"
                      >
                        {loadingStockPhoto[image.id] ? 'Looking up...' : 'Stock Photo'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => onEdit(image)}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(image.id)}
                        disabled={deleting === image.id}
                        className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 disabled:opacity-50"
                      >
                        {deleting === image.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
