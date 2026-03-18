'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Layout from '@/components/Layout'
import { usePublicationId } from '@/hooks/usePublicationId'

interface ArticleImage {
  id: string
  publication_id: string
  category: string
  lookup_key: string
  display_name: string
  image_url: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface MemberSuggestion {
  name: string
  party: string
  state: string
  chamber: string
}

const TRANSACTION_TYPES = ['Purchase', 'Sale', 'Sale (Partial)', 'Sale (Full)', 'Exchange']

function normalizeLookupKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildDisplayName(member: string, transaction: string): string {
  return `${member} - ${transaction}`
}

function buildLookupKey(member: string, transaction: string): string {
  return normalizeLookupKey(`${member} ${transaction}`)
}

export default function ArticleImagesPage() {
  const { publicationId } = usePublicationId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const [images, setImages] = useState<ArticleImage[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingImage, setEditingImage] = useState<ArticleImage | null>(null)
  const [filterMember, setFilterMember] = useState('')
  const [filterTransaction, setFilterTransaction] = useState('')

  // Add form state
  const [memberName, setMemberName] = useState('')
  const [transactionType, setTransactionType] = useState('Purchase')
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<MemberSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [allMembers, setAllMembers] = useState<MemberSuggestion[]>([])
  const [membersLoaded, setMembersLoaded] = useState(false)

  // Load all members once for fast client-side filtering
  useEffect(() => {
    const loadMembers = async () => {
      try {
        const res = await fetch('/api/article-images/members')
        const data = await res.json()
        setAllMembers(data.members || [])
        setMembersLoaded(true)
      } catch (err) {
        console.error('Failed to load members:', err)
      }
    }
    loadMembers()
  }, [])

  // Filter suggestions client-side as user types
  const updateSuggestions = useCallback((query: string) => {
    if (query.length < 2 || !membersLoaded) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    const q = query.toLowerCase()
    const filtered = allMembers
      .filter(m => m.name.toLowerCase().includes(q))
      .slice(0, 10)
    setSuggestions(filtered)
    setShowSuggestions(filtered.length > 0)
  }, [allMembers, membersLoaded])

  const handleMemberInput = (value: string) => {
    setMemberName(value)
    updateSuggestions(value)
  }

  const selectSuggestion = (member: MemberSuggestion) => {
    setMemberName(member.name)
    setShowSuggestions(false)
  }

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchImages = async () => {
    if (!publicationId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/article-images?publication_id=${publicationId}&category=trade`)
      const data = await res.json()
      setImages(data.images || [])
    } catch (err) {
      console.error('Failed to fetch images:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchImages()
  }, [publicationId])

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const fileName = `article-images/${Date.now()}-${file.name.replace(/\s+/g, '-')}`
      const res = await fetch(`/api/tools/upload-image?fileName=${encodeURIComponent(fileName)}`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.url) {
        setImageUrl(data.url)
      }
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!publicationId || !memberName || !transactionType || !imageUrl) return
    setSaving(true)
    try {
      const displayName = buildDisplayName(memberName, transactionType)
      const lookupKey = buildLookupKey(memberName, transactionType)
      const metadata: Record<string, string> = { member: memberName, transaction: transactionType }

      if (editingImage) {
        const res = await fetch(`/api/article-images/${editingImage.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            display_name: displayName,
            image_url: imageUrl,
            lookup_key: lookupKey,
            metadata,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          alert(data.error || 'Update failed')
          return
        }
      } else {
        const res = await fetch('/api/article-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publication_id: publicationId,
            category: 'trade',
            lookup_key: lookupKey,
            display_name: displayName,
            image_url: imageUrl,
            metadata,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          alert(data.error || 'Create failed')
          return
        }
      }
      resetForm()
      fetchImages()
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this image?')) return
    try {
      await fetch(`/api/article-images/${id}`, { method: 'DELETE' })
      fetchImages()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const resetForm = () => {
    setShowAddModal(false)
    setEditingImage(null)
    setMemberName('')
    setTransactionType('Purchase')
    setImageUrl('')
    setShowSuggestions(false)
  }

  const openEdit = (img: ArticleImage) => {
    setEditingImage(img)
    const meta = img.metadata as Record<string, string>
    setMemberName(meta?.member || img.display_name.split(' - ')[0] || '')
    setTransactionType(meta?.transaction || img.display_name.split(' - ')[1] || 'Purchase')
    setImageUrl(img.image_url)
    setShowAddModal(true)
  }

  // Get unique members and transactions for filter dropdowns
  const uniqueMembers = Array.from(new Set(images.map(img => (img.metadata as any)?.member).filter(Boolean))).sort()
  const uniqueTransactions = Array.from(new Set(images.map(img => (img.metadata as any)?.transaction).filter(Boolean))).sort()

  const filteredImages = images.filter(img => {
    const meta = img.metadata as Record<string, string>
    if (filterMember && meta?.member !== filterMember) return false
    if (filterTransaction && meta?.transaction !== filterTransaction) return false
    return true
  })

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Trade Images</h1>
            <p className="text-sm text-gray-500 mt-1">
              Each image represents a member + transaction type combination
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowAddModal(true) }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Add Image
          </button>
        </div>

        {/* Filters */}
        {images.length > 0 && (
          <div className="flex gap-3 mb-6">
            <select
              value={filterMember}
              onChange={e => setFilterMember(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">All Members ({uniqueMembers.length})</option>
              {uniqueMembers.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={filterTransaction}
              onChange={e => setFilterTransaction(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">All Transactions</option>
              {uniqueTransactions.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {(filterMember || filterTransaction) && (
              <button
                onClick={() => { setFilterMember(''); setFilterTransaction('') }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
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
          <div className="text-center py-12 text-gray-400">
            No trade images yet. Click &ldquo;Add Image&rdquo; to get started.
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No images match the current filters.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredImages.map(img => {
              const meta = img.metadata as Record<string, string>
              return (
                <div key={img.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="aspect-square bg-gray-50 flex items-center justify-center p-2">
                    <img
                      src={img.image_url}
                      alt={img.display_name}
                      className="max-w-full max-h-full object-contain rounded"
                    />
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-gray-900 text-sm truncate">{meta?.member || img.display_name}</p>
                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
                      meta?.transaction?.toLowerCase().includes('sale')
                        ? 'bg-red-100 text-red-700'
                        : meta?.transaction?.toLowerCase() === 'purchase'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}>
                      {meta?.transaction || '\u2014'}
                    </span>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => openEdit(img)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(img.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
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
              <h2 className="text-lg font-bold mb-4">
                {editingImage ? 'Edit' : 'Add'} Trade Image
              </h2>

              <div className="space-y-4">
                {/* Member Name with Autocomplete */}
                <div className="relative" ref={suggestionsRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Member Name</label>
                  <input
                    type="text"
                    value={memberName}
                    onChange={e => handleMemberInput(e.target.value)}
                    onFocus={() => { if (memberName.length >= 2) updateSuggestions(memberName) }}
                    placeholder="Start typing a member name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    autoComplete="off"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {suggestions.map((member, i) => (
                        <button
                          key={`${member.name}-${i}`}
                          type="button"
                          onClick={() => selectSuggestion(member)}
                          className="w-full text-left px-3 py-2 hover:bg-emerald-50 flex items-center justify-between text-sm border-b border-gray-50 last:border-0"
                        >
                          <span className="font-medium text-gray-900">{member.name}</span>
                          <span className="text-xs text-gray-400">
                            {[member.party?.charAt(0), member.state, member.chamber].filter(Boolean).join(' \u00B7 ')}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Transaction Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
                  <select
                    value={transactionType}
                    onChange={e => setTransactionType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  >
                    {TRANSACTION_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Preview of lookup key */}
                {memberName && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500">
                      Display: <span className="font-medium text-gray-700">{buildDisplayName(memberName, transactionType)}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Lookup key: {buildLookupKey(memberName, transactionType)}
                    </p>
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
                        <button
                          onClick={() => setImageUrl('')}
                          className="text-xs text-red-500 hover:text-red-700 mt-1"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(file)
                        }}
                        className="hidden"
                        disabled={uploading}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploading ? (
                          <>
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Uploading...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Choose Image File
                          </>
                        )}
                      </button>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Or paste image URL:</label>
                        <input
                          type="url"
                          value={imageUrl}
                          onChange={e => setImageUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !memberName || !transactionType || !imageUrl}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
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
