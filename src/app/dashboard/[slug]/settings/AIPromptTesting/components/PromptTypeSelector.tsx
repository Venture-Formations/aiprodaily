'use client'

import type { ArticleModule, PromptType } from '../types'

interface PromptTypeSelectorProps {
  promptType: PromptType
  setPromptType: (t: PromptType) => void
  articleModules: ArticleModule[]
  loadingModules: boolean
}

export default function PromptTypeSelector({
  promptType,
  setPromptType,
  articleModules,
  loadingModules,
}: PromptTypeSelectorProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Prompt Type
      </label>
      {loadingModules ? (
        <div className="text-gray-500 text-sm">Loading article modules...</div>
      ) : (
        <select
          value={promptType}
          onChange={(e) => setPromptType(e.target.value as PromptType)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Prompt Type"
        >
          {articleModules.map((module) => (
            <optgroup key={module.id} label={module.name}>
              <option value={`module-${module.id}-title`}>{module.name} - Article Title</option>
              <option value={`module-${module.id}-body`}>{module.name} - Article Body</option>
            </optgroup>
          ))}
          <optgroup label="Other">
            <option value="post-scorer">Post Scorer/Evaluator</option>
            <option value="subject-line">Subject Line Generator</option>
            <option value="custom">Custom/Freeform</option>
          </optgroup>
        </select>
      )}
    </div>
  )
}
