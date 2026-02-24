'use client'

import type { issueWithArticles, NewsletterSection } from '@/types/database'
import PromptIdeasSection from './PromptIdeasSection'
import PollSection from './PollSection'

export default function NewsletterSectionComponent({
  section,
  issue,
  expanded,
  onToggleExpanded
}: {
  section: NewsletterSection
  issue: issueWithArticles | null
  expanded: boolean
  onToggleExpanded: () => void
}) {
  if (!issue) return null

  // Section ID constants (reference IDs from newsletter_sections table)
  // These IDs are stable and won't change even if section names are updated
  const SECTION_IDS = {
    PROMPT_IDEAS: 'a917ac63-6cf0-428b-afe7-60a74fbf160b',
    ADVERTISEMENT: 'c0bc7173-de47-41b2-a260-77f55525ee3d',
    AI_APPLICATIONS: '853f8d0b-bc76-473a-bfc6-421418266222'
  }

  const renderSectionContent = () => {
    // Use section ID for Prompt Ideas (stable across name changes)
    if (section.id === SECTION_IDS.PROMPT_IDEAS) {
      return <PromptIdeasSection issue={issue} />
    }

    // Note: Advertisement section (SECTION_IDS.ADVERTISEMENT) is filtered out at the list level
    // and handled by AdModulesPanel instead
    // Note: AI Applications section (SECTION_IDS.AI_APPLICATIONS) is filtered out at the list level
    // and handled by AIAppModulesPanel instead

    // Legacy name-based matching for other sections
    // Note: 'Welcome' case removed - now handled by TextBoxModulesPanel
    switch (section.name) {
      case 'Poll':
        return <PollSection issue={issue} />
      case 'Breaking News':
      case 'Beyond the Feed':
        return (
          <div className="text-center py-8 text-gray-500">
            This section is not used. Content will be generated automatically from your other modules.
          </div>
        )
      default:
        return (
          <div className="text-center py-8 text-gray-500">
            {section.name} content will be generated automatically in the newsletter preview and sent emails.
            <br />
            <span className="text-sm text-gray-400">
              This section is active and will appear in the correct order based on your settings.
            </span>
          </div>
        )
    }
  }

  return (
    <div className="bg-white shadow rounded-lg mt-6">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">
            {section.name}
          </h2>
          <button
            onClick={() => {
              onToggleExpanded()
            }}
            className="flex items-center space-x-2 text-sm text-brand-primary hover:text-blue-700"
          >
            <span>{expanded ? 'Minimize' : `View ${section.name}`}</span>
            <svg
              className={`w-4 h-4 transform transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        <div className="mt-2 text-sm text-gray-600">
          Display Order: {section.display_order} | Status: {section.is_active ? 'Active' : 'Inactive'}
        </div>
      </div>

      {expanded && renderSectionContent()}
    </div>
  )
}
