'use client'

import { useState } from 'react'
import type { AdSelectionMode } from '@/types/database'

interface SelectionModeEditorProps {
  value: AdSelectionMode
  onChange: (mode: AdSelectionMode) => void
  disabled?: boolean
}

const MODE_OPTIONS: { value: AdSelectionMode; label: string; description: string }[] = [
  {
    value: 'sequential',
    label: 'Sequential',
    description: 'Rotate through ads by usage count (least used first)'
  },
  {
    value: 'random',
    label: 'Random',
    description: 'Randomly select from available ads each time'
  },
  {
    value: 'priority',
    label: 'Priority',
    description: 'Select highest priority ads first, then by usage count'
  },
  {
    value: 'manual',
    label: 'Manual',
    description: 'Admin manually selects the ad for each issue'
  }
]

export default function SelectionModeEditor({
  value,
  onChange,
  disabled = false
}: SelectionModeEditorProps) {
  const [isOpen, setIsOpen] = useState(true)

  const currentMode = MODE_OPTIONS.find(m => m.value === value)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="font-medium text-gray-700">Selection Logic</span>
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
        <div className="p-4 space-y-4">
          {/* Mode Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mode
            </label>
            <select
              value={value}
              onChange={(e) => onChange(e.target.value as AdSelectionMode)}
              disabled={disabled}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
            >
              {MODE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Mode Description */}
          {currentMode && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
              <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-blue-700">{currentMode.description}</p>
            </div>
          )}

          {/* Radio Buttons (alternative view) */}
          <div className="space-y-2">
            {MODE_OPTIONS.map(option => (
              <label
                key={option.value}
                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors
                  ${value === option.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                  ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name="selectionMode"
                  value={option.value}
                  checked={value === option.value}
                  onChange={(e) => onChange(e.target.value as AdSelectionMode)}
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
        </div>
      )}
    </div>
  )
}
