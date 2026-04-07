'use client'

import Link from 'next/link'
import Layout from '@/components/Layout'
import DeleteIssueModal from '@/components/DeleteIssueModal'
import AdModulesPanel from '@/components/AdModulesPanel'
import PollModulesPanel from '@/components/PollModulesPanel'
import AIAppModulesPanel from '@/components/AIAppModulesPanel'
import PromptModulesPanel from '@/components/PromptModulesPanel'
import ArticleModulesPanel from '@/components/ArticleModulesPanel'
import TextBoxModulesPanel from '@/components/TextBoxModulesPanel'
import SparkLoopRecsModulesPanel from '@/components/SparkLoopRecsModulesPanel'
import NewsletterSectionComponent from '@/components/issue-detail/NewsletterSectionComponent'
import IssueHeader from './IssueHeader'
import PreviewModal from './PreviewModal'
import { useIssueDetail } from './useIssueDetail'

export default function IssueDetailPage() {
  const {
    // Core state
    issue,
    loading,
    error,
    saving,
    processing,
    processingStatus,
    previewHtml,
    showPreview,
    setShowPreview,
    generatingSubject,
    previewLoading,
    updatingStatus,
    deleteModal,
    setDeleteModal,
    editingSubject,
    editSubjectValue,
    setEditSubjectValue,
    savingSubject,
    sendingTest,
    testSendStatus,

    // Newsletter sections
    newsletterSections,
    primaryArticlesSection,
    secondaryArticlesSection,

    // Criteria and article limits
    totalMaxArticles,
    sectionExpandedStates,

    // Actions
    sendTestEmail,
    processRSSFeeds,
    previewNewsletter,
    generateSubjectLine,
    startEditingSubject,
    cancelEditingSubject,
    saveSubjectLine,
    formatStatus,
    updateIssueStatus,
    handleDeleteConfirm,
    handleDeleteCancel,
    formatDate,
    toggleSectionExpanded,
  } = useIssueDetail()

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </Layout>
    )
  }

  if (error || !issue) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">
            {error || 'issue not found'}
          </div>
          <Link href="/dashboard/issues" className="text-brand-primary hover:text-blue-700">
            Back to Campaigns
          </Link>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <IssueHeader
          issue={issue}
          totalMaxArticles={totalMaxArticles}
          saving={saving}
          processing={processing}
          processingStatus={processingStatus}
          generatingSubject={generatingSubject}
          previewLoading={previewLoading}
          updatingStatus={updatingStatus}
          sendingTest={sendingTest}
          testSendStatus={testSendStatus}
          editingSubject={editingSubject}
          editSubjectValue={editSubjectValue}
          savingSubject={savingSubject}
          formatStatus={formatStatus}
          formatDate={formatDate}
          sendTestEmail={sendTestEmail}
          processRSSFeeds={processRSSFeeds}
          previewNewsletter={previewNewsletter}
          generateSubjectLine={generateSubjectLine}
          startEditingSubject={startEditingSubject}
          cancelEditingSubject={cancelEditingSubject}
          saveSubjectLine={saveSubjectLine}
          setEditSubjectValue={setEditSubjectValue}
          updateIssueStatus={updateIssueStatus}
          setDeleteModal={setDeleteModal}
        />

        {/* Dynamic Newsletter Sections */}
        {/* Note: Advertisement section (c0bc7173-de47-41b2-a260-77f55525ee3d) is excluded - handled by AdModulesPanel */}
        {/* Note: AI Applications section (853f8d0b-bc76-473a-bfc6-421418266222) is excluded - handled by AIAppModulesPanel */}
        {/* Note: Welcome section (section_type='welcome') is excluded - handled by TextBoxModulesPanel */}
        {newsletterSections
          .filter(section => section.is_active && section.id !== primaryArticlesSection?.id && section.id !== secondaryArticlesSection?.id && section.id !== 'c0bc7173-de47-41b2-a260-77f55525ee3d' && section.id !== '853f8d0b-bc76-473a-bfc6-421418266222' && section.section_type !== 'welcome')
          .map(section => (
            <NewsletterSectionComponent
              key={section.id}
              section={section}
              issue={issue}
              expanded={sectionExpandedStates[section.id] || false}
              onToggleExpanded={() => toggleSectionExpanded(section.id)}
            />
          ))}

        {/* Dynamic Article Sections */}
        {issue && <ArticleModulesPanel issueId={issue.id} issueStatus={issue.status} />}

        {/* Dynamic Ad Sections */}
        {issue && <AdModulesPanel issueId={issue.id} />}

        {/* Dynamic Poll Sections */}
        {issue && <PollModulesPanel issueId={issue.id} />}

        {/* Dynamic AI App Sections */}
        {issue && <AIAppModulesPanel issueId={issue.id} />}

        {/* Dynamic Prompt Sections */}
        {issue && <PromptModulesPanel issueId={issue.id} issueStatus={issue.status} />}

        {/* Text Box Sections */}
        {issue && <TextBoxModulesPanel issueId={issue.id} issueStatus={issue.status} />}

        {/* SparkLoop Recommendation Modules */}
        {issue && <SparkLoopRecsModulesPanel issueId={issue.id} />}

        {/* Preview Modal */}
        {showPreview && (
          <PreviewModal
            previewHtml={previewHtml}
            issueDate={issue.date}
            onClose={() => setShowPreview(false)}
          />
        )}

        {/* Delete issue Modal */}
        {issue && (
          <DeleteIssueModal
            issue={issue}
            isOpen={deleteModal}
            onClose={handleDeleteCancel}
            onConfirm={handleDeleteConfirm}
          />
        )}
      </div>
    </Layout>
  )
}
