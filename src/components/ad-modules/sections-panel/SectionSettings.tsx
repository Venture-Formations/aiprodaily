'use client'

import { useState, useEffect } from 'react'
import type { NewsletterSection } from '@/types/database'

export default function SectionSettings({
  section,
  onUpdate,
  saving
}: {
  section: NewsletterSection
  onUpdate: (updates: Partial<NewsletterSection>) => Promise<void>
  saving: boolean
}) {
  const [localName, setLocalName] = useState(section.name)

  // Update local state when section changes
  useEffect(() => {
    setLocalName(section.name)
  }, [section.name])

  const handleNameChange = async (newName: string) => {
    if (newName.trim() && newName !== section.name) {
      await onUpdate({ name: newName.trim() })
    }
  }

  return (
    <div className="space-y-6">
      {/* Section Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Section Name</label>
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
      </div>

      {/* Section Type Info */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-gray-700">Section Type:</span>
          <span className="text-sm px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full capitalize">
            {section.section_type || 'Standard'}
          </span>
        </div>
        <p className="text-sm text-gray-500">
          This is a standard newsletter section. Use the toggle in the section list to enable or disable it.
        </p>
      </div>
    </div>
  )
}
