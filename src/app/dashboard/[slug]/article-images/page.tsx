'use client'

import Layout from '@/components/Layout'
import { useArticleImages, TRANSACTION_TYPES, buildDisplayName, buildLookupKey } from './useArticleImages'

export default function ArticleImagesPage() {
  const {
    fileInputRef,
    suggestionsRef,
    images,
    loading,
    showAddModal,
    setShowAddModal,
    editingImage,
    filterMember,
    setFilterMember,
    filterTransaction,
    setFilterTransaction,
    memberName,
    transactionType,
    setTransactionType,
    imageUrl,
    setImageUrl,
    uploading,
    saving,
    suggestions,
    showSuggestions,
    handleMemberInput,
    selectSuggestion,
    updateSuggestions,
    handleFileUpload,
    handleSave,
    handleDelete,
    resetForm,
    openEdit,
    uniqueMembers,
    uniqueTransactions,
    filteredImages,
  } = useArticleImages()

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap gap-y-3 items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Trade Images</h1>
            <p className="text-sm text-gray-500 mt-1">Each image represents a member + transaction type combination</p>
          </div>
          <button onClick={() => { resetForm(); setShowAddModal(true) }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
            Add Image
          </button>
        </div>

        {/* Filters */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-6">
            <select value={filterMember} onChange={e => setFilterMember(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">All Members ({uniqueMembers.length})</option>
              {uniqueMembers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={filterTransaction} onChange={e => setFilterTransaction(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">All Transactions</option>
              {uniqueTransactions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {(filterMember || filterTransaction) && (
              <button onClick={() => { setFilterMember(''); setFilterTransaction('') }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">Clear</button>
            )}
            <span className="self-center text-sm text-gray-400">
              {filteredImages.length} image{filteredImages.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Image Grid */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : images.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No trade images yet. Click &ldquo;Add Image&rdquo; to get started.</div>
        ) : filteredImages.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No images match the current filters.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredImages.map(img => {
              const meta = img.metadata as Record<string, string>
              return (
                <div key={img.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="aspect-square bg-gray-50 flex items-center justify-center p-2">
                    <img src={img.image_url} alt={img.display_name} className="max-w-full max-h-full object-contain rounded" />
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-gray-900 text-sm truncate">{meta?.member || img.display_name}</p>
                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
                      meta?.transaction?.toLowerCase().includes('sale') ? 'bg-red-100 text-red-700'
                        : meta?.transaction?.toLowerCase() === 'purchase' ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}>{meta?.transaction || '\u2014'}</span>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => openEdit(img)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                      <button onClick={() => handleDelete(img.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
              <h2 className="text-lg font-bold mb-4">{editingImage ? 'Edit' : 'Add'} Trade Image</h2>
              <div className="space-y-4">
                {/* Member Name with Autocomplete */}
                <div className="relative" ref={suggestionsRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Member Name</label>
                  <input type="text" value={memberName} onChange={e => handleMemberInput(e.target.value)}
                    onFocus={() => { if (memberName.length >= 2) updateSuggestions(memberName) }}
                    placeholder="Start typing a member name..." autoComplete="off"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {suggestions.map((member, i) => (
                        <button key={`${member.name}-${i}`} type="button" onClick={() => selectSuggestion(member)}
                          className="w-full text-left px-3 py-2 hover:bg-emerald-50 flex items-center justify-between text-sm border-b border-gray-50 last:border-0">
                          <span className="font-medium text-gray-900">{member.name}</span>
                          <span className="text-xs text-gray-400">{[member.party?.charAt(0), member.state, member.chamber].filter(Boolean).join(' \u00B7 ')}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Transaction Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
                  <select value={transactionType} onChange={e => setTransactionType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white">
                    {TRANSACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {/* Preview of lookup key */}
                {memberName && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500">Display: <span className="font-medium text-gray-700">{buildDisplayName(memberName, transactionType)}</span></p>
                    <p className="text-xs text-gray-400 mt-0.5">Lookup key: {buildLookupKey(memberName, transactionType)}</p>
                  </div>
                )}
                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
                  {imageUrl ? (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <img src={imageUrl} alt="Preview" className="w-16 h-16 object-cover rounded border" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 truncate">{imageUrl}</p>
                        <button onClick={() => setImageUrl('')} className="text-xs text-red-500 hover:text-red-700 mt-1">Remove</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <input ref={fileInputRef} type="file" accept="image/*"
                        onChange={e => { const file = e.target.files?.[0]; if (file) handleFileUpload(file) }}
                        className="hidden" disabled={uploading} />
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        {uploading ? (
                          <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Uploading...</>
                        ) : (
                          <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>Choose Image File</>
                        )}
                      </button>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Or paste image URL:</label>
                        <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..."
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={resetForm} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button onClick={handleSave} disabled={saving || !memberName || !transactionType || !imageUrl}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? 'Saving...' : editingImage ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
