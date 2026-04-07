'use client'

import dynamic from 'next/dynamic'
import 'react-quill-new/dist/quill.snow.css'
import type { StaticTextEditorProps } from './types'
import { quillModules, quillFormats, getTextSizeLabel } from './types'

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false })

export function StaticTextBlockEditor({
  block,
  isEditing,
  saving,
  onStartEdit,
  onCancelEdit,
  onSaveBlock,
  editContent,
  setEditContent,
  editTextSize,
  setEditTextSize,
}: StaticTextEditorProps) {
  if (isEditing) {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Text Size</label>
          <select
            value={editTextSize}
            onChange={(e) => setEditTextSize(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          >
            <option value="small">Small (14px)</option>
            <option value="medium">Medium (16px)</option>
            <option value="large">Large (20px, semibold)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <ReactQuill
              theme="snow"
              value={editContent}
              onChange={setEditContent}
              modules={quillModules}
              formats={quillFormats}
              placeholder="Enter your text content..."
              className="bg-white"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancelEdit} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSaveBlock(block)} disabled={saving} className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-2 text-xs text-gray-500">Size: {getTextSizeLabel(block.text_size || 'medium')}</div>
      {block.static_content ? (
        <div className="text-sm text-gray-700 prose prose-sm max-w-none bg-white p-3 rounded-lg border border-gray-200" dangerouslySetInnerHTML={{ __html: block.static_content }} />
      ) : (
        <p className="text-sm text-gray-400 italic bg-white p-3 rounded-lg border border-gray-200">No content yet</p>
      )}
      <button onClick={() => onStartEdit(block)} className="mt-3 px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700">Edit Content</button>
    </div>
  )
}
