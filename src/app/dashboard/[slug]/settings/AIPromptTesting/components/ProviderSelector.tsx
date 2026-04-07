'use client'

import type { Provider } from '../types'

interface ProviderSelectorProps {
  provider: Provider
  setProvider: (p: Provider) => void
}

export default function ProviderSelector({ provider, setProvider }: ProviderSelectorProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        AI Provider
      </label>
      <div className="flex gap-4">
        <button
          onClick={() => setProvider('openai')}
          className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
            provider === 'openai'
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
          }`}
        >
          OpenAI
        </button>
        <button
          onClick={() => setProvider('claude')}
          className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
            provider === 'claude'
              ? 'border-purple-500 bg-purple-50 text-purple-700'
              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
          }`}
        >
          Claude
        </button>
      </div>
    </div>
  )
}
