'use client'

import Layout from '@/components/Layout'
import Link from 'next/link'
import DeleteIssueModal from '@/components/DeleteIssueModal'
import { useIssuesPage } from './useIssuesPage'

export default function CampaignsPage() {
  const {
    slug, issues, loading, error, filter, setFilter,
    deleteModal, createModal, selectedDate, setSelectedDate, creating,
    getStatusColor, formatStatus, formatDate,
    handleDeleteClick, handleDeleteConfirm, handleDeleteCancel,
    handleCreateNewissue, handleCreateConfirm, handleCreateCancel,
  } = useIssuesPage()

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Publication Issues</h1>
            <div className="flex space-x-2">
              <Link href={`/dashboard/${slug}/issues/new`} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md text-sm font-medium">Create Blank Issue</Link>
              <button onClick={handleCreateNewissue} className="bg-brand-primary hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">Create New Issue</button>
            </div>
          </div>

          <div className="flex space-x-2 overflow-x-auto pb-2">
            {['all', 'draft', 'in_review', 'changes_made', 'sent', 'failed'].map((status) => (
              <button key={status} onClick={() => setFilter(status)} className={`px-3 py-1 text-sm font-medium rounded-md whitespace-nowrap ${filter === status ? 'bg-brand-primary text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                {status === 'all' ? 'All' : formatStatus(status)}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading issues...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">Error: {error}</div>
          ) : issues.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No issues found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject Line</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {issues.map((issue) => (
                    <tr key={issue.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatDate(issue.date)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {issue.subject_line || <span className="italic text-gray-400">No subject line</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(issue.status)}`}>{formatStatus(issue.status)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(issue.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-3">
                          <Link href={`/dashboard/${slug}/issues/${issue.id}`} className="text-brand-primary hover:text-blue-700">View</Link>
                          <button onClick={() => handleDeleteClick(issue)} className="text-red-600 hover:text-red-800">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {deleteModal.issue && (
          <DeleteIssueModal issue={deleteModal.issue} isOpen={deleteModal.isOpen} onClose={handleDeleteCancel} onConfirm={handleDeleteConfirm} />
        )}

        {createModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Create New Issue</h3>
                <div className="mb-4">
                  <label htmlFor="issue-date" className="block text-sm font-medium text-gray-700 mb-2">issue Date</label>
                  <input type="date" id="issue-date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                  <p className="mt-2 text-sm text-gray-500">This will start the full RSS workflow to create articles for this date.</p>
                </div>
                <div className="flex justify-end space-x-3">
                  <button onClick={handleCreateCancel} disabled={creating} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50">Cancel</button>
                  <button onClick={handleCreateConfirm} disabled={creating || !selectedDate} className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-blue-700 disabled:opacity-50">{creating ? 'Creating...' : 'Create issue'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
