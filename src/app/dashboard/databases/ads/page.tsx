'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import RichTextEditor from '@/components/RichTextEditor'
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import type { Advertisement } from '@/types/database'
import { getCroppedImage } from '@/utils/imageCrop'

export default function AdsManagementPage() {
  const [activeTab, setActiveTab] = useState<'active' | 'inactive' | 'review'>('active')
  const [ads, setAds] = useState<Advertisement[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null)
  const [nextAdPosition, setNextAdPosition] = useState<number>(1)
  const [draggedItem, setDraggedItem] = useState<number | null>(null)

  useEffect(() => {
    fetchAds()
    if (activeTab === 'active') {
      fetchNextAdPosition()
    }
  }, [activeTab])

  const fetchNextAdPosition = async () => {
    try {
      const response = await fetch('/api/settings/email')
      if (response.ok) {
        const data = await response.json()
        const nextPos = data.settings.find((s: any) => s.key === 'next_ad_position')
        if (nextPos) {
          setNextAdPosition(parseInt(nextPos.value))
        }
      }
    } catch (error) {
      console.error('Failed to fetch next ad position:', error)
    }
  }

  const fetchAds = async () => {
    setLoading(true)
    try {
      let status = ''
      if (activeTab === 'active') {
        status = '?status=active'
      } else if (activeTab === 'inactive') {
        status = '?status=rejected,completed'
      } else if (activeTab === 'review') {
        status = '?status=pending_review'
      }

      const response = await fetch(`/api/ads${status}`)
      if (response.ok) {
        const data = await response.json()
        let fetchedAds = data.ads || []

        // Sort active ads by display_order (show all, even without display_order)
        if (activeTab === 'active') {
          fetchedAds = fetchedAds.sort((a: Advertisement, b: Advertisement) => {
            // Ads with display_order come first, sorted by their order
            if (a.display_order !== null && b.display_order !== null) {
              return a.display_order - b.display_order
            }
            // Ads without display_order go to the end
            if (a.display_order === null) return 1
            if (b.display_order === null) return -1
            return 0
          })
        }

        setAds(fetchedAds)
      }
    } catch (error) {
      console.error('Failed to fetch ads:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResetOrder = async () => {
    if (!confirm('Reset the next ad position to 1? This will start the rotation from the beginning.')) return

    try {
      const response = await fetch('/api/ads/reset-position', {
        method: 'POST'
      })

      if (response.ok) {
        alert('Ad position reset to 1!')
        setNextAdPosition(1)
      } else {
        throw new Error('Failed to reset position')
      }
    } catch (error) {
      console.error('Reset error:', error)
      alert('Failed to reset position')
    }
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedItem(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault()

    if (draggedItem === null || draggedItem === dropIndex) {
      setDraggedItem(null)
      return
    }

    // Reorder ads array
    const newAds = [...ads]
    const [removed] = newAds.splice(draggedItem, 1)
    newAds.splice(dropIndex, 0, removed)

    // Update display_order values
    const updates = newAds.map((ad, index) => ({
      id: ad.id,
      display_order: index + 1
    }))

    // Optimistically update UI
    setAds(newAds)
    setDraggedItem(null)

    // Save to backend
    try {
      const response = await fetch('/api/ads/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      })

      if (!response.ok) {
        throw new Error('Failed to reorder ads')
      }

      // Refresh to ensure consistency
      fetchAds()
    } catch (error) {
      console.error('Reorder error:', error)
      alert('Failed to reorder ads')
      fetchAds()
    }
  }

  const handleOrderChange = async (adId: string, newOrder: number) => {
    if (newOrder < 1) {
      alert('Order must be at least 1')
      return
    }

    if (newOrder > ads.length) {
      alert(`Order cannot exceed ${ads.length}`)
      return
    }

    try {
      const response = await fetch('/api/ads/update-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId, newOrder })
      })

      if (!response.ok) {
        throw new Error('Failed to update order')
      }

      // Refresh ads to show updated ordering
      fetchAds()
    } catch (error) {
      console.error('Order update error:', error)
      alert('Failed to update order')
    }
  }

  const handleApprove = async (adId: string) => {
    if (!confirm('Approve this advertisement?')) return

    try {
      const response = await fetch(`/api/ads/${adId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_by: 'Admin' })
      })

      if (response.ok) {
        alert('Ad approved successfully!')
        fetchAds()
      } else {
        throw new Error('Failed to approve ad')
      }
    } catch (error) {
      console.error('Approval error:', error)
      alert('Failed to approve ad')
    }
  }

  const handleReject = async (adId: string) => {
    const reason = prompt('Enter rejection reason:')
    if (!reason) return

    try {
      const response = await fetch(`/api/ads/${adId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rejection_reason: reason,
          rejected_by: 'Admin'
        })
      })

      if (response.ok) {
        alert('Ad rejected successfully!')
        fetchAds()
      } else {
        throw new Error('Failed to reject ad')
      }
    } catch (error) {
      console.error('Rejection error:', error)
      alert('Failed to reject ad')
    }
  }

  const handleActivate = async (adId: string) => {
    if (!confirm('Activate this advertisement?')) return

    try {
      const response = await fetch(`/api/ads/${adId}/activate`, {
        method: 'POST'
      })

      if (response.ok) {
        alert('Ad activated successfully!')
        fetchAds()
      } else {
        throw new Error('Failed to activate ad')
      }
    } catch (error) {
      console.error('Activation error:', error)
      alert('Failed to activate ad')
    }
  }

  const handleDelete = async (adId: string) => {
    if (!confirm('Delete this advertisement? This cannot be undone.')) return

    try {
      const response = await fetch(`/api/ads/${adId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        alert('Ad deleted successfully!')
        fetchAds()
      } else {
        throw new Error('Failed to delete ad')
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete ad')
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending_payment: 'bg-yellow-100 text-yellow-800',
      pending_review: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      active: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      rejected: 'bg-red-100 text-red-800'
    }

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    )
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <nav className="flex mb-4" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              <li>
                <Link href="/dashboard/databases" className="text-gray-500 hover:text-gray-700">
                  Databases
                </Link>
              </li>
              <li>
                <span className="text-gray-500">/</span>
              </li>
              <li>
                <span className="text-gray-900 font-medium">Advertisements</span>
              </li>
            </ol>
          </nav>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Advertisement Management
              </h1>
              <p className="text-gray-600 mt-1">
                {ads.length} {activeTab} {ads.length === 1 ? 'advertisement' : 'advertisements'}
              </p>
            </div>
            <div className="flex gap-3">
              {activeTab === 'active' && (
                <button
                  onClick={handleResetOrder}
                  className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                >
                  Reset Order
                </button>
              )}
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Add Advertisement
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('active')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'active'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Active Ads (Ordered)
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'review'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Review Submissions
            </button>
            <button
              onClick={() => setActiveTab('inactive')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'inactive'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Inactive & Rejected
            </button>
          </nav>
        </div>

        {/* Next Ad Position Indicator (Active Tab Only) */}
        {activeTab === 'active' && !loading && ads.length > 0 && (
          <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-800">
              <strong>Next ad in rotation:</strong> Position {nextAdPosition}
              {nextAdPosition <= ads.length && (
                <span className="ml-2 text-purple-600">
                  ({ads[nextAdPosition - 1]?.business_name})
                </span>
              )}
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Active Ads List (Drag & Drop) */}
        {!loading && activeTab === 'active' && (
          <div className="space-y-4">
            {ads.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <p className="text-gray-500">No active advertisements found.</p>
              </div>
            ) : (
              ads.map((ad, index) => (
                <div
                  key={ad.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`bg-white rounded-lg shadow p-6 cursor-move hover:shadow-lg transition-shadow ${
                    ad.display_order === nextAdPosition ? 'ring-4 ring-purple-400 bg-purple-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-gray-400">☰</span>
                        <input
                          type="number"
                          min="1"
                          max={ads.length}
                          value={ad.display_order || 0}
                          onChange={(e) => handleOrderChange(ad.id, parseInt(e.target.value))}
                          onClick={(e) => e.stopPropagation()}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center font-bold"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold">{ad.title}</h3>
                          {getStatusBadge(ad.status)}
                          {ad.display_order === nextAdPosition && (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-200 text-purple-800">
                              NEXT IN ROTATION
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {ad.business_name} • {ad.times_used} times used
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingAd(ad)}
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(ad.id)}
                        className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: ad.body }}
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t text-sm">
                    <div>
                      <span className="font-medium">Contact:</span>
                      <p className="text-gray-600">{ad.contact_name}</p>
                      <p className="text-gray-600">{ad.contact_email}</p>
                    </div>
                    <div>
                      <span className="font-medium">Last Used:</span>
                      <p className="text-gray-600">
                        {ad.last_used_date ? new Date(ad.last_used_date).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium">Word Count:</span>
                      <p className="text-gray-600">{ad.word_count} words</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Review Ads List */}
        {!loading && activeTab === 'review' && (
          <div className="space-y-4">
            {ads.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <p className="text-gray-500">No advertisements pending review.</p>
              </div>
            ) : (
              ads.map(ad => (
                <div key={ad.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">{ad.title}</h3>
                        {getStatusBadge(ad.status)}
                      </div>
                      <p className="text-sm text-gray-600">
                        {ad.business_name} • Submitted {new Date(ad.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(ad.id)}
                        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(ad.id)}
                        className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => setEditingAd(ad)}
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: ad.body }}
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t text-sm">
                    <div>
                      <span className="font-medium">Contact:</span>
                      <p className="text-gray-600">{ad.contact_name}</p>
                      <p className="text-gray-600">{ad.contact_email}</p>
                    </div>
                    <div>
                      <span className="font-medium">Word Count:</span>
                      <p className="text-gray-600">{ad.word_count} words</p>
                    </div>
                    {ad.image_url && (
                      <div>
                        <span className="font-medium">Has Image:</span>
                        <p className="text-gray-600">Yes</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Inactive & Rejected Ads List */}
        {!loading && activeTab === 'inactive' && (
          <div className="space-y-4">
            {ads.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <p className="text-gray-500">No inactive or rejected advertisements found.</p>
              </div>
            ) : (
              ads.map(ad => (
                <div key={ad.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">{ad.title}</h3>
                        {getStatusBadge(ad.status)}
                      </div>
                      <p className="text-sm text-gray-600">
                        {ad.business_name} • {ad.times_used} times used
                      </p>
                      {ad.status === 'rejected' && ad.rejection_reason && (
                        <p className="text-sm text-red-600 mt-2">
                          <strong>Rejection reason:</strong> {ad.rejection_reason}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleActivate(ad.id)}
                        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
                      >
                        Activate
                      </button>
                      <button
                        onClick={() => setEditingAd(ad)}
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(ad.id)}
                        className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: ad.body }}
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t text-sm">
                    <div>
                      <span className="font-medium">Contact:</span>
                      <p className="text-gray-600">{ad.contact_name}</p>
                      <p className="text-gray-600">{ad.contact_email}</p>
                    </div>
                    <div>
                      <span className="font-medium">Last Used:</span>
                      <p className="text-gray-600">
                        {ad.last_used_date ? new Date(ad.last_used_date).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium">Word Count:</span>
                      <p className="text-gray-600">{ad.word_count} words</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Add Advertisement Modal */}
        {showAddModal && (
          <AddAdModal
            onClose={() => setShowAddModal(false)}
            onSuccess={() => {
              setShowAddModal(false)
              fetchAds()
            }}
          />
        )}

        {/* Edit Advertisement Modal */}
        {editingAd && (
          <EditAdModal
            ad={editingAd}
            onClose={() => setEditingAd(null)}
            onSuccess={() => {
              setEditingAd(null)
              fetchAds()
            }}
          />
        )}
      </div>
    </Layout>
  )
}

// Add Advertisement Modal Component (Simplified - No frequency/payment fields)
function AddAdModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    business_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    business_address: '',
    business_website: ''
  })
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [useInNextNewsletter, setUseInNextNewsletter] = useState(false)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        setSelectedImage(reader.result as string)
        // Set initial crop to show crop box immediately (5:4 aspect ratio, centered)
        setCrop({
          unit: '%',
          x: 10,
          y: 10,
          width: 80,
          height: 64 // 80 * (4/5) = 64 to maintain 5:4 aspect ratio
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      let imageUrl = null

      // Upload image if present
      if (selectedImage && completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
        const croppedBlob = await getCroppedImage(imgRef.current, completedCrop)
        if (croppedBlob) {
          const imageFormData = new FormData()
          imageFormData.append('image', croppedBlob, 'ad-image.jpg')

          const uploadResponse = await fetch('/api/ads/upload-image', {
            method: 'POST',
            body: imageFormData
          })

          if (uploadResponse.ok) {
            const { url } = await uploadResponse.json()
            imageUrl = url
          } else {
            const errorData = await uploadResponse.json().catch(() => ({ error: 'Unknown error' }))
            throw new Error(errorData.error || 'Failed to upload image')
          }
        }
      }

      // Calculate word count
      const text = formData.body.replace(/<[^>]*>/g, '').trim()
      const words = text.split(/\s+/).filter(w => w.length > 0)
      const wordCount = words.length

      const response = await fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          word_count: wordCount,
          image_url: imageUrl,
          payment_amount: 0,
          payment_status: 'manual',
          paid: true,
          status: 'active', // Admin-created ads go directly to active status
          useInNextNewsletter: useInNextNewsletter // Flag for special positioning
        })
      })

      if (response.ok) {
        alert('Advertisement created successfully!')
        onSuccess()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create advertisement')
      }
    } catch (error) {
      console.error('Create error:', error)
      alert(error instanceof Error ? error.message : 'Failed to create advertisement')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Add Advertisement</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ad Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Enter ad title"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ad Content * (max 100 words)
            </label>
            <RichTextEditor
              value={formData.body}
              onChange={(html) => setFormData({ ...formData, body: html })}
              maxWords={100}
            />
          </div>

          {/* Image Upload and Cropper */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Advertisement Image (Optional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <p className="text-xs text-gray-500 mt-1">
              Upload an image for your ad. It will be cropped to 5:4 ratio.
            </p>
          </div>

          {/* Image Cropper */}
          {selectedImage && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Crop Image (5:4 ratio)
              </label>
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={5 / 4}
              >
                <img
                  ref={imgRef}
                  src={selectedImage}
                  alt="Crop preview"
                  style={{ maxWidth: '100%' }}
                />
              </ReactCrop>
            </div>
          )}

          {/* Use in Next Newsletter Checkbox */}
          <div className="flex items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <input
              type="checkbox"
              id="useInNextNewsletter"
              checked={useInNextNewsletter}
              onChange={(e) => setUseInNextNewsletter(e.target.checked)}
              className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <label htmlFor="useInNextNewsletter" className="text-sm font-medium text-gray-700 cursor-pointer">
              Use in next newsletter
              <p className="text-xs text-gray-600 font-normal mt-1">
                Check this to insert the ad at the next position in the rotation queue (position immediately after the last used ad). Other ads will shift down by one.
              </p>
            </label>
          </div>

          {/* Business Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Name *
              </label>
              <input
                type="text"
                required
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Name *
              </label>
              <input
                type="text"
                required
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Email *
              </label>
              <input
                type="email"
                required
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Phone
              </label>
              <input
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Address
              </label>
              <input
                type="text"
                value={formData.business_address}
                onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website URL
              </label>
              <input
                type="url"
                value={formData.business_website}
                onChange={(e) => setFormData({ ...formData, business_website: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="https://"
              />
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-blue-300"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Advertisement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Edit Advertisement Modal Component
function EditAdModal({ ad, onClose, onSuccess }: { ad: Advertisement; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    title: ad.title,
    body: ad.body,
    business_name: ad.business_name,
    contact_name: ad.contact_name,
    contact_email: ad.contact_email,
    contact_phone: ad.contact_phone || '',
    business_address: ad.business_address || '',
    business_website: ad.business_website || ''
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch(`/api/ads/${ad.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        alert('Advertisement updated successfully!')
        onSuccess()
      } else {
        throw new Error('Failed to update advertisement')
      }
    } catch (error) {
      console.error('Update error:', error)
      alert('Failed to update advertisement')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Edit Advertisement</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ad Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ad Content * (max 100 words)
            </label>
            <RichTextEditor
              value={formData.body}
              onChange={(html) => setFormData({ ...formData, body: html })}
              maxWords={100}
            />
          </div>

          {/* Business Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Name *
              </label>
              <input
                type="text"
                required
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Name *
              </label>
              <input
                type="text"
                required
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Email *
              </label>
              <input
                type="email"
                required
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Phone
              </label>
              <input
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Address
              </label>
              <input
                type="text"
                value={formData.business_address}
                onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website URL
              </label>
              <input
                type="url"
                value={formData.business_website}
                onChange={(e) => setFormData({ ...formData, business_website: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="https://"
              />
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-blue-300"
              disabled={submitting}
            >
              {submitting ? 'Updating...' : 'Update Advertisement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
