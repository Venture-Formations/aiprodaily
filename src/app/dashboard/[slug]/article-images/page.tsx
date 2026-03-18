'use client'

import { useEffect, useState } from 'react'
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

type Category = 'member' | 'transaction'

function normalizeLookupKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function ArticleImagesPage() {
  const { publicationId } = usePublicationId()

  const [activeTab, setActiveTab] = useState<Category>('member')
  const [images, setImages] = useState<ArticleImage[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingImage, setEditingImage] = useState<ArticleImage | null>(null)

  // Add form state
  const [displayName, setDisplayName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [metadata, setMetadata] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchImages = async () => {
    if (!publicationId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/article-images?publication_id=${publicationId}&category=${activeTab}`)
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
  }, [publicationId, activeTab])

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
    if (!publicationId || !displayName || !imageUrl) return
    setSaving(true)
    try {
      if (editingImage) {
        const res = await fetch(`/api/article-images/${editingImage.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            display_name: displayName,
            image_url: imageUrl,
            lookup_key: normalizeLookupKey(displayName),
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
            category: activeTab,
            lookup_key: normalizeLookupKey(displayName),
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
    setDisplayName('')
    setImageUrl('')
    setMetadata({})
  }

  const openEdit = (img: ArticleImage) => {
    setEditingImage(img)
    setDisplayName(img.display_name)
    setImageUrl(img.image_url)
    setMetadata((img.metadata as Record<string, string>) || {})
    setShowAddModal(true)
  }

  const memberMetaFields = ['party', 'state', 'chamber']

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Article Images</h1>
          <button
            onClick={() => { resetForm(); setShowAddModal(true) }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Add Image
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['member', 'transaction'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab === 'member' ? 'Members' : 'Transactions'}
            </button>
          ))}
        </div>

        {/* Image Grid */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : images.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No {activeTab} images yet. Click &ldquo;Add Image&rdquo; to get started.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map(img => (
              <div key={img.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="aspect-square bg-gray-50 flex items-center justify-center p-2">
                  <img
                    src={img.image_url}
                    alt={img.display_name}
                    className="max-w-full max-h-full object-contain rounded"
                  />
                </div>
                <div className="p-3">
                  <p className="font-medium text-gray-900 text-sm truncate">{img.display_name}</p>
                  <p className="text-xs text-gray-400 truncate">{img.lookup_key}</p>
                  {activeTab === 'member' && img.metadata && (
                    <p className="text-xs text-gray-500 mt-1">
                      {[
                        (img.metadata as any).party,
                        (img.metadata as any).state,
                        (img.metadata as any).chamber
                      ].filter(Boolean).join(' | ')}
                    </p>
                  )}
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
            ))}
          </div>
        )}

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
              <h2 className="text-lg font-bold mb-4">
                {editingImage ? 'Edit' : 'Add'} {activeTab === 'member' ? 'Member' : 'Transaction'} Image
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder={activeTab === 'member' ? 'e.g., Nancy Pelosi' : 'e.g., Purchase'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  {displayName && (
                    <p className="text-xs text-gray-400 mt-1">
                      Lookup key: {normalizeLookupKey(displayName)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
                  {imageUrl ? (
                    <div className="flex items-center gap-3">
                      <img src={imageUrl} alt="Preview" className="w-16 h-16 object-cover rounded border" />
                      <div className="flex-1">
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
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(file)
                        }}
                        className="w-full text-sm"
                        disabled={uploading}
                      />
                      {uploading && <p className="text-xs text-gray-500 mt-1">Uploading...</p>}
                      <div className="mt-2">
                        <label className="block text-xs text-gray-500 mb-1">Or paste URL:</label>
                        <input
                          type="url"
                          value={imageUrl}
                          onChange={e => setImageUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {activeTab === 'member' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Metadata (optional)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {memberMetaFields.map(field => (
                        <div key={field}>
                          <label className="block text-xs text-gray-500 capitalize">{field}</label>
                          <input
                            type="text"
                            value={metadata[field] || ''}
                            onChange={e => setMetadata(prev => ({ ...prev, [field]: e.target.value }))}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            placeholder={field === 'party' ? 'D/R' : field === 'state' ? 'CA' : 'House/Senate'}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                  disabled={saving || !displayName || !imageUrl}
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
