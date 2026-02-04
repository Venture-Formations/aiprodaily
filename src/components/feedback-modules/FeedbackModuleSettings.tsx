'use client'

import { useState, useEffect } from 'react'
import { TeamPhotoManager } from './TeamPhotoManager'
import { FeedbackBlockOrderEditor } from './FeedbackBlockOrderEditor'
import type { FeedbackModule, FeedbackVoteOption, FeedbackTeamMember, FeedbackBlockType } from '@/types/database'

interface FeedbackModuleSettingsProps {
  module: FeedbackModule
  publicationId: string
  onUpdate: (updates: Partial<FeedbackModule>) => Promise<void>
  onDelete: () => Promise<void>
}

export function FeedbackModuleSettings({
  module,
  publicationId,
  onUpdate,
  onDelete
}: FeedbackModuleSettingsProps) {
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [activeTab, setActiveTab] = useState<'blocks' | 'content'>('blocks')

  // Form state
  const [name, setName] = useState(module.name)
  const [blockOrder, setBlockOrder] = useState<FeedbackBlockType[]>(
    module.block_order || ['title', 'body', 'vote_options', 'sign_off', 'team_photos']
  )
  const [titleText, setTitleText] = useState(module.title_text || '')
  const [bodyText, setBodyText] = useState(module.body_text || '')
  const [bodyIsItalic, setBodyIsItalic] = useState(module.body_is_italic || false)
  const [signOffText, setSignOffText] = useState(module.sign_off_text || '')
  const [signOffIsItalic, setSignOffIsItalic] = useState(module.sign_off_is_italic ?? true)
  const [voteOptions, setVoteOptions] = useState<FeedbackVoteOption[]>(module.vote_options || [])
  const [teamPhotos, setTeamPhotos] = useState<FeedbackTeamMember[]>(module.team_photos || [])

  // Update form state when module changes
  useEffect(() => {
    setName(module.name)
    setBlockOrder(module.block_order || ['title', 'body', 'vote_options', 'sign_off', 'team_photos'])
    setTitleText(module.title_text || '')
    setBodyText(module.body_text || '')
    setBodyIsItalic(module.body_is_italic || false)
    setSignOffText(module.sign_off_text || '')
    setSignOffIsItalic(module.sign_off_is_italic ?? true)
    setVoteOptions(module.vote_options || [])
    setTeamPhotos(module.team_photos || [])
  }, [module])

  const saveModule = async (updates: Partial<FeedbackModule>) => {
    setSaving(true)
    setSaveStatus('idle')

    try {
      await onUpdate(updates)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      console.error('Error saving feedback module:', error)
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const handleNameBlur = () => {
    if (name.trim() && name !== module.name) {
      saveModule({ name: name.trim() })
    }
  }

  const handleBlockOrderChange = (newOrder: FeedbackBlockType[]) => {
    setBlockOrder(newOrder)
    saveModule({ block_order: newOrder })
  }

  const handleTitleBlur = () => {
    if (titleText !== module.title_text) {
      saveModule({ title_text: titleText })
    }
  }

  const handleBodyBlur = () => {
    if (bodyText !== module.body_text || bodyIsItalic !== module.body_is_italic) {
      saveModule({ body_text: bodyText || null, body_is_italic: bodyIsItalic })
    }
  }

  const handleSignOffBlur = () => {
    if (signOffText !== module.sign_off_text || signOffIsItalic !== module.sign_off_is_italic) {
      saveModule({ sign_off_text: signOffText, sign_off_is_italic: signOffIsItalic })
    }
  }

  const handleVoteOptionsChange = (options: FeedbackVoteOption[]) => {
    setVoteOptions(options)
    saveModule({ vote_options: options })
  }

  const handleTeamPhotosChange = (photos: FeedbackTeamMember[]) => {
    setTeamPhotos(photos)
    saveModule({ team_photos: photos })
  }

  const addVoteOption = () => {
    const newValue = voteOptions.length > 0
      ? Math.max(1, ...voteOptions.map(o => o.value)) + 1
      : 1
    const newOptions = [
      ...voteOptions,
      { value: newValue, label: 'New Option', emoji: 'star' as const }
    ].sort((a, b) => b.value - a.value)
    handleVoteOptionsChange(newOptions)
  }

  const updateVoteOption = (index: number, updates: Partial<FeedbackVoteOption>) => {
    const newOptions = [...voteOptions]
    newOptions[index] = { ...newOptions[index], ...updates }
    // Re-sort by value descending
    newOptions.sort((a, b) => b.value - a.value)
    handleVoteOptionsChange(newOptions)
  }

  const removeVoteOption = (index: number) => {
    if (voteOptions.length <= 2) {
      alert('You must have at least 2 vote options')
      return
    }
    const newOptions = voteOptions.filter((_, i) => i !== index)
    handleVoteOptionsChange(newOptions)
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this feedback module? This cannot be undone.')) {
      await onDelete()
    }
  }

  // Check if a block is included
  const isBlockIncluded = (blockType: FeedbackBlockType) => blockOrder.includes(blockType)

  return (
    <div className="space-y-6">
      {/* Header with name and save status */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleNameBlur()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            disabled={saving}
            className="w-full text-xl font-semibold text-gray-900 bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-yellow-500 focus:outline-none transition-colors px-1 py-1"
          />
          <span className="text-xs text-yellow-600 font-medium">Feedback Module</span>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saved' && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-sm text-red-600">Error saving</span>
          )}
          {saving && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('blocks')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'blocks'
                ? 'border-yellow-500 text-yellow-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Blocks ({blockOrder.length})
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'content'
                ? 'border-yellow-500 text-yellow-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Content
          </button>
        </nav>
      </div>

      {/* Blocks Tab */}
      {activeTab === 'blocks' && (
        <div className="space-y-6">
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-800">
              Configure which blocks appear in your feedback section and in what order.
              Drag to reorder, remove blocks you don't need.
            </p>
          </div>

          <FeedbackBlockOrderEditor
            blockOrder={blockOrder}
            onChange={handleBlockOrderChange}
            disabled={saving}
          />
        </div>
      )}

      {/* Content Tab */}
      {activeTab === 'content' && (
        <div className="space-y-6">
          {/* Title - only show if block is included */}
          {isBlockIncluded('title') && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                type="text"
                value={titleText}
                onChange={(e) => setTitleText(e.target.value)}
                onBlur={handleTitleBlur}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                placeholder="That's it for today!"
              />
            </div>
          )}

          {/* Body Text - only show if block is included */}
          {isBlockIncluded('body') && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Body Text
              </label>
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                onBlur={handleBodyBlur}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 resize-none"
                placeholder="Before you go we'd love to know what you thought of today's newsletter..."
              />
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bodyIsItalic}
                  onChange={(e) => {
                    setBodyIsItalic(e.target.checked)
                    saveModule({ body_text: bodyText || null, body_is_italic: e.target.checked })
                  }}
                  className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-600">Italic</span>
              </label>
            </div>
          )}

          {/* Vote Options - only show if block is included */}
          {isBlockIncluded('vote_options') && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Vote Options
                </label>
                <button
                  onClick={addVoteOption}
                  disabled={voteOptions.length >= 5}
                  className="text-sm text-yellow-600 hover:text-yellow-700 disabled:text-gray-400"
                >
                  + Add Option
                </button>
              </div>
              <div className="space-y-2">
                {voteOptions.map((option, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 w-20">
                      <span className="text-amber-400 text-lg">{'★'.repeat(Math.min(option.value, 5))}</span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={option.value}
                      onChange={(e) => updateVoteOption(index, { value: parseInt(e.target.value) || 1 })}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
                    />
                    <input
                      type="text"
                      value={option.label}
                      onChange={(e) => updateVoteOption(index, { label: e.target.value })}
                      className="flex-1 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500"
                      placeholder="Option label"
                    />
                    <button
                      onClick={() => removeVoteOption(index)}
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
          )}

          {/* Sign-off Text - only show if block is included */}
          {isBlockIncluded('sign_off') && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sign-off Text
              </label>
              <input
                type="text"
                value={signOffText}
                onChange={(e) => setSignOffText(e.target.value)}
                onBlur={handleSignOffBlur}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                placeholder="See you tomorrow!"
              />
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signOffIsItalic}
                  onChange={(e) => {
                    setSignOffIsItalic(e.target.checked)
                    saveModule({ sign_off_text: signOffText, sign_off_is_italic: e.target.checked })
                  }}
                  className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-600">Italic</span>
              </label>
            </div>
          )}

          {/* Team Photos - only show if block is included */}
          {isBlockIncluded('team_photos') && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Team Photos
              </label>
              <p className="text-sm text-gray-500 mb-3">
                Add circular photos of your team (1-10 members). These appear at the bottom of the feedback section.
              </p>
              <TeamPhotoManager
                photos={teamPhotos}
                onChange={handleTeamPhotosChange}
                maxPhotos={10}
              />
            </div>
          )}

          {/* Info when no blocks are configured */}
          {blockOrder.length === 0 && (
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-800">
                No blocks configured. Go to the Blocks tab to add blocks to your feedback section.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Danger Zone */}
      <div className="pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-red-600 mb-3">Danger Zone</h4>
        <button
          onClick={handleDelete}
          disabled={saving}
          className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-300 rounded-lg transition-colors disabled:opacity-50"
        >
          Delete Feedback Module
        </button>
      </div>
    </div>
  )
}
