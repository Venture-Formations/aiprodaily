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

  return (
    <div className="space-y-6">
      {/* Articles per Issue */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Articles per Issue
        </label>
        <div className="flex items-center gap-3">
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
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <span className="text-sm text-gray-500">articles (1-10)</span>
        </div>
        <p className="text-xs text-gray-500">
          Number of articles to include from this section in each newsletter
        </p>
      </div>

      {/* RSS Lookback Hours */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          RSS Lookback Hours
        </label>
        <div className="flex items-center gap-3">
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
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <span className="text-sm text-gray-500">hours (24-168)</span>
        </div>
        <p className="text-xs text-gray-500">
          How far back to look for RSS posts when selecting articles
        </p>
      </div>

      {/* Selection Mode */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Selection Mode
        </label>
        <select
          value={module.selection_mode}
          onChange={(e) => handleSelectionModeChange(e.target.value as ArticleSelectionMode)}
          disabled={isDisabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {(Object.keys(SELECTION_MODE_LABELS) as ArticleSelectionMode[]).map(mode => (
            <option key={mode} value={mode}>
              {SELECTION_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500">
          {SELECTION_MODE_DESCRIPTIONS[module.selection_mode]}
        </p>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-emerald-50 rounded-lg">
        <p className="text-sm text-emerald-800">
          {module.selection_mode === 'manual' ? (
            <>
              <strong>Manual mode:</strong> On each issue page, you&apos;ll choose which articles to display in this section.
            </>
          ) : (
            <>
              <strong>Top Score mode:</strong> The highest-scoring articles (based on your criteria) are automatically selected. You can still swap articles on the issue page.
            </>
          )}
        </p>
      </div>

      {/* Block Order */}
      <ArticleBlockOrderEditor
        blockOrder={module.block_order as ArticleBlockType[]}
        onChange={handleBlockOrderChange}
        disabled={isDisabled}
      />
    </div>
  )
}
