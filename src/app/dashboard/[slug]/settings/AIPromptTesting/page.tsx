'use client'

import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Layout from '@/components/Layout'
import { useAIPromptTesting } from './useAIPromptTesting'
import ProviderSelector from './components/ProviderSelector'
import PromptTypeSelector from './components/PromptTypeSelector'
import PostSelector from './components/PostSelector'
import ReferenceGuide from './components/ReferenceGuide'
import PromptEditor from './components/PromptEditor'
import TestHistory from './components/TestHistory'
import TestResultsModal from './components/TestResultsModal'

export default function AIPromptTestingPage() {
  const params = useParams()
  const slug = params.slug as string
  const { status } = useSession()

  const hook = useAIPromptTesting(slug, status)

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            AI Prompt Testing Playground
          </h1>
          <p className="text-sm text-gray-600">
            Test AI prompts without affecting live newsletter prompts. Prompts auto-save to database (accessible from any device).
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Configuration */}
          <div className="space-y-6">
            <ProviderSelector
              provider={hook.provider}
              setProvider={hook.setProvider}
            />

            <PromptTypeSelector
              promptType={hook.promptType}
              setPromptType={hook.setPromptType}
              articleModules={hook.articleModules}
              loadingModules={hook.loadingModules}
            />

            <PostSelector
              postSource={hook.postSource}
              setPostSource={hook.setPostSource}
              promptType={hook.promptType}
              status={status}
              loadingPosts={hook.loadingPosts}
              recentPosts={hook.recentPosts}
              selectedPostId={hook.selectedPostId}
              setSelectedPostId={hook.setSelectedPostId}
              selectedPost={hook.selectedPost}
            />

            <ReferenceGuide promptType={hook.promptType} />
          </div>

          {/* Right Column: Prompt & Response */}
          <div className="space-y-6">
            <PromptEditor
              prompt={hook.prompt}
              setPrompt={hook.setPrompt}
              promptType={hook.promptType}
              testing={hook.testing}
              savedPromptInfo={hook.savedPromptInfo}
              livePrompt={hook.livePrompt}
              livePromptProviderMatches={hook.livePromptProviderMatches}
              isModified={hook.isModified}
              currentResponse={hook.currentResponse}
              onTest={hook.handleTest}
              onTestMultiple={hook.handleTestMultiple}
              onTestMultipleSecondBatch={hook.handleTestMultipleSecondBatch}
              onResetToLivePrompt={hook.resetToLivePrompt}
            />

            <TestHistory
              testHistory={hook.testHistory}
              onSelectResult={hook.openResultModal}
            />
          </div>
        </div>
      </div>

      {/* Test Results Modal */}
      {hook.showModal && hook.currentResponse && (
        <TestResultsModal
          currentResponse={hook.currentResponse}
          onClose={hook.closeModal}
        />
      )}
    </Layout>
  )
}
