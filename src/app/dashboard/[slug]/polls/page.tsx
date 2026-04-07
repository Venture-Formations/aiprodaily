'use client'

import Link from 'next/link'
import Layout from '@/components/Layout'
import { usePolls, type PollWithAnalytics } from './usePolls'

export default function PollsPage() {
  const {
    pathname,
    publicationId,
    polls,
    loading,
    showCreateForm,
    setShowCreateForm,
    showEditForm,
    setShowEditForm,
    formTitle,
    setFormTitle,
    formQuestion,
    setFormQuestion,
    formOptions,
    formImageUrl,
    setFormImageUrl,
    formImageAlt,
    setFormImageAlt,
    handleCreatePoll,
    handleUpdatePoll,
    handleDeletePoll,
    handleToggleActive,
    resetForm,
    openEditForm,
    addOption,
    removeOption,
    updateOption,
    setSelectedPoll,
  } = usePolls()

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </Layout>
    )
  }

  if (!publicationId) {
    return (
      <Layout>
        <div className="text-center text-gray-500 py-12">
          Publication not found. Please select a valid publication.
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <div>
            <nav className="flex" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-2">
                <li>
                  <Link href={pathname.replace('/polls', '/databases')} className="text-gray-500 hover:text-gray-700">
                    Databases
                  </Link>
                </li>
                <li><span className="text-gray-500">/</span></li>
                <li><span className="text-gray-900 font-medium">Polls</span></li>
              </ol>
            </nav>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">Poll Management</h1>
            <p className="text-gray-600">
              {polls.length} total polls &bull; {polls.filter(p => p.is_active).length} active
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowCreateForm(true) }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Create New Poll
          </button>
        </div>

        {/* Create/Edit Form Modal */}
        {(showCreateForm || showEditForm) && (
          <PollFormModal
            isCreate={showCreateForm}
            formTitle={formTitle}
            setFormTitle={setFormTitle}
            formQuestion={formQuestion}
            setFormQuestion={setFormQuestion}
            formOptions={formOptions}
            formImageUrl={formImageUrl}
            setFormImageUrl={setFormImageUrl}
            formImageAlt={formImageAlt}
            setFormImageAlt={setFormImageAlt}
            onSubmit={showCreateForm ? handleCreatePoll : handleUpdatePoll}
            onCancel={() => { setShowCreateForm(false); setShowEditForm(false); setSelectedPoll(null); resetForm() }}
            addOption={addOption}
            removeOption={removeOption}
            updateOption={updateOption}
          />
        )}

        {/* Polls List */}
        <div className="space-y-4">
          {polls.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              No polls created yet. Create your first poll to get started.
            </div>
          ) : (
            polls.map(poll => (
              <PollCard key={poll.id} poll={poll}
                onToggleActive={handleToggleActive}
                onEdit={openEditForm}
                onDelete={handleDeletePoll} />
            ))
          )}
        </div>
      </div>
    </Layout>
  )
}

