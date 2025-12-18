'use client'

import { useState } from 'react'

interface CooldownEditorProps {
  value: number
  onChange: (days: number) => void
  disabled?: boolean
}

export default function CooldownEditor({
  value,
  onChange,
  disabled = false
}: CooldownEditorProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [localValue, setLocalValue] = useState(value)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value) || 0
    setLocalValue(newValue)
  }

  const handleBlur = () => {
    // Clamp value between 0 and 30
    const clampedValue = Math.max(0, Math.min(30, localValue))
    setLocalValue(clampedValue)
    if (clampedValue !== value) {
      onChange(clampedValue)
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">Company Cooldown</span>
          <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">
            Global
          </span>
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
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cooldown Days
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={30}
                value={localValue}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={disabled}
                className={`w-24 px-3 py-2 border border-gray-300 rounded-lg shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
              />
              <span className="text-sm text-gray-500">days</span>
            </div>
          </div>

          {/* Info Box */}
          <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm text-yellow-800">
              <p className="font-medium">Applies to ALL ad sections</p>
              <p className="mt-1">
                After a company&apos;s ad appears in a newsletter, they won&apos;t appear again
                for {localValue} days. This prevents over-exposure and ensures variety.
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Set to 0 to disable cooldown (not recommended for production).
          </p>
        </div>
      )}
    </div>
  )
}
