'use client'

import { useState, useEffect } from 'react'
import type { TextBoxModule, TextBoxBlock } from '@/types/database'

interface TextBoxModuleSettingsProps {
  module: TextBoxModule
  publicationId: string
  onUpdate: (updates: Partial<TextBoxModule>) => Promise<void>
  onDelete: () => Promise<void>
}

export function TextBoxModuleSettings({
  module,
  publicationId,
  onUpdate,
  onDelete
}: TextBoxModuleSettingsProps) {
  const [localName, setLocalName] = useState(module.name)
  const [showName, setShowName] = useState(module.show_name ?? true)
  const [blocks, setBlocks] = useState<TextBoxBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'blocks'>('general')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    setLocalName(module.name)
    setShowName(module.show_name ?? true)
    fetchBlocks()
  }, [module.id])

  const fetchBlocks = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/text-box-modules/${module.id}/blocks`)
      if (res.ok) {
        const data = await res.json()
        setBlocks(data.blocks || [])
      }
    } catch (error) {
      console.error('Failed to fetch blocks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNameChange = async (newName: string) => {
    if (newName.trim() && newName !== module.name) {
      setSaving(true)
      try {
        await onUpdate({ name: newName.trim() })
      } finally {
        setSaving(false)
      }
    }
  }

  const handleShowNameToggle = async () => {
    const newValue = !showName
    setShowName(newValue)
    setSaving(true)
    try {
      await onUpdate({ show_name: newValue })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await onDelete()
    } finally {
      setSaving(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleAddBlock = async (blockType: 'static_text' | 'ai_prompt' | 'image') => {
    setSaving(true)
    try {
      const res = await fetch(`/api/text-box-modules/${module.id}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block_type: blockType,
          display_order: blocks.length
        })
      })
      if (res.ok) {
        const data = await res.json()
        setBlocks(prev => [...prev, data.block])
      }
    } catch (error) {
      console.error('Failed to add block:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBlock = async (blockId: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/text-box-modules/${module.id}/blocks/${blockId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setBlocks(prev => prev.filter(b => b.id !== blockId))
      }
    } catch (error) {
      console.error('Failed to delete block:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleBlockActive = async (block: TextBoxBlock) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/text-box-modules/${module.id}/blocks/${block.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !block.is_active })
      })
      if (res.ok) {
        const data = await res.json()
        setBlocks(prev => prev.map(b => b.id === block.id ? data.block : b))
      }
    } catch (error) {
      console.error('Failed to toggle block:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <input
            type="text"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={(e) => handleNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleNameChange(localName)
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            disabled={saving}
            className="w-full text-xl font-semibold text-gray-900 bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 focus:outline-none transition-colors px-1 py-1"
          />
          <span className="text-xs text-cyan-600 font-medium">Text Box Module</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Active</span>
          <button
            onClick={async () => {
              setSaving(true)
              try {
                await onUpdate({ is_active: !module.is_active })
              } finally {
                setSaving(false)
              }
            }}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              module.is_active ? 'bg-cyan-600' : 'bg-gray-200'
            } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                module.is_active ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'general'
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('blocks')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'blocks'
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Blocks
          </button>
        </nav>
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Show Section Name Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">Show Section Name</div>
              <div className="text-sm text-gray-500">
                Display the section header in the newsletter. Turn off for sections like "Welcome" that don't need a visible header.
              </div>
            </div>
            <button
              onClick={handleShowNameToggle}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                showName ? 'bg-cyan-600' : 'bg-gray-200'
              } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showName ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Module Info */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500">
              <p className="mb-2">Text Box modules support multiple block types:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Static Text</strong> - Rich text content that stays the same</li>
                <li><strong>AI Prompt</strong> - Content generated by AI each issue</li>
                <li><strong>Image</strong> - Static or AI-generated images</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Blocks Tab */}
      {activeTab === 'blocks' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-600"></div>
            </div>
          ) : blocks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-4">No blocks yet. Add your first block to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blocks.map((block) => (
                <div
                  key={block.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    block.is_active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${!block.is_active ? 'text-gray-400' : ''}`}>
                      {block.block_type === 'static_text' && 'Static Text'}
                      {block.block_type === 'ai_prompt' && 'AI Prompt'}
                      {block.block_type === 'image' && 'Image'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      block.block_type === 'static_text'
                        ? 'bg-gray-100 text-gray-600'
                        : block.block_type === 'ai_prompt'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-green-100 text-green-700'
                    }`}>
                      {block.block_type === 'static_text' && 'Static'}
                      {block.block_type === 'ai_prompt' && 'AI Generated'}
                      {block.block_type === 'image' && (block.image_type === 'ai_generated' ? 'AI Image' : 'Static')}
                    </span>
                    {block.block_type === 'ai_prompt' && (
                      <span className="text-xs text-gray-400">
                        ({block.generation_timing === 'before_articles' ? 'Before' : 'After'} articles)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleBlockActive(block)}
                      disabled={saving}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        block.is_active ? 'bg-cyan-600' : 'bg-gray-200'
                      } ${saving ? 'opacity-50' : ''}`}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          block.is_active ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => handleDeleteBlock(block.id)}
                      disabled={saving}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Block Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <button
              onClick={() => handleAddBlock('static_text')}
              disabled={saving}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              + Static Text
            </button>
            <button
              onClick={() => handleAddBlock('ai_prompt')}
              disabled={saving}
              className="flex-1 px-3 py-2 text-sm border border-amber-200 rounded-lg hover:bg-amber-50 text-amber-700 transition-colors"
            >
              + AI Prompt
            </button>
            <button
              onClick={() => handleAddBlock('image')}
              disabled={saving}
              className="flex-1 px-3 py-2 text-sm border border-green-200 rounded-lg hover:bg-green-50 text-green-700 transition-colors"
            >
              + Image
            </button>
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-red-600 mb-3">Danger Zone</h4>
        {showDeleteConfirm ? (
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-red-700 mb-3">
              Are you sure you want to delete this module? This will also delete all associated blocks.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                {saving ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={saving}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm"
          >
            Delete Module
          </button>
        )}
      </div>
    </div>
  )
}
