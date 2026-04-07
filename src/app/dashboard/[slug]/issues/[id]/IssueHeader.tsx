'use client'

import type { issueWithArticles } from '@/types/database'

interface IssueHeaderProps {
  issue: issueWithArticles
  totalMaxArticles: number
  saving: boolean
  processing: boolean
  processingStatus: string
  generatingSubject: boolean
  previewLoading: boolean
  updatingStatus: boolean
  sendingTest: boolean
  testSendStatus: string
  editingSubject: boolean
  editSubjectValue: string
  savingSubject: boolean
  formatStatus: (status: string) => string
  formatDate: (dateString: string) => string
  sendTestEmail: () => void
  processRSSFeeds: () => void
  previewNewsletter: () => void
  generateSubjectLine: () => void
  startEditingSubject: () => void
  cancelEditingSubject: () => void
  saveSubjectLine: () => void
  setEditSubjectValue: (value: string) => void
  updateIssueStatus: (action: 'changes_made') => void
  setDeleteModal: (open: boolean) => void
}

export default function IssueHeader({
  issue,
  totalMaxArticles,
  saving,
  processing,
  processingStatus,
  generatingSubject,
  previewLoading,
  updatingStatus,
  sendingTest,
  testSendStatus,
  editingSubject,
  editSubjectValue,
  savingSubject,
  formatStatus,
  formatDate,
  sendTestEmail,
  processRSSFeeds,
  previewNewsletter,
  generateSubjectLine,
  startEditingSubject,
  cancelEditingSubject,
  saveSubjectLine,
  setEditSubjectValue,
  updateIssueStatus,
  setDeleteModal,
}: IssueHeaderProps) {
  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Issue for {formatDate(issue.date)}
          </h1>
          <div className="flex items-center space-x-4">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              issue.status === 'draft' ? 'bg-gray-100 text-gray-800' :
              issue.status === 'in_review' ? 'bg-yellow-100 text-yellow-800' :
              issue.status === 'changes_made' ? 'bg-orange-100 text-orange-800' :
              issue.status === 'sent' ? 'bg-green-100 text-green-800' :
              issue.status === 'processing' ? 'bg-blue-100 text-blue-800' :
              'bg-red-100 text-red-800'
            }`}>
              {issue.status === 'processing' && (
                <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {formatStatus(issue.status)}
            </span>
            <span className="text-sm text-gray-500">
              {(issue.articles || []).filter(a => a?.is_active && !a?.skipped).length}/{totalMaxArticles} selected
            </span>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={sendTestEmail}
            disabled={sendingTest || saving || issue.status === 'processing'}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
          >
            {sendingTest ? 'Sending...' : 'Send Test Email'}
          </button>
          <button
            onClick={processRSSFeeds}
            disabled={processing || saving || generatingSubject || issue.status === 'processing'}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
          >
            {(processing || issue.status === 'processing') ? 'Processing in background...' : 'Reprocess Articles'}
          </button>
          <button
            onClick={previewNewsletter}
            disabled={saving || generatingSubject || previewLoading}
            className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-800 px-4 py-2 rounded text-sm font-medium flex items-center space-x-2"
          >
            {previewLoading && (
              <svg className="animate-spin h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            <span>{previewLoading ? 'Loading...' : 'Preview Email'}</span>
          </button>
        </div>
      </div>

      {processingStatus && (
        <div className="text-sm text-blue-600 font-medium mt-3 text-center">
          {processingStatus}
        </div>
      )}

      {testSendStatus && (
        <div className="text-sm text-green-600 font-medium mt-3 text-center">
          {testSendStatus}
        </div>
      )}

      {/* Subject Line Section */}
      <div className="mt-4 p-3 bg-gray-50 rounded">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="text-sm text-gray-600 mb-1">Subject Line:</div>
            {editingSubject ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editSubjectValue}
                  onChange={(e) => setEditSubjectValue(e.target.value)}
                  placeholder="Enter subject line..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {editSubjectValue.length} characters
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={cancelEditingSubject}
                      disabled={savingSubject}
                      className="px-3 py-1 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveSubjectLine}
                      disabled={savingSubject || !editSubjectValue.trim()}
                      className="px-3 py-1 text-sm text-white bg-green-600 border border-green-600 rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {savingSubject ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {issue.subject_line ? (
                  <div className="font-medium text-gray-900">{issue.subject_line}</div>
                ) : (
                  <div className="text-gray-500 italic">No subject line generated yet</div>
                )}
              </>
            )}
          </div>
          {!editingSubject && (
            <div className="ml-4 flex space-x-2">
              {issue.subject_line && (
                <button
                  onClick={startEditingSubject}
                  disabled={generatingSubject || processing || savingSubject}
                  className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm font-medium"
                >
                  Edit
                </button>
              )}
              <button
                onClick={generateSubjectLine}
                disabled={generatingSubject || processing || savingSubject}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm font-medium"
              >
                {generatingSubject ? 'Generating...' : issue.subject_line ? 'Regenerate' : 'Generate'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* issue Approval Buttons */}
      <div className="mt-4 flex justify-end space-x-3">
        <button
          onClick={() => updateIssueStatus('changes_made')}
          disabled={updatingStatus}
          className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center"
        >
          {updatingStatus ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Updating...
            </>
          ) : (
            'Changes Made'
          )}
        </button>
        <button
          onClick={() => setDeleteModal(true)}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium text-sm"
        >
          Delete Issue
        </button>
      </div>
    </div>
  )
}
