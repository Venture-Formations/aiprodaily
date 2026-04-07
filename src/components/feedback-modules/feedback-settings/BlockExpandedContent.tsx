'use client'

import dynamic from 'next/dynamic'
import 'react-quill-new/dist/quill.snow.css'
import { TeamPhotoManager } from '../TeamPhotoManager'
import type { FeedbackBlock, FeedbackVoteOption, FeedbackTeamMember } from '@/types/database'

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false })

// Quill toolbar configuration (matches TextBoxModuleSettings)
const quillModules = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['link'],
    [{ 'color': [] }]
  ],
}

const quillFormats = [
  'bold', 'italic', 'underline',
  'list',
  'link',
  'color'
]

interface BlockExpandedContentProps {
  block: FeedbackBlock
  editingBlock: string | null
  saving: boolean
  // Title editing
  editTitleText: string
  setEditTitleText: (v: string) => void
  // Static text editing
  editStaticContent: string
  setEditStaticContent: (v: string) => void
  editTextSize: 'small' | 'medium' | 'large'
  setEditTextSize: (v: 'small' | 'medium' | 'large') => void
  // Vote options editing
  editVoteOptions: FeedbackVoteOption[]
  setEditVoteOptions: (v: FeedbackVoteOption[]) => void
  // Team photos editing
  editTeamPhotos: FeedbackTeamMember[]
  setEditTeamPhotos: (v: FeedbackTeamMember[]) => void
  // Actions
  onCancelEdit: () => void
  onSaveBlock: (block: FeedbackBlock) => void
  onStartEdit: (block: FeedbackBlock) => void
}

