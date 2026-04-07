'use client'

interface TagManagerProps {
  tags: string[]
  newTag: string
  setNewTag: (value: string) => void
  tagSuggestions: any[]
  setTagSuggestions: (value: any[]) => void
  loadingSuggestions: boolean
  onAddTag: () => void
  onAddManualTag: () => void
  onRemoveTag: (tag: string) => void
  onAddSuggestedTag: (formattedTag: string) => void
}

export function TagManager({
  tags,
  newTag,
  setNewTag,
  tagSuggestions,
  setTagSuggestions,
  loadingSuggestions,
  onAddTag,
  onAddManualTag,
  onRemoveTag,
  onAddSuggestedTag,
}: TagManagerProps) {
  return (
    <div className="mb-3">
      <p className="text-sm font-medium text-gray-700 mb-2">Tags:</p>
      <div className="flex flex-wrap gap-1 mb-2">
        {tags.map((tag, index) => (
          <button
            key={index}
            onClick={() => onRemoveTag(tag)}
            className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 hover:bg-red-100 hover:text-red-800 transition-colors"
            title="Click to remove"
          >
            {tag}
            <span className="ml-1">&times;</span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onAddTag()}
            placeholder="Describe what you see in the image..."
            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <button
            onClick={onAddTag}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
          >
            Suggest
          </button>
        </div>

        {tagSuggestions.length > 0 && (
          <div className="border border-gray-200 rounded bg-white shadow-sm p-2 max-h-32 overflow-y-auto">
            <div className="flex justify-between items-center mb-1">
              <div className="text-xs text-gray-500">AI Suggestions:</div>
              <button
                onClick={() => setTagSuggestions([])}
                className="text-xs text-gray-400 hover:text-gray-600"
                title="Close suggestions"
              >
                &times;
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              <button
                onClick={onAddManualTag}
                className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
              >
                Add as typed: &quot;{newTag}&quot;
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {tagSuggestions.map((suggestion: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => onAddSuggestedTag(suggestion.formatted_tag)}
                  className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 transition-colors"
                  title={`Confidence: ${Math.round(suggestion.confidence * 100)}%`}
                >
                  {suggestion.display_name}
                </button>
              ))}
            </div>
          </div>
        )}

        {loadingSuggestions && (
          <div className="text-xs text-gray-500">
            Getting AI suggestions...
          </div>
        )}
      </div>
    </div>
  )
}
