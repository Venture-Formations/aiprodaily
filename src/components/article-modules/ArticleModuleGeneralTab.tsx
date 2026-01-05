'use client'

import { useState } from 'react'
import ArticleBlockOrderEditor from './ArticleBlockOrderEditor'
import type { ArticleModule, ArticleBlockType, ArticleSelectionMode } from '@/types/database'

interface ArticleModuleGeneralTabProps {
  module: ArticleModule
  onUpdate: (updates: Partial<ArticleModule>) => Promise<void>
  disabled?: boolean
}

const SELECTION_MODE_OPTIONS: { value: ArticleSelectionMode; label: string; description: string }[] = [
  {
    value: 'top_score',
    label: 'Top Score',
    description: 'Automatically selects highest-scoring articles based on criteria ratings'
  },
  {
    value: 'manual',
    label: 'Manual',
    description: 'You manually select which articles to include for each issue'
  }
]

const BLOCK_LABELS: Record<ArticleBlockType, string> = {
  source_image: 'Source Image',
  ai_image: 'AI Image',
  title: 'Title',
  body: 'Body'
}

export default function ArticleModuleGeneralTab({
  module,
  onUpdate,
  disabled = false
}: ArticleModuleGeneralTabProps) {
  const [saving, setSaving] = useState(false)
  const [blockOrderOpen, setBlockOrderOpen] = useState(false)
  const [selectionModeOpen, setSelectionModeOpen] = useState(false)

  const handleArticlesCountChange = async (value: number) => {
    setSaving(true)
    try {
      await onUpdate({ articles_count: value })
    } finally {
      setSaving(false)
    }
  }

  const handleLookbackHoursChange = async (value: number) => {
    setSaving(true)
    try {
      await onUpdate({ lookback_hours: value })
    } finally {
      setSaving(false)
    }
  }

  const handleSelectionModeChange = async (mode: ArticleSelectionMode) => {
    setSaving(true)
    try {
      await onUpdate({ selection_mode: mode })
    } finally {
      setSaving(false)
    }
  }

  const handleBlockOrderChange = async (newOrder: ArticleBlockType[]) => {
    setSaving(true)
    try {
      await onUpdate({ block_order: newOrder })
    } finally {
      setSaving(false)
    }
  }

  const isDisabled = disabled || saving
  const currentMode = SELECTION_MODE_OPTIONS.find(m => m.value === module.selection_mode)

  return (
    <div className="space-y-4">
      {/* Block Order - Collapsible */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setBlockOrderOpen(!blockOrderOpen)}
          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700">Block Order</span>
            {(module.block_order as ArticleBlockType[]).length > 0 && (
              <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">
                {(module.block_order as ArticleBlockType[]).map(b => BLOCK_LABELS[b]).join(' → ')}
              </span>
            )}
          </div>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${blockOrderOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {blockOrderOpen && (
          <div className="p-4 border-t border-gray-100">
            <ArticleBlockOrderEditor
              blockOrder={module.block_order as ArticleBlockType[]}
              onChange={handleBlockOrderChange}
              disabled={isDisabled}
            />
          </div>
        )}
      </div>

      {/* Selection Mode - Collapsible */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setSelectionModeOpen(!selectionModeOpen)}
          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700">Selection Mode</span>
            {currentMode && (
              <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                {currentMode.label}
              </span>
            )}
          </div>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${selectionModeOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {selectionModeOpen && (
          <div className="p-4 space-y-2">
            {SELECTION_MODE_OPTIONS.map(option => (
              <label
                key={option.value}
                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors
                  ${module.selection_mode === option.value ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}
                  ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name="articleSelectionMode"
                  value={option.value}
                  checked={module.selection_mode === option.value}
                  onChange={(e) => handleSelectionModeChange(e.target.value as ArticleSelectionMode)}
                  disabled={isDisabled}
                  className="mt-1"
                />
                <div>
                  <span className="font-medium text-gray-700">{option.label}</span>
                  <p className="text-sm text-gray-500 mt-0.5">{option.description}</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Article Selection Settings - Non-collapsible */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 bg-gray-50">
          <span className="font-medium text-gray-700">Article Selection Settings</span>
        </div>
        <div className="p-4 space-y-4">
          {/* Articles per Issue */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Articles per Issue</label>
              <p className="text-xs text-gray-500">Number of articles to include in this section</p>
            </div>
            <input
              type="number"
              min={1}
              max={10}
              value={module.articles_count}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                if (val >= 1 && val <= 10) {
                  handleArticlesCountChange(val)
                }
              }}
              disabled={isDisabled}
              className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* RSS Lookback Hours */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">RSS Lookback (Hours)</label>
              <p className="text-xs text-gray-500">How far back to look for posts</p>
            </div>
            <input
              type="number"
              min={24}
              max={168}
              step={12}
              value={module.lookback_hours}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                if (val >= 24 && val <= 168) {
                  handleLookbackHoursChange(val)
                }
              }}
              disabled={isDisabled}
              className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Saving indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Saving...
        </div>
      )}
    </div>
  )
}
