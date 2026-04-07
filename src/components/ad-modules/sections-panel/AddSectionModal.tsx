'use client'

import type { NewSectionType } from './types'
import { SECTION_TYPE_CONFIG, SECTION_TYPE_PLACEHOLDERS } from './types'

export default function AddSectionModal({
  showAddModal,
  newSectionType,
  newModuleName,
  saving,
  feedbackModuleExists,
  onSectionTypeChange,
  onModuleNameChange,
  onAdd,
  onClose,
}: {
  showAddModal: boolean
  newSectionType: NewSectionType
  newModuleName: string
  saving: boolean
  feedbackModuleExists: boolean
  onSectionTypeChange: (type: NewSectionType) => void
  onModuleNameChange: (name: string) => void
  onAdd: () => void
  onClose: () => void
}) {
  if (!showAddModal) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h3 className="text-lg font-semibold mb-4">Add New Section</h3>

        {/* Section Type Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Section Type</label>
          <div className="grid grid-cols-2 gap-2">
            {SECTION_TYPE_CONFIG.map(({ type, label, description, activeColor }) => {
              const isFeedbackDisabled = type === 'feedback' && feedbackModuleExists
              const isActive = newSectionType === type

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onSectionTypeChange(type)}
                  disabled={isFeedbackDisabled}
                  className={`px-3 py-3 rounded-lg border-2 transition-colors ${
                    isActive
                      ? activeColor
                      : isFeedbackDisabled
                        ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <div className="font-medium text-sm">{label}</div>
                  <div className="text-xs mt-1 opacity-75">
                    {isFeedbackDisabled ? 'Already exists' : description}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Section Name Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Section Name</label>
          <input
            type="text"
            value={newModuleName}
            onChange={(e) => onModuleNameChange(e.target.value)}
            placeholder={SECTION_TYPE_PLACEHOLDERS[newSectionType]}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={onAdd}
            disabled={!newModuleName.trim() || saving}
            className={`px-4 py-2 rounded-lg ${
              newModuleName.trim() && !saving
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? 'Creating...' : 'Create Section'}
          </button>
        </div>
      </div>
    </div>
  )
}