export function BlockExpandedContent({
  block,
  editingBlock,
  saving,
  editTitleText,
  setEditTitleText,
  editStaticContent,
  setEditStaticContent,
  editTextSize,
  setEditTextSize,
  editVoteOptions,
  setEditVoteOptions,
  editTeamPhotos,
  setEditTeamPhotos,
  onCancelEdit,
  onSaveBlock,
  onStartEdit,
}: BlockExpandedContentProps) {
  return (
    <div className="border-t border-gray-200 p-4 bg-gray-50">
      {/* ===== TITLE BLOCK ===== */}
      {block.block_type === 'title' && (
        <div>
          {editingBlock === block.id ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title Text</label>
                <input
                  type="text"
                  value={editTitleText}
                  onChange={(e) => setEditTitleText(e.target.value)}
                  placeholder="That's it for today!"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onCancelEdit} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={() => onSaveBlock(block)} disabled={saving} className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          ) : (
            <div>
              {block.title_text ? (
                <div className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200 font-medium">{block.title_text}</div>
              ) : (
                <p className="text-sm text-gray-400 italic bg-white p-3 rounded-lg border border-gray-200">No title text set</p>
              )}
              <button onClick={() => onStartEdit(block)} className="mt-3 px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700">Edit Title</button>
            </div>
          )}
        </div>
      )}

      {/* ===== STATIC TEXT BLOCK ===== */}
      {block.block_type === 'static_text' && (
        <div>
          {editingBlock === block.id ? (
            <div className="space-y-4">
              {/* Text Size Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Text Size</label>
                <select
                  value={editTextSize}
                  onChange={(e) => setEditTextSize(e.target.value as 'small' | 'medium' | 'large')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm bg-white"
                >
                  <option value="small">Small (14px)</option>
                  <option value="medium">Medium (16px)</option>
                  <option value="large">Large (20px)</option>
                </select>
              </div>
              {/* Rich Text Editor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                  <ReactQuill
                    theme="snow"
                    value={editStaticContent}
                    onChange={setEditStaticContent}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="Enter your text content..."
                    className="feedback-quill-editor"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onCancelEdit} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={() => onSaveBlock(block)} disabled={saving} className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                {block.text_size && (
                  <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded font-medium">
                    {block.text_size === 'small' ? 'Small (14px)' : block.text_size === 'large' ? 'Large (20px)' : 'Medium (16px)'}
                  </span>
                )}
              </div>
              {block.static_content ? (
                <div
                  className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: block.static_content }}
                />
              ) : (
                <p className="text-sm text-gray-400 italic bg-white p-3 rounded-lg border border-gray-200">No content yet</p>
              )}
              <button onClick={() => onStartEdit(block)} className="mt-3 px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700">Edit Content</button>
            </div>
          )}
        </div>
      )}

      {/* ===== VOTE OPTIONS BLOCK ===== */}
      {block.block_type === 'vote_options' && (
        <div>
          {editingBlock === block.id ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">Vote Options</label>
                  <button
                    onClick={() => {
                      const newValue = editVoteOptions.length > 0
                        ? Math.max(1, ...editVoteOptions.map(o => o.value)) + 1
                        : 1
                      setEditVoteOptions([
                        ...editVoteOptions,
                        { value: Math.min(newValue, 5), label: 'New Option', emoji: 'star' as const }
                      ].sort((a, b) => b.value - a.value))
                    }}
                    disabled={editVoteOptions.length >= 5}
                    className="text-sm text-cyan-600 hover:text-cyan-700 disabled:text-gray-400"
                  >
                    + Add Option
                  </button>
                </div>
                <div className="space-y-2">
                  {editVoteOptions.map((option, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2 w-20">
                        <span className="text-amber-400 text-lg">{'★'.repeat(Math.min(option.value, 5))}</span>
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={option.value}
                        onChange={(e) => {
                          const newOptions = [...editVoteOptions]
                          newOptions[index] = { ...newOptions[index], value: parseInt(e.target.value) || 1 }
                          newOptions.sort((a, b) => b.value - a.value)
                          setEditVoteOptions(newOptions)
                        }}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                      <input
                        type="text"
                        value={option.label}
                        onChange={(e) => {
                          const newOptions = [...editVoteOptions]
                          newOptions[index] = { ...newOptions[index], label: e.target.value }
                          setEditVoteOptions(newOptions)
                        }}
                        className="flex-1 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        placeholder="Option label"
                      />
                      <button
                        onClick={() => {
                          if (editVoteOptions.length <= 2) {
                            alert('You must have at least 2 vote options')
                            return
                          }
                          setEditVoteOptions(editVoteOptions.filter((_, i) => i !== index))
                        }}
                        className="text-gray-400 hover:text-red-500"
                        title="Remove option"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Options are sorted by star count (highest first). Min 2, max 5 options.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onCancelEdit} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={() => onSaveBlock(block)} disabled={saving} className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          ) : (
            <div>
              {block.vote_options && block.vote_options.length > 0 ? (
                <div className="space-y-2">
                  {block.vote_options.map((option, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                      <span className="text-amber-400 text-lg w-20">{'★'.repeat(Math.min(option.value, 5))}</span>
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic bg-white p-3 rounded-lg border border-gray-200">No vote options configured</p>
              )}
              <button onClick={() => onStartEdit(block)} className="mt-3 px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700">Edit Options</button>
            </div>
          )}
        </div>
      )}

      {/* ===== TEAM PHOTOS BLOCK ===== */}
      {block.block_type === 'team_photos' && (
        <div>
          {editingBlock === block.id ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Team Photos</label>
                <p className="text-sm text-gray-500 mb-3">
                  Add circular photos of your team (1-10 members). These appear at the bottom of the feedback section.
                </p>
                <TeamPhotoManager
                  photos={editTeamPhotos}
                  onChange={setEditTeamPhotos}
                  maxPhotos={10}
                  disabled={saving}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onCancelEdit} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={() => onSaveBlock(block)} disabled={saving} className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          ) : (
            <div>
              {block.team_photos && block.team_photos.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {block.team_photos.map((photo, index) => (
                    <div key={index} className="text-center">
                      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100">
                        <img
                          src={photo.image_url}
                          alt={photo.name || 'Team member'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {photo.name && <p className="mt-1 text-xs text-gray-600 truncate w-16">{photo.name}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic bg-white p-3 rounded-lg border border-gray-200">No team photos added</p>
              )}
              <button onClick={() => onStartEdit(block)} className="mt-3 px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700">Edit Photos</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
