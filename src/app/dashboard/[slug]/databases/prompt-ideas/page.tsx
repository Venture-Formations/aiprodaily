'use client'

import { useParams } from 'next/navigation'
import Layout from '@/components/Layout'
import { usePromptIdeas } from './usePromptIdeas'

export default function PromptIdeasPage() {
  const params = useParams()
  const slug = params?.slug as string || ''

  const {
    prompts, loading, editingId, editForm, setEditForm,
    showAddForm, setShowAddForm, addForm, setAddForm,
    expandedPromptId, setExpandedPromptId,
    uploadingCSV, uploadMessage,
    handleEdit, handleCancelEdit, handleSave, handleDelete,
    handleAddPrompt, handleCSVUpload,
  } = usePromptIdeas(slug)

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Prompt Ideas Database</h1>
            <p className="text-gray-600">Manage AI prompt templates for accounting tasks</p>
          </div>
          <div className="flex items-center space-x-3">
            <label className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium cursor-pointer">
              {uploadingCSV ? 'Uploading...' : 'Upload CSV'}
              <input type="file" accept=".csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleCSVUpload(file); e.target.value = '' }} className="hidden" disabled={uploadingCSV} />
            </label>
            <button onClick={() => setShowAddForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">+ Add Prompt</button>
          </div>
        </div>

        {uploadMessage && (
          <div className={`mb-4 p-3 rounded-lg ${uploadMessage.startsWith('Successfully') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{uploadMessage}</div>
        )}

        {showAddForm && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-2 border-blue-500">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add New Prompt Idea</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Title *</label><input type="text" value={addForm.title || ''} onChange={(e) => setAddForm({ ...addForm, title: e.target.value })} className="w-full border border-gray-300 rounded px-3 py-2" placeholder="Monthly Reconciliation Assistant" /></div>
              <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Prompt Text *</label><textarea value={addForm.prompt_text || ''} onChange={(e) => setAddForm({ ...addForm, prompt_text: e.target.value })} className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-sm" rows={6} placeholder="You are an accounting expert. Help me reconcile my bank statements by..." /></div>
              <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Use Case (optional)</label><input type="text" value={addForm.use_case || ''} onChange={(e) => setAddForm({ ...addForm, use_case: e.target.value })} className="w-full border border-gray-300 rounded px-3 py-2" placeholder="Monthly close process" /></div>
              <div className="md:col-span-2 flex items-center space-x-4">
                <label className="flex items-center"><input type="checkbox" checked={addForm.is_active} onChange={(e) => setAddForm({ ...addForm, is_active: e.target.checked })} className="mr-2" /><span className="text-sm font-medium text-gray-700">Active</span></label>
                <label className="flex items-center"><input type="checkbox" checked={addForm.is_featured} onChange={(e) => setAddForm({ ...addForm, is_featured: e.target.checked })} className="mr-2" /><span className="text-sm font-medium text-gray-700">Featured</span></label>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowAddForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleAddPrompt} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Add Prompt</button>
            </div>
          </div>
        )}

        <div className="mb-4"><span className="text-sm text-gray-600">Showing {prompts.length} prompts</span></div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr></thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {prompts.map((prompt) => (
                <tr key={prompt.id} className={!prompt.is_active ? 'bg-gray-50' : ''}>
                  {editingId === prompt.id ? (
                    <>
                      <td className="px-6 py-4">
                        <input type="text" value={editForm.title || ''} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                        <textarea value={editForm.prompt_text || ''} onChange={(e) => setEditForm({ ...editForm, prompt_text: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1 text-xs mt-2 font-mono" rows={4} />
                      </td>
                      <td className="px-6 py-4">
                        <label className="flex items-center text-sm"><input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} className="mr-1" />Active</label>
                        <label className="flex items-center text-sm mt-1"><input type="checkbox" checked={editForm.is_featured} onChange={(e) => setEditForm({ ...editForm, is_featured: e.target.checked })} className="mr-1" />Featured</label>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button onClick={() => handleSave(prompt.id)} className="text-green-600 hover:text-green-900 mr-3">Save</button>
                        <button onClick={handleCancelEdit} className="text-gray-600 hover:text-gray-900">Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{prompt.title}</div>
                        {prompt.use_case && <div className="text-xs text-gray-500 italic mt-1">{prompt.use_case}</div>}
                        <button onClick={() => setExpandedPromptId(expandedPromptId === prompt.id ? null : prompt.id)} className="text-xs text-blue-600 hover:text-blue-800 mt-1">
                          {expandedPromptId === prompt.id ? 'Hide Prompt' : 'Show Prompt'}
                        </button>
                        {expandedPromptId === prompt.id && (
                          <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200"><pre className="text-xs font-mono whitespace-pre-wrap text-gray-700">{prompt.prompt_text}</pre></div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {prompt.is_active ? <span className="text-green-600">Active</span> : <span className="text-gray-400">Inactive</span>}
                        {prompt.is_featured && <span className="block text-yellow-600 text-xs">Featured</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button onClick={() => handleEdit(prompt)} className="text-blue-600 hover:text-blue-900 mr-3">Edit</button>
                        <button onClick={() => handleDelete(prompt.id, prompt.title)} className="text-red-600 hover:text-red-900">Delete</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {prompts.length === 0 && <div className="text-center py-12 text-gray-500">No prompt ideas found. Click &quot;Add Prompt&quot; to get started.</div>}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow"><div className="text-2xl font-bold text-blue-600">{prompts.length}</div><div className="text-sm text-gray-600">Total Prompts</div></div>
          <div className="bg-white p-4 rounded-lg shadow"><div className="text-2xl font-bold text-green-600">{prompts.filter(p => p.is_active).length}</div><div className="text-sm text-gray-600">Active</div></div>
          <div className="bg-white p-4 rounded-lg shadow"><div className="text-2xl font-bold text-yellow-600">{prompts.filter(p => p.is_featured).length}</div><div className="text-sm text-gray-600">Featured</div></div>
        </div>
      </div>
    </Layout>
  )
}
