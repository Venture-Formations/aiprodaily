'use client'

import { useState, useEffect } from 'react'
import { TeamPhotoManager } from './TeamPhotoManager'
import type { FeedbackModule, FeedbackVoteOption, FeedbackTeamMember } from '@/types/database'

interface FeedbackModuleSettingsProps {
  publicationId: string
}

export function FeedbackModuleSettings({ publicationId }: FeedbackModuleSettingsProps) {
  const [module, setModule] = useState<FeedbackModule | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  // Form state
  const [isActive, setIsActive] = useState(false)
  const [titleText, setTitleText] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [bodyIsItalic, setBodyIsItalic] = useState(false)
  const [signOffText, setSignOffText] = useState('')
  const [signOffIsItalic, setSignOffIsItalic] = useState(true)
  const [voteOptions, setVoteOptions] = useState<FeedbackVoteOption[]>([])
  const [teamPhotos, setTeamPhotos] = useState<FeedbackTeamMember[]>([])

  // Fetch or create module
  useEffect(() => {
    fetchModule()
  }, [publicationId])

  const fetchModule = async () => {
    try {
      setLoading(true)
      // First try to get existing module
      let response = await fetch(`/api/feedback-modules?publication_id=${publicationId}`)
      let data = await response.json()

      if (!data.module) {
        // Create module if it doesn't exist
        response = await fetch('/api/feedback-modules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publication_id: publicationId })
        })
        data = await response.json()
      }

      if (data.module) {
        setModule(data.module)
        setIsActive(data.module.is_active)
        setTitleText(data.module.title_text || '')
        setBodyText(data.module.body_text || '')
        setBodyIsItalic(data.module.body_is_italic || false)
        setSignOffText(data.module.sign_off_text || '')
        setSignOffIsItalic(data.module.sign_off_is_italic ?? true)
        setVoteOptions(data.module.vote_options || [])
        setTeamPhotos(data.module.team_photos || [])
      }
    } catch (error) {
      console.error('Error fetching feedback module:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveModule = async (updates: Partial<FeedbackModule>) => {
    if (!module) return

    setSaving(true)
    setSaveStatus('idle')

    try {
      const response = await fetch('/api/feedback-modules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: module.id, ...updates })
      })

      const data = await response.json()

      if (data.success && data.module) {
        setModule(data.module)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } else {
        setSaveStatus('error')
      }
    } catch (error) {
      console.error('Error saving feedback module:', error)
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = () => {
    const newValue = !isActive
    setIsActive(newValue)
    saveModule({ is_active: newValue })
  }

  const handleTitleBlur = () => {
    if (module && titleText !== module.title_text) {
      saveModule({ title_text: titleText })
    }
  }

  const handleBodyBlur = () => {
    if (module && (bodyText !== module.body_text || bodyIsItalic !== module.body_is_italic)) {
      saveModule({ body_text: bodyText || null, body_is_italic: bodyIsItalic })
    }
  }

  const handleSignOffBlur = () => {
    if (module && (signOffText !== module.sign_off_text || signOffIsItalic !== module.sign_off_is_italic)) {
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
    const newValue = Math.max(1, ...voteOptions.map(o => o.value)) + 1
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

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Feedback Module</h3>
          <p className="text-sm text-gray-500">
            Collect feedback from subscribers at the end of your newsletter
          </p>
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
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-600">Active</span>
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isActive ? 'bg-cyan-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {/* Title */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Title
        </label>
        <input
          type="text"
          value={titleText}
          onChange={(e) => setTitleText(e.target.value)}
          onBlur={handleTitleBlur}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
          placeholder="That's it for today!"
        />
      </div>

      {/* Body Text */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Body Text
        </label>
        <textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          onBlur={handleBodyBlur}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 resize-none"
          placeholder="Before you go we'd love to know what you thought of today's newsletter..."
        />
        <label className="flex items-center gap-2 mt-2 cursor-pointer">
          <input
            type="checkbox"
            checked={bodyIsItalic}
            onChange={(e) => {
              setBodyIsItalic(e.target.checked)
              if (module) {
                saveModule({ body_text: bodyText || null, body_is_italic: e.target.checked })
              }
            }}
            className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
          />
          <span className="text-sm text-gray-600">Italic</span>
        </label>
      </div>

      {/* Vote Options */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Vote Options
          </label>
          <button
            onClick={addVoteOption}
            disabled={voteOptions.length >= 5}
            className="text-sm text-cyan-600 hover:text-cyan-700 disabled:text-gray-400"
          >
            + Add Option
          </button>
        </div>
        <div className="space-y-2">
          {voteOptions.map((option, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 w-20">
                <span className="text-amber-400 text-lg">{'★'.repeat(option.value)}</span>
              </div>
              <input
                type="number"
                min="1"
                max="5"
                value={option.value}
                onChange={(e) => updateVoteOption(index, { value: parseInt(e.target.value) || 1 })}
                className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <input
                type="text"
                value={option.label}
                onChange={(e) => updateVoteOption(index, { label: e.target.value })}
                className="flex-1 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
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

      {/* Sign-off Text */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Sign-off Text
        </label>
        <input
          type="text"
          value={signOffText}
          onChange={(e) => setSignOffText(e.target.value)}
          onBlur={handleSignOffBlur}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
          placeholder="See you tomorrow!"
        />
        <label className="flex items-center gap-2 mt-2 cursor-pointer">
          <input
            type="checkbox"
            checked={signOffIsItalic}
            onChange={(e) => {
              setSignOffIsItalic(e.target.checked)
              if (module) {
                saveModule({ sign_off_text: signOffText, sign_off_is_italic: e.target.checked })
              }
            }}
            className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
          />
          <span className="text-sm text-gray-600">Italic</span>
        </label>
      </div>

      {/* Team Photos */}
      <div className="mb-6">
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

      {/* Preview Info */}
      <div className="border-t border-gray-200 pt-4">
        <p className="text-sm text-gray-500">
          The feedback module will appear at the bottom of your newsletter when active.
          Votes are tracked per issue with email and IP address.
        </p>
      </div>
    </div>
  )
}
