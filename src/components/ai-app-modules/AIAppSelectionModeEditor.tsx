'use client'

import { useState } from 'react'
import type { AIAppSelectionMode } from '@/types/database'

interface AIAppSelectionModeEditorProps {
  value: AIAppSelectionMode
  onChange: (mode: AIAppSelectionMode) => void
  disabled?: boolean
}

const MODE_OPTIONS: { value: AIAppSelectionMode; label: string; description: string }[] = [
  {
    value: 'affiliate_priority',
    label: 'Affiliate Priority',
    description: 'Affiliates selected first (with cooldown), then non-affiliates to fill remaining slots'
  },
  {
    value: 'random',
    label: 'Random',
    description: 'Randomly select from all available apps, respecting category limits'
  },
  {
    value: 'manual',
    label: 'Manual',
    description: 'Admin manually selects apps for each issue'
  }
]

export default function AIAppSelectionModeEditor({
  value,
  onChange,
  disabled = false
}: AIAppSelectionModeEditorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const currentMode = MODE_OPTIONS.find(m => m.value === value)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">Selection Logic</span>
          {currentMode && (
            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
              {currentMode.label}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      {isOpen && (
        <div className="p-4 space-y-2">
          {MODE_OPTIONS.map(option => (
            <label
              key={option.value}
              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors
                ${value === option.value ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}
                ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                name="aiAppSelectionMode"
                value={option.value}
                checked={value === option.value}
                onChange={(e) => onChange(e.target.value as AIAppSelectionMode)}
                disabled={disabled}
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
  )
}
