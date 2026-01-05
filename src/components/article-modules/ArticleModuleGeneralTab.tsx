'use client'

import { useState } from 'react'
import ArticleBlockOrderEditor from './ArticleBlockOrderEditor'
import type { ArticleModule, ArticleBlockType, ArticleSelectionMode } from '@/types/database'

interface ArticleModuleGeneralTabProps {
  module: ArticleModule
  onUpdate: (updates: Partial<ArticleModule>) => Promise<void>
  disabled?: boolean
}

const SELECTION_MODE_LABELS: Record<ArticleSelectionMode, string> = {
  top_score: 'Top Score',
  manual: 'Manual'
}

const SELECTION_MODE_DESCRIPTIONS: Record<ArticleSelectionMode, string> = {
  top_score: 'Automatically selects top-scoring articles based on criteria ratings',
  manual: 'You manually select which articles to include for each issue'
}

export default function ArticleModuleGeneralTab({
  module,
  onUpdate,
  disabled = false
}: ArticleModuleGeneralTabProps) {
  const [saving, setSaving] = useState(false)
  const [selectionSettingsOpen, setSelectionSettingsOpen] = useState(false)
  const [blockOrderOpen, setBlockOrderOpen] = useState(false)

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

  // Get block labels for preview
  const BLOCK_LABELS: Record<ArticleBlockType, string> = {
    source_image: 'Source Image',
    ai_image: 'AI Image',
    title: 'Title',
    body: 'Body'
  }

  return (
    <div className="space-y-4">
      {/* Article Selection Settings - Collapsible */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setSelectionSettingsOpen(!selectionSettingsOpen)}
          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700">Article Selection Settings</span>
            <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">
              {module.articles_count} articles / {module.lookback_hours}h / {SELECTION_MODE_LABELS[module.selection_mode]}
            </span>
          </div>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${selectionSettingsOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {selectionSettingsOpen && (
          <div className="p-4 space-y-5 border-t border-gray-100">
            {/* Articles per Issue */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Articles per Issue</label>
                <p className="text-xs text-gray-500">Number of articles from this section (1-10)</p>
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
                <label className="text-sm font-medium text-gray-700">RSS Lookback Hours</label>
                <p className="text-xs text-gray-500">How far back to look for posts (24-168)</p>
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
                className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Selection Mode */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Selection Mode</label>
                <p className="text-xs text-gray-500">{SELECTION_MODE_DESCRIPTIONS[module.selection_mode]}</p>
              </div>
              <select
                value={module.selection_mode}
                onChange={(e) => handleSelectionModeChange(e.target.value as ArticleSelectionMode)}
                disabled={isDisabled}
                className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {(Object.keys(SELECTION_MODE_LABELS) as ArticleSelectionMode[]).map(mode => (
                  <option key={mode} value={mode}>
                    {SELECTION_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            </div>

            {/* Info Box */}
            <div className="p-3 bg-emerald-50 rounded-lg">
              <p className="text-sm text-emerald-800">
                {module.selection_mode === 'manual' ? (
                  <>
                    <strong>Manual mode:</strong> On each issue page, you&apos;ll choose which articles to display.
                  </>
                ) : (
                  <>
                    <strong>Top Score mode:</strong> Highest-scoring articles are auto-selected. You can still swap on the issue page.
                  </>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

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
                {(module.block_order as ArticleBlockType[]).map(b => BLOCK_LABELS[b]).join(' -> ')}
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