function PollFormModal({ isCreate, formTitle, setFormTitle, formQuestion, setFormQuestion,
  formOptions, formImageUrl, setFormImageUrl, formImageAlt, setFormImageAlt,
  onSubmit, onCancel, addOption, removeOption, updateOption }: {
  isCreate: boolean
  formTitle: string; setFormTitle: (v: string) => void
  formQuestion: string; setFormQuestion: (v: string) => void
  formOptions: string[]
  formImageUrl: string; setFormImageUrl: (v: string) => void
  formImageAlt: string; setFormImageAlt: (v: string) => void
  onSubmit: () => void; onCancel: () => void
  addOption: () => void; removeOption: (i: number) => void; updateOption: (i: number, v: string) => void
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">{isCreate ? 'Create New Poll' : 'Edit Poll'}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
              className="w-full border rounded px-3 py-2" placeholder="e.g., Help Us Improve" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Question</label>
            <input type="text" value={formQuestion} onChange={(e) => setFormQuestion(e.target.value)}
              className="w-full border rounded px-3 py-2" placeholder="e.g., How satisfied are you with the newsletter?" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Options</label>
            {formOptions.map((option, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input type="text" value={option} onChange={(e) => updateOption(index, e.target.value)}
                  className="flex-1 border rounded px-3 py-2" placeholder={`Option ${index + 1}`} />
                {formOptions.length > 2 && (
                  <button onClick={() => removeOption(index)} className="bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600">Remove</button>
                )}
              </div>
            ))}
            <button onClick={addOption} className="bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300 text-sm">+ Add Option</button>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Image URL (Optional)</label>
            <input type="url" value={formImageUrl} onChange={(e) => setFormImageUrl(e.target.value)}
              className="w-full border rounded px-3 py-2" placeholder="https://example.com/poll-image.jpg" />
            <p className="text-xs text-gray-500 mt-1">Add an image to display with the poll (only shown if poll module has image block enabled)</p>
            {formImageUrl && (
              <>
                <div className="mt-2">
                  <label className="block text-sm font-medium mb-1">Image Alt Text</label>
                  <input type="text" maxLength={200} value={formImageAlt} onChange={(e) => setFormImageAlt(e.target.value)}
                    className="w-full border rounded px-3 py-2" placeholder="Brief image description (max 200 chars)" />
                </div>
                <div className="mt-2">
                  <img src={formImageUrl} alt="Poll preview" className="max-w-xs max-h-32 rounded border"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onSubmit} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            disabled={!formTitle.trim() || !formQuestion.trim()}>
            {isCreate ? 'Create Poll' : 'Update Poll'}
          </button>
          <button onClick={onCancel} className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">Cancel</button>
        </div>
      </div>
    </div>
  )
}

function PollCard({ poll, onToggleActive, onEdit, onDelete }: {
  poll: PollWithAnalytics
  onToggleActive: (p: PollWithAnalytics) => void
  onEdit: (p: PollWithAnalytics) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className={`border rounded-lg p-4 ${poll.is_active ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold">{poll.title}</h3>
            {poll.is_active && <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">ACTIVE</span>}
            {poll.image_url && (
              <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Image
              </span>
            )}
          </div>
          <p className="text-gray-600 mt-1">{poll.question}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onToggleActive(poll)}
            className={`px-3 py-1 rounded text-sm ${poll.is_active ? 'bg-gray-300 text-gray-700 hover:bg-gray-400' : 'bg-green-600 text-white hover:bg-green-700'}`}>
            {poll.is_active ? 'Deactivate' : 'Set Active'}
          </button>
          <button onClick={() => onEdit(poll)} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm">Edit</button>
          <button onClick={() => onDelete(poll.id)} className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm">Delete</button>
        </div>
      </div>
      <div className="mt-3">
        <h4 className="font-medium text-sm mb-2">Options:</h4>
        <div className="grid grid-cols-2 gap-2">
          {poll.options.map((option, index) => (
            <div key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded border">
              <span>{option}</span>
              {poll.analytics && <span className="text-sm text-gray-600">{poll.analytics.option_counts[option] || 0} votes</span>}
            </div>
          ))}
        </div>
      </div>
      {poll.analytics && (
        <div className="mt-4 pt-4 border-t">
          <h4 className="font-medium text-sm mb-2">Analytics:</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white px-3 py-2 rounded border">
              <div className="text-2xl font-bold">{poll.analytics.total_responses}</div>
              <div className="text-xs text-gray-600">Total Responses</div>
            </div>
            <div className="bg-white px-3 py-2 rounded border">
              <div className="text-2xl font-bold">{poll.analytics.unique_respondents}</div>
              <div className="text-xs text-gray-600">Unique Respondents</div>
            </div>
            <div className="bg-white px-3 py-2 rounded border">
              <div className="text-2xl font-bold">
                {poll.analytics.total_responses > 0
                  ? ((poll.analytics.unique_respondents / poll.analytics.total_responses) * 100).toFixed(1)
                  : 0}%
              </div>
              <div className="text-xs text-gray-600">Response Rate</div>
            </div>
          </div>
        </div>
      )}
      <div className="mt-2 text-xs text-gray-500">Created: {new Date(poll.created_at).toLocaleString()}</div>
    </div>
  )
}
