'use client'

import type { SectionItem } from './types'
import type { NewsletterSection, AdModule, PollModule, AIAppModule, PromptModule, ArticleModule, TextBoxModule, FeedbackModuleWithBlocks, FeedbackBlock, SparkLoopRecModule } from '@/types/database'
import AdModuleSettings from '../AdModuleSettings'
import PollModuleSettings from '../../poll-modules/PollModuleSettings'
import { AIAppModuleSettings } from '../../ai-app-modules'
import PromptModuleSettings from '../../prompt-modules/PromptModuleSettings'
import { ArticleModuleSettings } from '../../article-modules'
import { TextBoxModuleSettings } from '../../text-box-modules'
import { FeedbackModuleSettings } from '../../feedback-modules'
import SparkLoopRecModuleSettings from '../../sparkloop-rec-modules/SparkLoopRecModuleSettings'
import SectionSettings from './SectionSettings'

export interface SelectedItemPanelHandlers {
  handleUpdateModule: (updates: Partial<AdModule>) => Promise<void>
  handleDeleteModule: () => Promise<void>
  handleUpdatePollModule: (updates: Partial<PollModule>) => Promise<void>
  handleDeletePollModule: () => Promise<void>
  handleUpdateAIAppModule: (updates: Partial<AIAppModule>) => Promise<void>
  handleDeleteAIAppModule: () => Promise<void>
  handleUpdatePromptModule: (updates: Partial<PromptModule>) => Promise<void>
  handleDeletePromptModule: () => Promise<void>
  handleUpdateArticleModule: (updates: Partial<ArticleModule>) => Promise<void>
  handleDeleteArticleModule: () => Promise<void>
  handleUpdateTextBoxModule: (updates: Partial<TextBoxModule>) => Promise<void>
  handleDeleteTextBoxModule: () => Promise<void>
  handleUpdateFeedbackModule: (updates: Partial<FeedbackModuleWithBlocks>) => Promise<void>
  handleUpdateFeedbackBlock: (blockId: string, updates: Partial<FeedbackBlock>) => Promise<void>
  handleReorderFeedbackBlocks: (blockIds: string[]) => Promise<void>
  handleAddFeedbackBlock: (blockType: FeedbackBlock['block_type']) => Promise<void>
  handleDeleteFeedbackBlock: (blockId: string) => Promise<void>
  handleDeleteFeedbackModule: () => Promise<void>
  handleUpdateSparkLoopRecModule: (updates: Partial<SparkLoopRecModule>) => Promise<void>
  handleDeleteSparkLoopRecModule: () => Promise<void>
  handleCooldownChange: (days: number) => Promise<void>
  handleUpdateSection: (updates: Partial<NewsletterSection>) => Promise<void>
}

export default function SelectedItemPanel({
  selectedItem,
  publicationId,
  cooldownDays,
  saving,
  handlers,
}: {
  selectedItem: SectionItem | null
  publicationId: string | null
  cooldownDays: number
  saving: boolean
  handlers: SelectedItemPanelHandlers
}) {
  if (!selectedItem) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p>Select a section to view its settings</p>
      </div>
    )
  }

  if (selectedItem.type === 'ad_module' && publicationId) {
    return (
      <AdModuleSettings
        module={selectedItem.data}
        publicationId={publicationId}
        onUpdate={handlers.handleUpdateModule}
        onDelete={handlers.handleDeleteModule}
        cooldownDays={cooldownDays}
        onCooldownChange={handlers.handleCooldownChange}
      />
    )
  }

  if (selectedItem.type === 'ad_module') {
    return <div className="text-gray-500">Loading publication...</div>
  }

  if (selectedItem.type === 'poll_module') {
    return (
      <PollModuleSettings
        module={selectedItem.data}
        onUpdate={handlers.handleUpdatePollModule}
        onDelete={handlers.handleDeletePollModule}
      />
    )
  }

  if (selectedItem.type === 'ai_app_module' && publicationId) {
    return (
      <AIAppModuleSettings
        module={selectedItem.data}
        publicationId={publicationId}
        onUpdate={handlers.handleUpdateAIAppModule}
        onDelete={handlers.handleDeleteAIAppModule}
      />
    )
  }

  if (selectedItem.type === 'ai_app_module') {
    return <div className="text-gray-500">Loading publication...</div>
  }

  if (selectedItem.type === 'prompt_module') {
    return (
      <PromptModuleSettings
        module={selectedItem.data}
        onUpdate={handlers.handleUpdatePromptModule}
        onDelete={handlers.handleDeletePromptModule}
      />
    )
  }

  if (selectedItem.type === 'article_module' && publicationId) {
    return (
      <ArticleModuleSettings
        module={selectedItem.data}
        publicationId={publicationId}
        onUpdate={handlers.handleUpdateArticleModule}
        onDelete={handlers.handleDeleteArticleModule}
      />
    )
  }

  if (selectedItem.type === 'article_module') {
    return <div className="text-gray-500">Loading publication...</div>
  }

  if (selectedItem.type === 'text_box_module' && publicationId) {
    return (
      <TextBoxModuleSettings
        module={selectedItem.data}
        publicationId={publicationId}
        onUpdate={handlers.handleUpdateTextBoxModule}
        onDelete={handlers.handleDeleteTextBoxModule}
      />
    )
  }

  if (selectedItem.type === 'text_box_module') {
    return <div className="text-gray-500">Loading publication...</div>
  }

  if (selectedItem.type === 'feedback_module' && publicationId) {
    return (
      <FeedbackModuleSettings
        module={selectedItem.data}
        publicationId={publicationId}
        onUpdate={handlers.handleUpdateFeedbackModule}
        onUpdateBlock={handlers.handleUpdateFeedbackBlock}
        onReorderBlocks={handlers.handleReorderFeedbackBlocks}
        onAddBlock={handlers.handleAddFeedbackBlock}
        onDeleteBlock={handlers.handleDeleteFeedbackBlock}
        onDelete={handlers.handleDeleteFeedbackModule}
      />
    )
  }

  if (selectedItem.type === 'feedback_module') {
    return <div className="text-gray-500">Loading publication...</div>
  }

  if (selectedItem.type === 'sparkloop_rec_module') {
    return (
      <SparkLoopRecModuleSettings
        module={selectedItem.data}
        onUpdate={handlers.handleUpdateSparkLoopRecModule}
        onDelete={handlers.handleDeleteSparkLoopRecModule}
      />
    )
  }

  // Default: section
  return (
    <SectionSettings
      section={selectedItem.data as NewsletterSection}
      onUpdate={handlers.handleUpdateSection}
      saving={saving}
    />
  )
}
