'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Layout from '@/components/Layout'
import RichTextEditor from '@/components/RichTextEditor'
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import type { Advertisement, AdModule } from '@/types/database'
import { getCroppedImage } from '@/utils/imageCrop'

interface AdWithRelations extends Advertisement {
  ad_module?: { id: string; name: string } | null
  advertiser?: { id: string; company_name: string; logo_url?: string } | null
}

export default function AdsManagementPage() {
  const pathname = usePathname()
  const [activeStatusTab, setActiveStatusTab] = useState<'active' | 'inactive' | 'review'>('active')
  const [ads, setAds] = useState<AdWithRelations[]>([])
  const [adModules, setAdModules] = useState<AdModule[]>([])
  const [selectedSection, setSelectedSection] = useState<string>('') // ad_module_id
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingAd, setEditingAd] = useState<AdWithRelations | null>(null)
  const [previewingAd, setPreviewingAd] = useState<AdWithRelations | null>(null)
  const [nextAdPosition, setNextAdPosition] = useState<number>(1)
  const [draggedItem, setDraggedItem] = useState<number | null>(null)
  const [publicationId, setPublicationId] = useState<string | null>(null)

  // Fetch publication ID from pathname
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/^\/dashboard\/([^\/]+)/)
      if (match && match[1]) {
        fetchPublicationId(match[1])
      }
    }
  }, [pathname])

  const fetchPublicationId = async (slug: string) => {
    try {
      const response = await fetch('/api/newsletters')
      if (response.ok) {
        const data = await response.json()
        const publication = data.newsletters?.find((n: { slug: string; id: string }) => n.slug === slug)
        if (publication) {
          setPublicationId(publication.id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch publication:', error)
    }
  }

  // Fetch ad modules when publication ID is available
  useEffect(() => {
    if (publicationId) {
      fetchAdModules()
    }
  }, [publicationId])

  const fetchAdModules = async () => {
    try {
      const response = await fetch(`/api/ad-modules?publication_id=${publicationId}`)
      if (response.ok) {
        const data = await response.json()
        const modules = data.modules || []
        setAdModules(modules)

        // Default to first ad module (or "Presented By" if found)
        if (modules.length > 0 && selectedSection === '') {
          const presentedBy = modules.find((m: AdModule) => m.name === 'Presented By')
          setSelectedSection(presentedBy ? presentedBy.id : modules[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch ad modules:', error)
    }
  }

  useEffect(() => {
    fetchAds()
    if (activeStatusTab === 'active') {
      fetchNextAdPosition()
    }
  }, [activeStatusTab, selectedSection])

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
      const params = new URLSearchParams()

      if (activeStatusTab === 'active') {
        params.set('status', 'active')
      } else if (activeStatusTab === 'inactive') {
        params.set('status', 'rejected,completed,approved')
      } else if (activeStatusTab === 'review') {
        params.set('status', 'pending_review')
      }

      // Add section filter (always filter by section now)
      params.set('ad_module_id', selectedSection)

      const response = await fetch(`/api/ads?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        let fetchedAds = data.ads || []

        // Sort active ads by display_order (show all, even without display_order)
        if (activeStatusTab === 'active') {
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
      await fetchAds()
      await fetchNextAdPosition()
    } catch (error) {
      console.error('Reorder error:', error)
      alert('Failed to reorder ads')
      await fetchAds()
      await fetchNextAdPosition()
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
      await fetchAds()
      await fetchNextAdPosition()
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
                {ads.length} {activeStatusTab} {ads.length === 1 ? 'advertisement' : 'advertisements'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Add Advertisement
              </button>
            </div>
          </div>
        </div>

        {/* Section Tabs - Primary Navigation */}
        <div className="border-b border-gray-200 mb-4">
          <nav className="-mb-px flex space-x-1 overflow-x-auto">
            {adModules.map(module => (
              <button
                key={module.id}
                onClick={() => setSelectedSection(module.id)}
                className={`py-3 px-4 border-b-2 font-medium text-sm whitespace-nowrap ${
                  selectedSection === module.id
                    ? 'border-purple-500 text-purple-600 bg-purple-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {module.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Status Tabs - Secondary Navigation */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveStatusTab('active')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeStatusTab === 'active'
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setActiveStatusTab('review')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeStatusTab === 'review'
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Review
          </button>
          <button
            onClick={() => setActiveStatusTab('inactive')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeStatusTab === 'inactive'
                ? 'bg-gray-200 text-gray-800 border border-gray-400'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Inactive
          </button>
        </div>

        {/* Selection Mode Info for Ad Module Sections */}
        {activeStatusTab === 'active' && !loading && ads.length > 0 && (() => {
          const currentModule = adModules.find(m => m.id === selectedSection)
          if (!currentModule) return null
          const selectionMode = currentModule.selection_mode || 'sequential'
          const modeLabels: Record<string, { label: string; description: string }> = {
            sequential: { label: 'Sequential', description: 'Ads rotate in order by position' },
            random: { label: 'Random', description: 'A random ad is selected each time' },
            priority: { label: 'Priority', description: 'Highest priority ad is selected first' },
            manual: { label: 'Manual', description: 'Admin selects ad manually per issue' }
          }
          const modeInfo = modeLabels[selectionMode] || modeLabels.sequential
          // For sequential mode, find the next ad based on next_position
          const nextPosition = currentModule.next_position || 1
          const nextAd = selectionMode === 'sequential'
            ? ads.find(ad => ad.display_order === nextPosition) || ads[0]
            : null
          return (
            <div className={`mb-4 border rounded-lg p-4 ${selectionMode === 'sequential' ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${selectionMode === 'sequential' ? 'text-purple-800' : 'text-blue-800'}`}>
                    <strong>Selection Mode:</strong> {modeInfo.label}
                    <span className={`ml-2 ${selectionMode === 'sequential' ? 'text-purple-600' : 'text-blue-600'}`}>— {modeInfo.description}</span>
                  </p>
                  {selectionMode === 'sequential' && nextAd && (
                    <p className="text-sm text-purple-800 mt-1">
                      <strong>Next in rotation:</strong> Position {nextPosition} — <span className="text-purple-600">{nextAd.title}</span>
                    </p>
                  )}
                </div>
                {selectionMode === 'sequential' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if (confirm('Reset rotation to position 1?')) {
                          const res = await fetch(`/api/ad-modules/${currentModule.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ next_position: 1 })
                          })
                          if (res.ok) {
                            fetchAdModules()
                          }
                        }
                      }}
                      className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
                    >
                      Reset to #1
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={ads.length}
                      value={nextPosition}
                      onChange={async (e) => {
                        const newPos = parseInt(e.target.value) || 1
                        const res = await fetch(`/api/ad-modules/${currentModule.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ next_position: newPos })
                        })
                        if (res.ok) {
                          fetchAdModules()
                        }
                      }}
                      className="w-16 px-2 py-1 border border-purple-300 rounded text-center text-sm"
                      title="Set next position"
                    />
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Active Ads List (Drag & Drop) */}
        {!loading && activeStatusTab === 'active' && (
          <div className="space-y-4">
            {ads.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <p className="text-gray-500">No active advertisements found.</p>
              </div>
            ) : (
              ads.map((ad, index) => {
                const currentModule = adModules.find(m => m.id === selectedSection)
                const selectionMode = currentModule?.selection_mode || 'sequential'
                const nextPosition = currentModule?.next_position || 1
                const isNextInSequential = selectionMode === 'sequential' && ad.display_order === nextPosition

                return (
                <div
                  key={ad.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`bg-white rounded-lg shadow p-6 cursor-move hover:shadow-lg transition-shadow ${
                    isNextInSequential ? 'ring-4 ring-purple-400 bg-purple-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-gray-400">☰</span>
                        <span className="w-16 px-2 py-1 border border-gray-200 bg-gray-50 rounded text-center font-bold text-gray-600">
                          {index + 1}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold">{ad.title}</h3>
                          {getStatusBadge(ad.status)}
                          {isNextInSequential && (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-200 text-purple-800">
                              NEXT IN ROTATION
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {ad.times_used} times used
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPreviewingAd(ad)}
                        className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 text-sm"
                      >
                        Preview
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

                  <div className="mb-4 flex gap-4">
                    <div className="flex-1">
                      <div
                        className="prose prose-sm max-w-none [&_a]:text-blue-600 [&_a]:underline [&_a]:cursor-pointer [&_ol]:list-none [&_ol]:pl-0 [&_ol_li[data-list='bullet']]:pl-6 [&_ol_li[data-list='bullet']]:relative [&_ol_li[data-list='bullet']]:before:content-['•'] [&_ol_li[data-list='bullet']]:before:absolute [&_ol_li[data-list='bullet']]:before:left-0 [&_ol]:counter-reset-[item] [&_ol_li[data-list='ordered']]:pl-6 [&_ol_li[data-list='ordered']]:relative [&_ol_li[data-list='ordered']]:before:content-[counter(item)_'.'] [&_ol_li[data-list='ordered']]:before:absolute [&_ol_li[data-list='ordered']]:before:left-0 [&_ol_li[data-list='ordered']]:counter-increment-[item]"
                        dangerouslySetInnerHTML={{ __html: ad.body }}
                      />
                    </div>
                    {ad.image_url && (
                      <img
                        src={ad.image_url}
                        alt={ad.title}
                        className="w-[284px] h-40 object-cover rounded border border-gray-200 flex-shrink-0"
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t text-sm">
                    <div>
                      <span className="font-medium">Company:</span>
                      <p className="text-gray-600 truncate" title={ad.advertiser?.company_name || ad.company_name || ''}>
                        {ad.advertiser?.company_name || ad.company_name || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium">URL:</span>
                      <p className="text-gray-600 truncate" title={ad.button_url}>{ad.button_url}</p>
                    </div>
                    <div>
                      <span className="font-medium">Last Used:</span>
                      <p className="text-gray-600">
                        {ad.last_used_date ? new Date(ad.last_used_date).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>
              )})
            )}
          </div>
        )}

        {/* Review Ads List */}
        {!loading && activeStatusTab === 'review' && (
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
                        Submitted {new Date(ad.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPreviewingAd(ad)}
                        className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 text-sm"
                      >
                        Preview
                      </button>
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

                  <div className="mb-4 flex gap-4">
                    <div className="flex-1">
                      <div
                        className="prose prose-sm max-w-none [&_a]:text-blue-600 [&_a]:underline [&_a]:cursor-pointer [&_ol]:list-none [&_ol]:pl-0 [&_ol_li[data-list='bullet']]:pl-6 [&_ol_li[data-list='bullet']]:relative [&_ol_li[data-list='bullet']]:before:content-['•'] [&_ol_li[data-list='bullet']]:before:absolute [&_ol_li[data-list='bullet']]:before:left-0 [&_ol]:counter-reset-[item] [&_ol_li[data-list='ordered']]:pl-6 [&_ol_li[data-list='ordered']]:relative [&_ol_li[data-list='ordered']]:before:content-[counter(item)_'.'] [&_ol_li[data-list='ordered']]:before:absolute [&_ol_li[data-list='ordered']]:before:left-0 [&_ol_li[data-list='ordered']]:counter-increment-[item]"
                        dangerouslySetInnerHTML={{ __html: ad.body }}
                      />
                    </div>
                    {ad.image_url && (
                      <img
                        src={ad.image_url}
                        alt={ad.title}
                        className="w-[284px] h-40 object-cover rounded border border-gray-200 flex-shrink-0"
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t text-sm">
                    <div>
                      <span className="font-medium">Company:</span>
                      <p className="text-gray-600 truncate" title={ad.advertiser?.company_name || ad.company_name || ''}>
                        {ad.advertiser?.company_name || ad.company_name || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium">URL:</span>
                      <p className="text-gray-600 truncate" title={ad.button_url}>{ad.button_url}</p>
                    </div>
                    <div>
                      <span className="font-medium">Has Image:</span>
                      <p className="text-gray-600">{ad.image_url ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Inactive & Rejected Ads List */}
        {!loading && activeStatusTab === 'inactive' && (
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
                        {ad.times_used} times used
                      </p>
                      {ad.status === 'rejected' && ad.rejection_reason && (
                        <p className="text-sm text-red-600 mt-2">
                          <strong>Rejection reason:</strong> {ad.rejection_reason}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPreviewingAd(ad)}
                        className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 text-sm"
                      >
                        Preview
                      </button>
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

                  <div className="mb-4 flex gap-4">
                    <div className="flex-1">
                      <div
                        className="prose prose-sm max-w-none [&_a]:text-blue-600 [&_a]:underline [&_a]:cursor-pointer [&_ol]:list-none [&_ol]:pl-0 [&_ol_li[data-list='bullet']]:pl-6 [&_ol_li[data-list='bullet']]:relative [&_ol_li[data-list='bullet']]:before:content-['•'] [&_ol_li[data-list='bullet']]:before:absolute [&_ol_li[data-list='bullet']]:before:left-0 [&_ol]:counter-reset-[item] [&_ol_li[data-list='ordered']]:pl-6 [&_ol_li[data-list='ordered']]:relative [&_ol_li[data-list='ordered']]:before:content-[counter(item)_'.'] [&_ol_li[data-list='ordered']]:before:absolute [&_ol_li[data-list='ordered']]:before:left-0 [&_ol_li[data-list='ordered']]:counter-increment-[item]"
                        dangerouslySetInnerHTML={{ __html: ad.body }}
                      />
                    </div>
                    {ad.image_url && (
                      <img
                        src={ad.image_url}
                        alt={ad.title}
                        className="w-[284px] h-40 object-cover rounded border border-gray-200 flex-shrink-0"
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t text-sm">
                    <div>
                      <span className="font-medium">Company:</span>
                      <p className="text-gray-600 truncate" title={ad.advertiser?.company_name || ad.company_name || ''}>
                        {ad.advertiser?.company_name || ad.company_name || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium">URL:</span>
                      <p className="text-gray-600 truncate" title={ad.button_url}>{ad.button_url}</p>
                    </div>
                    <div>
                      <span className="font-medium">Last Used:</span>
                      <p className="text-gray-600">
                        {ad.last_used_date ? new Date(ad.last_used_date).toLocaleDateString() : 'Never'}
                      </p>
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
            publicationId={publicationId}
            selectedSection={selectedSection}
            sectionName={adModules.find(m => m.id === selectedSection)?.name || 'Ad'}
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
            publicationId={publicationId}
          />
        )}

        {/* Preview Advertisement Modal */}
        {previewingAd && (
          <AdPreviewModal
            ad={previewingAd}
            onClose={() => setPreviewingAd(null)}
          />
        )}
      </div>
    </Layout>
  )
}

// Add Advertisement Modal Component (Simplified - No frequency/payment fields)
function AddAdModal({ onClose, onSuccess, publicationId, selectedSection, sectionName }: {
  onClose: () => void
  onSuccess: () => void
  publicationId: string | null
  selectedSection: string  // ad_module_id
  sectionName: string
}) {
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    button_url: 'https://'
  })
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [submitting, setSubmitting] = useState(false)

  // Company/Advertiser state
  const [advertisers, setAdvertisers] = useState<Array<{ id: string; company_name: string }>>([])
  const [selectedAdvertiserId, setSelectedAdvertiserId] = useState<string>('')
  const [newCompanyName, setNewCompanyName] = useState('')
  const [companyMode, setCompanyMode] = useState<'existing' | 'new'>('new')

  // Fetch existing advertisers
  useEffect(() => {
    if (publicationId) {
      fetch(`/api/advertisers?publication_id=${publicationId}`)
        .then(res => res.json())
        .then(data => {
          if (data.advertisers) {
            setAdvertisers(data.advertisers)
          }
        })
        .catch(err => console.error('Failed to fetch advertisers:', err))
    }
  }, [publicationId])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        setSelectedImage(reader.result as string)
        // Set initial crop to show crop box immediately (16:9 aspect ratio, centered)
        setCrop({
          unit: '%',
          x: 10,
          y: 10,
          width: 80,
          height: 45 // 80 * (9/16) = 45 to maintain 16:9 aspect ratio
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

      // Handle company/advertiser
      let advertiserId = null
      let companyName = ''

      if (companyMode === 'existing' && selectedAdvertiserId) {
        advertiserId = selectedAdvertiserId
        const selectedAd = advertisers.find(a => a.id === selectedAdvertiserId)
        companyName = selectedAd?.company_name || ''
      } else if (companyMode === 'new' && newCompanyName.trim()) {
        // Create new advertiser
        const advertiserResponse = await fetch('/api/advertisers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publication_id: publicationId,
            company_name: newCompanyName.trim()
          })
        })

        if (advertiserResponse.ok) {
          const advertiserData = await advertiserResponse.json()
          advertiserId = advertiserData.advertiser.id
          companyName = newCompanyName.trim()
        } else {
          console.warn('Failed to create advertiser, continuing without')
          companyName = newCompanyName.trim()
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
          advertiser_id: advertiserId,
          company_name: companyName,
          ad_module_id: selectedSection, // Link to ad module
          ad_type: selectedSection // Store section ID
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to create advertisement')
      }

      if (!data.ad) {
        throw new Error('Server returned success but no ad data - please try again')
      }

      alert('Advertisement created successfully!')
      onSuccess()
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
            <h2 className="text-2xl font-bold">Add Advertisement - {sectionName}</h2>
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
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Enter ad title"
            />
          </div>

          {/* Company/Advertiser */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company
            </label>
            <div className="space-y-3">
              {/* Mode toggle */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="companyMode"
                    checked={companyMode === 'new'}
                    onChange={() => setCompanyMode('new')}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">New Company</span>
                </label>
                {advertisers.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="companyMode"
                      checked={companyMode === 'existing'}
                      onChange={() => setCompanyMode('existing')}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Existing Company</span>
                  </label>
                )}
              </div>

              {/* New company input */}
              {companyMode === 'new' && (
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter company name"
                />
              )}

              {/* Existing company dropdown */}
              {companyMode === 'existing' && advertisers.length > 0 && (
                <select
                  value={selectedAdvertiserId}
                  onChange={(e) => setSelectedAdvertiserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select a company...</option>
                  {advertisers.map(adv => (
                    <option key={adv.id} value={adv.id}>
                      {adv.company_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ad Content *
            </label>
            <RichTextEditor
              value={formData.body}
              onChange={(html) => setFormData(prev => ({ ...prev, body: html }))}
              maxWords={10000}
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
              Upload an image for your ad. It will be cropped to 16:9 ratio.
            </p>
          </div>

          {/* Image Cropper */}
          {selectedImage && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Crop Image (16:9 ratio)
              </label>
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={16 / 9}
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

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL *
            </label>
            <input
              type="text"
              required
              value={formData.button_url}
              onChange={(e) => {
                let value = e.target.value;
                // Ensure https:// prefix
                if (!value.startsWith('http://') && !value.startsWith('https://')) {
                  value = 'https://' + value.replace(/^https?:\/\//, '');
                }
                setFormData(prev => ({ ...prev, button_url: value }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="https://example.com"
            />
            <p className="text-xs text-gray-500 mt-1">
              The image and last line of the ad will link to this URL
            </p>
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
function EditAdModal({ ad, onClose, onSuccess, publicationId }: { ad: AdWithRelations; onClose: () => void; onSuccess: () => void; publicationId: string | null }) {
  const [formData, setFormData] = useState({
    title: ad.title,
    body: ad.body,
    button_url: ad.button_url,
    status: ad.status
  })
  const [submitting, setSubmitting] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // Company/Advertiser state
  const [advertisers, setAdvertisers] = useState<Array<{ id: string; company_name: string }>>([])
  const [selectedAdvertiserId, setSelectedAdvertiserId] = useState<string>(ad.advertiser_id || '')
  const [newCompanyName, setNewCompanyName] = useState('')
  const [companyMode, setCompanyMode] = useState<'existing' | 'new'>(ad.advertiser_id ? 'existing' : 'new')

  // Fetch existing advertisers
  useEffect(() => {
    if (publicationId) {
      fetch(`/api/advertisers?publication_id=${publicationId}`)
        .then(res => res.json())
        .then(data => {
          if (data.advertisers) {
            setAdvertisers(data.advertisers)
          }
        })
        .catch(err => console.error('Failed to fetch advertisers:', err))
    }
  }, [publicationId])

  // Initialize company name if editing existing ad
  useEffect(() => {
    if (!ad.advertiser_id && ad.company_name) {
      setNewCompanyName(ad.company_name)
      setCompanyMode('new')
    }
  }, [ad])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        setSelectedImage(reader.result as string)
        // Set initial crop to show crop box immediately (16:9 aspect ratio, centered)
        setCrop({
          unit: '%',
          x: 10,
          y: 10,
          width: 80,
          height: 45 // 80 * (9/16) = 45 to maintain 16:9 aspect ratio
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      let imageUrl = ad.image_url // Keep existing image URL by default

      // Upload new image if one was selected
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

      // Handle company/advertiser
      let advertiserId = ad.advertiser_id
      let companyName = ad.company_name || ''

      if (companyMode === 'existing' && selectedAdvertiserId) {
        advertiserId = selectedAdvertiserId
        const selectedAdv = advertisers.find(a => a.id === selectedAdvertiserId)
        companyName = selectedAdv?.company_name || ''
      } else if (companyMode === 'new' && newCompanyName.trim()) {
        // Check if this is a new company name different from existing
        if (!ad.advertiser_id || newCompanyName.trim() !== ad.company_name) {
          // Create new advertiser
          const advertiserResponse = await fetch('/api/advertisers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              publication_id: publicationId,
              company_name: newCompanyName.trim()
            })
          })

          if (advertiserResponse.ok) {
            const advertiserData = await advertiserResponse.json()
            advertiserId = advertiserData.advertiser.id
            companyName = newCompanyName.trim()
          } else {
            console.warn('Failed to create advertiser, continuing without')
            advertiserId = null
            companyName = newCompanyName.trim()
          }
        } else {
          companyName = newCompanyName.trim()
        }
      }

      // Log what we're sending to help debug
      console.log('[EditAdModal] Sending update:', {
        id: ad.id,
        title: formData.title,
        body: formData.body?.substring(0, 100) + '...', // Truncate for logging
        button_url: formData.button_url,
        status: formData.status,
        image_url: imageUrl,
        advertiser_id: advertiserId,
        company_name: companyName
      })

      const response = await fetch(`/api/ads/${ad.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          image_url: imageUrl,
          advertiser_id: advertiserId,
          company_name: companyName
        })
      })

      const data = await response.json()
      console.log('[EditAdModal] API response:', response.status, data)

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to update advertisement')
      }

      if (!data.ad) {
        throw new Error('Server returned success but no ad data - please try again')
      }

      // Verify the saved data matches what we sent
      if (data.ad.body !== formData.body) {
        console.warn('[EditAdModal] Body mismatch! Sent:', formData.body?.substring(0, 50), 'Got:', data.ad.body?.substring(0, 50))
      }

      alert('Advertisement updated successfully!')
      onSuccess()
    } catch (error) {
      console.error('[EditAdModal] Update error:', error)
      alert(error instanceof Error ? error.message : 'Failed to update advertisement')
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
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {/* Company/Advertiser */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company
            </label>
            <div className="space-y-3">
              {/* Current company display */}
              {ad.advertiser?.company_name && (
                <p className="text-sm text-gray-600">
                  Current: <span className="font-medium">{ad.advertiser.company_name}</span>
                </p>
              )}
              {!ad.advertiser?.company_name && ad.company_name && (
                <p className="text-sm text-gray-600">
                  Current: <span className="font-medium">{ad.company_name}</span>
                </p>
              )}

              {/* Mode toggle */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="editCompanyMode"
                    checked={companyMode === 'new'}
                    onChange={() => setCompanyMode('new')}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">{ad.advertiser_id || ad.company_name ? 'Change Company' : 'New Company'}</span>
                </label>
                {advertisers.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editCompanyMode"
                      checked={companyMode === 'existing'}
                      onChange={() => setCompanyMode('existing')}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Select Existing</span>
                  </label>
                )}
              </div>

              {/* New company input */}
              {companyMode === 'new' && (
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter company name"
                />
              )}

              {/* Existing company dropdown */}
              {companyMode === 'existing' && advertisers.length > 0 && (
                <select
                  value={selectedAdvertiserId}
                  onChange={(e) => setSelectedAdvertiserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select a company...</option>
                  {advertisers.map(adv => (
                    <option key={adv.id} value={adv.id}>
                      {adv.company_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ad Content *
            </label>
            <RichTextEditor
              value={formData.body}
              onChange={(html) => setFormData(prev => ({ ...prev, body: html }))}
              maxWords={10000}
            />
          </div>

          {/* Current Image Display */}
          {ad.image_url && !selectedImage && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Image
              </label>
              <img
                src={ad.image_url}
                alt={ad.title}
                className="w-full max-w-md h-auto rounded border border-gray-200 mb-2"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
              >
                Replace Image
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Image Upload (if no current image) */}
          {!ad.image_url && !selectedImage && (
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
                Upload an image for your ad. It will be cropped to 16:9 ratio.
              </p>
            </div>
          )}

          {/* Image Cropper */}
          {selectedImage && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Crop New Image (16:9 ratio)
              </label>
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={16 / 9}
              >
                <img
                  ref={imgRef}
                  src={selectedImage}
                  alt="Crop preview"
                  style={{ maxWidth: '100%' }}
                />
              </ReactCrop>
              <button
                type="button"
                onClick={() => {
                  setSelectedImage(null)
                  setCrop(undefined)
                  setCompletedCrop(undefined)
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }}
                className="mt-2 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-sm"
              >
                Cancel Image Change
              </button>
            </div>
          )}

          {/* Status Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Advertisement Status
              </label>
              <p className="text-xs text-gray-600">
                {formData.status === 'active' ? 'Ad is active and will appear in newsletters' : 'Ad is inactive (approved but not in rotation)'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormData(prev => ({
                ...prev,
                status: prev.status === 'active' ? 'approved' : 'active'
              }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.status === 'active' ? 'bg-green-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL *
            </label>
            <input
              type="text"
              required
              value={formData.button_url}
              onChange={(e) => {
                let value = e.target.value;
                // Ensure https:// prefix
                if (!value.startsWith('http://') && !value.startsWith('https://')) {
                  value = 'https://' + value.replace(/^https?:\/\//, '');
                }
                setFormData(prev => ({ ...prev, button_url: value }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="https://example.com"
            />
            <p className="text-xs text-gray-500 mt-1">
              The image and last line of the ad will link to this URL
            </p>
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

// Ad Preview Modal Component - Shows how the ad will look in the newsletter
function AdPreviewModal({ ad, onClose }: { ad: Advertisement; onClose: () => void }) {
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Generate the preview HTML
    generatePreview()
  }, [ad])

  const generatePreview = async () => {
    setLoading(true)
    try {
      // Fetch the preview from the API
      const response = await fetch(`/api/ads/${ad.id}/preview`)
      if (response.ok) {
        const data = await response.json()
        setPreviewHtml(data.html)
      } else {
        throw new Error('Failed to generate preview')
      }
    } catch (error) {
      console.error('Preview generation error:', error)
      // Fallback: generate a simple client-side preview
      setPreviewHtml(generateClientSidePreview(ad))
    } finally {
      setLoading(false)
    }
  }

  // Fallback client-side preview generation
  const generateClientSidePreview = (ad: Advertisement): string => {
    const primaryColor = '#1877F2'
    const headingFont = 'Arial, sans-serif'
    const bodyFont = 'Arial, sans-serif'
    const buttonUrl = ad.button_url || '#'

    // Process ad body: make the last sentence a hyperlink
    let processedBody = ad.body || ''
    if (buttonUrl !== '#' && processedBody) {
      const plainText = processedBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      const sentenceEndPattern = /[.!?](?=\s+[A-Z]|$)/g
      const matches = Array.from(plainText.matchAll(sentenceEndPattern))

      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1] as RegExpMatchArray
        const lastPeriodIndex = lastMatch.index!
        let startIndex = 0
        if (matches.length > 1) {
          const secondLastMatch = matches[matches.length - 2] as RegExpMatchArray
          startIndex = secondLastMatch.index! + 1
        }
        const lastSentence = plainText.substring(startIndex, lastPeriodIndex + 1).trim()
        if (lastSentence.length > 5) {
          const escapedSentence = lastSentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const parts = escapedSentence.split(/\s+/)
          const flexiblePattern = parts.join('\\s*(?:<[^>]*>\\s*)*')
          const sentenceRegex = new RegExp(flexiblePattern, 'i')
          processedBody = processedBody.replace(
            sentenceRegex,
            `<a href='${buttonUrl}' style='color: #000; text-decoration: underline; font-weight: bold;'>$&</a>`
          )
        }
      }
    }

    const imageHtml = ad.image_url
      ? `<tr><td style='padding: 0 12px; text-align: center;'><a href='${buttonUrl}'><img src='${ad.image_url}' alt='${ad.title}' style='max-width: 100%; max-height: 500px; border-radius: 4px; display: block; margin: 0 auto;'></a></td></tr>`
      : ''

    return `
      <html>
      <head>
        <style>
          body { margin: 0; padding: 20px; background-color: #f7f7f7; font-family: Arial, sans-serif; }
        </style>
      </head>
      <body>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:750px;margin:0 auto;">
          <tr>
            <td style="padding:0 10px;">
              <table width='100%' cellpadding='0' cellspacing='0' style='border: 1px solid #ddd; border-radius: 10px; background: #fff; font-family: ${bodyFont}; font-size: 16px; line-height: 26px; box-shadow:0 4px 12px rgba(0,0,0,.15); margin-top: 10px; overflow: hidden;'>
                <tr>
                  <td style="padding: 8px; background-color: ${primaryColor}; border-top-left-radius: 10px; border-top-right-radius: 10px;">
                    <h2 style="font-size: 1.625em; line-height: 1.16em; font-family: ${headingFont}; color: #ffffff; margin: 0; padding: 0;">Advertorial</h2>
                  </td>
                </tr>
                <tr><td style='padding: 10px 10px 4px; font-size: 20px; font-weight: bold; text-align: left;'>${ad.title}</td></tr>
                ${imageHtml}
                <tr><td style='padding: 0 10px 10px; font-family: ${bodyFont}; font-size: 16px; line-height: 24px; color: #333;'>${processedBody}</td></tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">Ad Preview - {ad.title}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-gray-100">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : previewHtml ? (
            <iframe
              srcDoc={previewHtml}
              className="w-full h-full min-h-[500px]"
              title="Ad Preview"
              style={{ border: 'none' }}
            />
          ) : (
            <div className="flex justify-center items-center h-64 text-gray-500">
              Failed to generate preview
            </div>
          )}
        </div>
        <div className="flex justify-end p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
