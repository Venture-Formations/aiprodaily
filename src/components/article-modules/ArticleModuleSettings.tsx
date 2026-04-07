'use client'

import ArticleModuleGeneralTab from './ArticleModuleGeneralTab'
import ArticleModuleFeedsTab from './ArticleModuleFeedsTab'
import ArticleModulePromptsTab from './ArticleModulePromptsTab'
import { useArticleModuleSettings } from './useArticleModuleSettings'
import type {
  ArticleModule,
  ArticleModuleCriteria,
  ArticleModulePrompt,
  ArticleBlockType
} from '@/types/database'

type TabType = 'general' | 'feeds' | 'prompts'

interface ArticleModuleSettingsProps {
  module: ArticleModule & {
    criteria?: ArticleModuleCriteria[]
    prompts?: ArticleModulePrompt[]
  }
  publicationId: string
  onUpdate: (updates: Partial<ArticleModule>) => Promise<void>
  onDelete: () => void
}

const tabs: { id: TabType; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'feeds', label: 'RSS Feeds' },
  { id: 'prompts', label: 'AI Prompts' }
]

export default function ArticleModuleSettings({
  module,
  publicationId,
  onUpdate,
  onDelete
}: ArticleModuleSettingsProps) {
  const {
    localModule, activeTab, setActiveTab, saving,
    deleteConfirm, setDeleteConfirm, deleteText, setDeleteText,
    feedCount, setFeedCount, saveStatus, showName,
    handleNameChange, handleActiveToggle, handleShowNameToggle,
    handleModuleUpdate, handleDelete, setLocalName,
  } = useArticleModuleSettings({ module, onUpdate, onDelete })

  return (
    <div className="space-y-6">
      {/* Header with name and active toggle */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={localModule.name}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={(e) => handleNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleNameChange(localModule.name)
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            disabled={saving}
            className="text-xl font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded px-1 -ml-1"
          />
          {saveStatus === 'saving' && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-red-600 flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Failed to save
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{localModule.is_active ? 'Active' : 'Inactive'}</span>
          <button
            onClick={handleActiveToggle}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localModule.is_active ? 'bg-emerald-600' : 'bg-gray-200'} ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localModule.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {/* Show Section Name Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <div className="font-medium text-gray-900">Show Section Name</div>
          <div className="text-sm text-gray-500">Display the section header in the newsletter.</div>
        </div>
        <button
          onClick={handleShowNameToggle}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showName ? 'bg-cyan-600' : 'bg-gray-200'} ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showName ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Sub-tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              {tab.label}
              {tab.id === 'feeds' && feedCount !== null && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-gray-100 rounded">{feedCount}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'general' && (
          <ArticleModuleGeneralTab module={localModule} onUpdate={handleModuleUpdate} disabled={saving} />
        )}
        {activeTab === 'feeds' && (
          <ArticleModuleFeedsTab moduleId={module.id} publicationId={publicationId} onFeedCountChange={setFeedCount} />
        )}
        {activeTab === 'prompts' && (
          <ArticleModulePromptsTab
            moduleId={module.id}
            publicationId={publicationId}
            criteria={localModule.criteria || []}
            prompts={localModule.prompts || []}
            aiImagePrompt={localModule.ai_image_prompt}
            onAiImagePromptChange={async (prompt) => { await handleModuleUpdate({ ai_image_prompt: prompt }) }}
          />
        )}
      </div>

      {/* Danger Zone */}
      <div className="border border-red-200 rounded-lg overflow-hidden mt-8">
        <div className="p-4 bg-red-50">
          <h4 className="font-medium text-red-800">Danger Zone</h4>
          <p className="text-sm text-red-600 mt-1">
            Deleting this section will unassign {feedCount ?? '...'} RSS feeds. Articles generated for this section will also be removed.
          </p>
        </div>
        {!deleteConfirm ? (
          <div className="p-4 bg-white">
            <button onClick={() => setDeleteConfirm(true)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Delete Section</button>
          </div>
        ) : (
          <div className="p-4 bg-white space-y-3">
            <p className="text-sm text-gray-700">Type <strong>DELETE</strong> to confirm deletion of &quot;{localModule.name}&quot;</p>
            <input type="text" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder="Type DELETE" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" />
            <div className="flex gap-2">
              <button onClick={() => { setDeleteConfirm(false); setDeleteText('') }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleteText !== 'DELETE' || saving} className={`px-4 py-2 rounded-lg transition-colors ${deleteText === 'DELETE' && !saving ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
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
