'use client'

import ReactCrop from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import type { ImageEditorProps } from './types'
import { getAspectRatioValue } from './types'

export function ImageBlockEditor({
  block,
  isEditing,
  saving,
  onStartEdit,
  onCancelEdit,
  onSaveBlock,
  editImageType,
  setEditImageType,
  editAiImagePrompt,
  setEditAiImagePrompt,
  editImageAlt,
  setEditImageAlt,
  selectedImage,
  crop,
  setCrop,
  completedCrop,
  setCompletedCrop,
  uploadingImage,
  aspectRatio,
  onAspectRatioChange,
  onImageSelect,
  fileInputRef,
  imgRef,
}: ImageEditorProps) {
  if (isEditing) {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Image Type</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name={`imageType-${block.id}`} checked={editImageType === 'static'} onChange={() => setEditImageType('static')} className="text-cyan-600" />
              <span className="text-sm text-gray-700">Static Upload</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name={`imageType-${block.id}`} checked={editImageType === 'ai_generated'} onChange={() => setEditImageType('ai_generated')} className="text-cyan-600" />
              <span className="text-sm text-gray-700">AI Generated</span>
            </label>
          </div>
        </div>
        {editImageType === 'static' && (
          <div>
            {block.static_image_url && !selectedImage && <div className="mb-3"><label className="block text-sm font-medium text-gray-700 mb-2">Current Image</label><img src={block.static_image_url} alt="Current" className="max-w-md h-auto rounded border border-gray-200" /></div>}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Aspect Ratio</label>
              <div className="flex gap-2">
                {(['16:9', '5:4', 'free'] as const).map((ratio) => (
                  <button key={ratio} type="button" onClick={() => onAspectRatioChange(ratio)} className={`px-4 py-2 text-sm rounded-lg border transition-colors ${aspectRatio === ratio ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}>{ratio === 'free' ? 'Free' : ratio}</button>
                ))}
              </div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">{block.static_image_url ? 'Replace Image' : 'Upload Image'}</label><input ref={fileInputRef} type="file" accept="image/*" onChange={onImageSelect} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            {selectedImage && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Crop Image {aspectRatio !== 'free' ? `(${aspectRatio})` : '(Free)'}</label>
                <ReactCrop crop={crop} onChange={(c) => setCrop(c)} onComplete={(c) => setCompletedCrop(c)} aspect={getAspectRatioValue(aspectRatio)}><img ref={imgRef} src={selectedImage} alt="Crop preview" style={{ maxWidth: '100%' }} /></ReactCrop>
                <button type="button" onClick={() => { setCrop(undefined); setCompletedCrop(undefined); if (fileInputRef.current) fileInputRef.current.value = '' }} className="mt-2 px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Cancel Image Selection</button>
              </div>
            )}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Image Alt Text</label>
          <input
            type="text"
            maxLength={200}
            value={editImageAlt}
            onChange={(e) => setEditImageAlt(e.target.value)}
            placeholder="Brief image description (max 200 chars)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">Accessible description for this image.</p>
        </div>
        {editImageType === 'ai_generated' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">AI Image Prompt</label>
            <textarea value={editAiImagePrompt} onChange={(e) => setEditAiImagePrompt(e.target.value)} placeholder="Describe the image to generate..." className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm" />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancelEdit} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSaveBlock(block)} disabled={saving || uploadingImage} className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50">{uploadingImage ? 'Uploading...' : saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="text-sm text-gray-500 mb-2">Type: {block.image_type === 'ai_generated' ? 'AI Generated' : 'Static Upload'}</div>
      {block.static_image_url && <img src={block.static_image_url} alt="Block image" className="max-w-md rounded border border-gray-200 mb-3" />}
      {block.image_type === 'ai_generated' && block.ai_image_prompt && <div className="mb-3"><div className="text-xs font-medium text-gray-600 mb-1">AI Prompt:</div><div className="bg-white p-2 rounded border border-gray-200 text-sm text-gray-700">{block.ai_image_prompt}</div></div>}
      {!block.static_image_url && !block.ai_image_prompt && <p className="text-sm text-gray-400 italic mb-3">No image configured</p>}
      <button onClick={() => onStartEdit(block)} className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700">Edit Image</button>
    </div>
  )
}
