'use client'

import type { ResultsConfig } from './types'

interface ResultsPageTabProps {
  resultsConfig: ResultsConfig
  saving: boolean
  onConfigChange: (key: string, value: string) => void
  onSave: () => void
}

export function ResultsPageTab({
  resultsConfig,
  saving,
  onConfigChange,
  onSave,
}: ResultsPageTabProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Customize the text shown on the results page that subscribers see after voting.
      </p>

      {/* Confirmation Message */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Confirmation Message
        </label>
        <input
          type="text"
          value={resultsConfig.confirmation_message}
          onChange={(e) => onConfigChange('confirmation_message', e.target.value)}
          placeholder="Your response has been recorded."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
        />
        <p className="mt-1 text-xs text-gray-400">Shown after the checkmark icon</p>
      </div>

      {/* Results Header */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Results Header
        </label>
        <input
          type="text"
          value={resultsConfig.results_header}
          onChange={(e) => onConfigChange('results_header', e.target.value)}
          placeholder="Results"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
        />
        <p className="mt-1 text-xs text-gray-400">Header text before vote count, e.g. &quot;Results (5 votes)&quot;</p>
      </div>

      {/* First Vote Message */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          First Vote Message
        </label>
        <input
          type="text"
          value={resultsConfig.first_vote_message}
          onChange={(e) => onConfigChange('first_vote_message', e.target.value)}
          placeholder="You're the first to vote!"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
        />
        <p className="mt-1 text-xs text-gray-400">Shown when they&apos;re the first voter on an issue</p>
      </div>

      {/* Feedback Label */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Feedback Label
        </label>
        <input
          type="text"
          value={resultsConfig.feedback_label}
          onChange={(e) => onConfigChange('feedback_label', e.target.value)}
          placeholder="Additional feedback"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
        />
        <p className="mt-1 text-xs text-gray-400">Label above the feedback textarea</p>
      </div>

      {/* Feedback Placeholder */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Feedback Placeholder
        </label>
        <input
          type="text"
          value={resultsConfig.feedback_placeholder}
          onChange={(e) => onConfigChange('feedback_placeholder', e.target.value)}
          placeholder="Elaborate on your answer..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
        />
        <p className="mt-1 text-xs text-gray-400">Placeholder text inside the feedback textarea</p>
      </div>

      {/* Feedback Success Message */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Feedback Success Message
        </label>
        <input
          type="text"
          value={resultsConfig.feedback_success_message}
          onChange={(e) => onConfigChange('feedback_success_message', e.target.value)}
          placeholder="Thank you for your feedback!"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
        />
        <p className="mt-1 text-xs text-gray-400">Shown after submitting additional feedback</p>
      </div>

      {/* Button Text */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Continue Button Text
          </label>
          <input
            type="text"
            value={resultsConfig.continue_button_text}
            onChange={(e) => onConfigChange('continue_button_text', e.target.value)}
            placeholder="Continue"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Submit Button Text
          </label>
          <input
            type="text"
            value={resultsConfig.submit_button_text}
            onChange={(e) => onConfigChange('submit_button_text', e.target.value)}
            placeholder="Submit Feedback"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          />
        </div>
      </div>

      {/* Footer Text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Footer Text
        </label>
        <input
          type="text"
          value={resultsConfig.footer_text}
          onChange={(e) => onConfigChange('footer_text', e.target.value)}
          placeholder="You can close this window at any time."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
        />
        <p className="mt-1 text-xs text-gray-400">Shown at the bottom of the page</p>
      </div>

      {/* Save Button */}
      <div className="pt-4 border-t">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 text-sm font-medium"
        >
          {saving ? 'Saving...' : 'Save Results Page Settings'}
        </button>
      </div>
    </div>
  )
}
