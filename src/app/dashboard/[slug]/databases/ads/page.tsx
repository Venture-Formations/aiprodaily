'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Layout from '@/components/Layout'
import type { Advertisement, AdModule } from '@/types/database'
import AddAdModal from '@/components/ads-database/AddAdModal'
import EditAdModal from '@/components/ads-database/EditAdModal'
import AdPreviewModal from '@/components/ads-database/AdPreviewModal'

interface AdWithRelations extends Advertisement {
  ad_module?: { id: string; name: string } | null
  advertiser?: { id: string; company_name: string; logo_url?: string } | null
}

interface CompanyGroup {
  id: string
  ad_module_id: string
  advertiser_id: string
  display_order: number
  next_ad_position: number
  times_used: number
  priority: number
  advertiser: { id: string; company_name: string; logo_url?: string; is_active: boolean; last_used_date?: string; times_used: number }
  advertisements: Advertisement[]
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
  // Company-grouped state for active tab
  const [companyGroups, setCompanyGroups] = useState<CompanyGroup[]>([])
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set())
  const [draggedCompany, setDraggedCompany] = useState<number | null>(null)
  const [draggedAdInCompany, setDraggedAdInCompany] = useState<{ companyId: string; index: number } | null>(null)
  const [moduleNextPosition, setModuleNextPosition] = useState<number>(1)
  const [moduleSelectionMode, setModuleSelectionMode] = useState<string>('sequential')

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
    if (activeStatusTab === 'active' && selectedSection) {
      fetchCompanyGroups()
    } else if (selectedSection) {
      fetchAds()
    }
  }, [activeStatusTab, selectedSection])

  const fetchCompanyGroups = async () => {
    if (!selectedSection) return
    setLoading(true)
    try {
      const response = await fetch(`/api/ad-modules/${selectedSection}/companies`)
      if (response.ok) {
        const data = await response.json()
        setCompanyGroups(data.companies || [])
        setModuleNextPosition(data.module?.next_position || 1)
        setModuleSelectionMode(data.module?.selection_mode || 'sequential')
      }
    } catch (error) {
      console.error('Failed to fetch company groups:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAds = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()

      if (activeStatusTab === 'inactive') {
        params.set('status', 'rejected,completed,approved')
      } else if (activeStatusTab === 'review') {
        params.set('status', 'pending_review')
      }

      // Add section filter
      params.set('ad_module_id', selectedSection)

      const response = await fetch(`/api/ads?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setAds(data.ads || [])
      }
    } catch (error) {
      console.error('Failed to fetch ads:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleCompanyExpanded = (companyId: string) => {
    setExpandedCompanies(prev => {
      const next = new Set(prev)
      if (next.has(companyId)) {
        next.delete(companyId)
      } else {
        next.add(companyId)
      }
      return next
    })
  }

  // Company drag-drop handlers
  const handleCompanyDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedCompany(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleCompanyDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleCompanyDrop = async (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault()
    if (draggedCompany === null || draggedCompany === dropIndex) {
      setDraggedCompany(null)
      return
    }

    const newGroups = [...companyGroups]
    const [removed] = newGroups.splice(draggedCompany, 1)
    newGroups.splice(dropIndex, 0, removed)

    // Build reorder payload
    const order = newGroups.map((g, i) => ({
      advertiser_id: g.advertiser_id,
      display_order: i + 1
    }))

    setCompanyGroups(newGroups)
    setDraggedCompany(null)

    try {
      const response = await fetch(`/api/ad-modules/${selectedSection}/companies/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
      })
      if (!response.ok) throw new Error('Failed to reorder')
      await fetchCompanyGroups()
    } catch (error) {
      console.error('Company reorder error:', error)
      await fetchCompanyGroups()
    }
  }

  // Ad-within-company drag-drop handlers
  const handleAdDragStart = (e: React.DragEvent<HTMLDivElement>, companyId: string, index: number) => {
    e.stopPropagation()
    setDraggedAdInCompany({ companyId, index })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleAdDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleAdDrop = async (e: React.DragEvent<HTMLDivElement>, companyId: string, dropIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (!draggedAdInCompany || draggedAdInCompany.companyId !== companyId || draggedAdInCompany.index === dropIndex) {
      setDraggedAdInCompany(null)
      return
    }

    const company = companyGroups.find(g => g.advertiser_id === companyId)
    if (!company) return

    const newAds = [...company.advertisements]
    const [removed] = newAds.splice(draggedAdInCompany.index, 1)
    newAds.splice(dropIndex, 0, removed)

    const order = newAds.map((ad, i) => ({
      id: ad.id,
      display_order: i + 1
    }))

    // Optimistic update
    setCompanyGroups(prev => prev.map(g =>
      g.advertiser_id === companyId ? { ...g, advertisements: newAds } : g
    ))
    setDraggedAdInCompany(null)

    try {
      const response = await fetch(`/api/ad-modules/${selectedSection}/companies/${companyId}/ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
      })
      if (!response.ok) throw new Error('Failed to reorder ads')
      await fetchCompanyGroups()
    } catch (error) {
      console.error('Ad reorder error:', error)
      await fetchCompanyGroups()
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
        if (activeStatusTab === 'active') {
          fetchCompanyGroups()
        } else {
          fetchAds()
        }
      } else {
        throw new Error('Failed to delete ad')
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete ad')
    }
  }

  const handleExtendWeeks = async (adId: string) => {
    const weeks = prompt('How many weeks to add?', '4')
    if (!weeks) return
    const weeksNum = parseInt(weeks)
    if (isNaN(weeksNum) || weeksNum <= 0) {
      alert('Please enter a valid number of weeks')
      return
    }

    try {
      const response = await fetch(`/api/ads/${adId}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeks: weeksNum })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Added ${weeksNum} weeks! New total: ${data.new_times_paid} weeks${data.reactivated ? ' (Ad reactivated)' : ''}`)
        fetchAds()
      } else {
        throw new Error('Failed to extend weeks')
      }
    } catch (error) {
      console.error('Extend error:', error)
      alert('Failed to extend weeks')
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

        {/* Selection Mode Info - Company Rotation */}
        {activeStatusTab === 'active' && !loading && companyGroups.length > 0 && (() => {
          const modeLabels: Record<string, { label: string; description: string }> = {
            sequential: { label: 'Sequential', description: 'Companies rotate in order by position' },
            random: { label: 'Random', description: 'A random company is selected each time' },
            priority: { label: 'Priority', description: 'Highest priority company is selected first' },
            manual: { label: 'Manual', description: 'Admin selects ad manually per issue' }
          }
          const modeInfo = modeLabels[moduleSelectionMode] || modeLabels.sequential
          const nextCompany = moduleSelectionMode === 'sequential'
            ? companyGroups.find(g => g.display_order === moduleNextPosition) || companyGroups[0]
            : null
          const nextAd = nextCompany
            ? nextCompany.advertisements.find(ad => ad.display_order === nextCompany.next_ad_position) || nextCompany.advertisements[0]
            : null
          return (
            <div className={`mb-4 border rounded-lg p-4 ${moduleSelectionMode === 'sequential' ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${moduleSelectionMode === 'sequential' ? 'text-purple-800' : 'text-blue-800'}`}>
                    <strong>Selection Mode:</strong> {modeInfo.label}
                    <span className={`ml-2 ${moduleSelectionMode === 'sequential' ? 'text-purple-600' : 'text-blue-600'}`}>— {modeInfo.description}</span>
                  </p>
                  {moduleSelectionMode === 'sequential' && nextCompany && (
                    <p className="text-sm text-purple-800 mt-1">
                      <strong>Next company:</strong> Position {moduleNextPosition} — <span className="text-purple-600">{nextCompany.advertiser.company_name}</span>
                      {nextAd && (
                        <span className="ml-2 text-purple-600">| Next ad: {nextAd.title}</span>
                      )}
                    </p>
                  )}
                </div>
                {moduleSelectionMode === 'sequential' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if (confirm('Reset company rotation to position 1?')) {
                          const res = await fetch(`/api/ad-modules/${selectedSection}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ next_position: 1 })
                          })
                          if (res.ok) {
                            fetchCompanyGroups()
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
                      max={companyGroups.length}
                      value={moduleNextPosition}
                      onChange={async (e) => {
                        const newPos = parseInt(e.target.value) || 1
                        const res = await fetch(`/api/ad-modules/${selectedSection}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ next_position: newPos })
                        })
                        if (res.ok) {
                          fetchCompanyGroups()
                          fetchAdModules()
                        }
                      }}
                      className="w-16 px-2 py-1 border border-purple-300 rounded text-center text-sm"
                      title="Set next company position"
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

        {/* Active Ads - Company Grouped View */}
        {!loading && activeStatusTab === 'active' && (
          <div className="space-y-3">
            {companyGroups.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <p className="text-gray-500">No active advertisements found.</p>
              </div>
            ) : (
              companyGroups.map((company, companyIndex) => {
                const isNextCompany = moduleSelectionMode === 'sequential' && company.display_order === moduleNextPosition
                const isExpanded = expandedCompanies.has(company.advertiser_id)

                return (
                  <div
                    key={company.advertiser_id}
                    draggable
                    onDragStart={(e) => handleCompanyDragStart(e, companyIndex)}
                    onDragOver={handleCompanyDragOver}
                    onDrop={(e) => handleCompanyDrop(e, companyIndex)}
                    className={`bg-white rounded-lg shadow transition-shadow ${
                      isNextCompany ? 'ring-2 ring-purple-400' : ''
                    }`}
                  >
                    {/* Company Header */}
                    <div
                      className={`flex items-center gap-3 p-4 cursor-pointer select-none ${
                        isNextCompany ? 'bg-purple-50' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => toggleCompanyExpanded(company.advertiser_id)}
                    >
                      <span className="text-lg text-gray-400 cursor-move" title="Drag to reorder">☰</span>
                      <span className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded font-bold text-gray-600 text-sm">
                        {companyIndex + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {company.advertiser.company_name}
                          </h3>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {company.advertisements.length} {company.advertisements.length === 1 ? 'ad' : 'ads'}
                          </span>
                          {isNextCompany && (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-200 text-purple-800">
                              NEXT COMPANY
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Used {company.advertisements.reduce((sum: number, a: any) => sum + (a.times_used || 0), 0)}x
                          {company.advertiser.last_used_date && (
                            <span> | Last: {new Date(company.advertiser.last_used_date).toLocaleDateString()}</span>
                          )}
                        </p>
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {/* Expanded: Ads within company */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 pb-4">
                        {/* Internal ad rotation position control */}
                        {company.advertisements.length > 1 && (
                          <div className="flex items-center gap-2 py-2 text-xs text-gray-500">
                            <span>Next ad position:</span>
                            <input
                              type="number"
                              min="1"
                              max={company.advertisements.length}
                              value={company.next_ad_position}
                              onClick={(e) => e.stopPropagation()}
                              onChange={async (e) => {
                                const newPos = parseInt(e.target.value) || 1
                                await fetch(`/api/ad-modules/${selectedSection}/companies/${company.advertiser_id}/next-position`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ next_ad_position: newPos })
                                })
                                fetchCompanyGroups()
                              }}
                              className="w-12 px-1 py-0.5 border border-gray-200 rounded text-center text-xs"
                            />
                          </div>
                        )}

                        <div className="space-y-2 mt-1">
                          {company.advertisements.map((ad, adIndex) => {
                            const isNextAd = ad.display_order === company.next_ad_position
                            return (
                              <div
                                key={ad.id}
                                draggable
                                onDragStart={(e) => handleAdDragStart(e, company.advertiser_id, adIndex)}
                                onDragOver={handleAdDragOver}
                                onDrop={(e) => handleAdDrop(e, company.advertiser_id, adIndex)}
                                className={`rounded-lg border p-3 cursor-move hover:shadow transition-shadow ${
                                  isNextAd ? 'border-purple-300 bg-purple-50/50' : 'border-gray-200'
                                }`}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <span className="text-sm text-gray-400">☰</span>
                                    <span className="w-6 h-6 flex items-center justify-center bg-gray-50 rounded text-xs font-medium text-gray-500">
                                      {adIndex + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <h4 className="font-medium text-gray-900 truncate">{ad.title}</h4>
                                        {isNextAd && (
                                          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-purple-100 text-purple-700 flex-shrink-0">
                                            NEXT AD
                                          </span>
                                        )}
                                        {ad.paid && ad.frequency === 'weekly' && ad.times_paid > 0 && (() => {
                                          const remaining = Math.max(0, ad.times_paid - (ad.times_used || 0))
                                          return remaining <= 2 ? (
                                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-100 text-amber-700 flex-shrink-0">
                                              {remaining === 0 ? 'EXHAUSTED' : `${remaining}wk left`}
                                            </span>
                                          ) : null
                                        })()}
                                      </div>
                                      <p className="text-xs text-gray-500 truncate">
                                        {ad.times_used}x used
                                        {ad.last_used_date && ` | Last: ${new Date(ad.last_used_date).toLocaleDateString()}`}
                                        {ad.paid && ad.frequency === 'weekly' && ad.times_paid > 0 && (
                                          <span> | {Math.max(0, ad.times_paid - (ad.times_used || 0))}/{ad.times_paid} wks</span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex gap-1 flex-shrink-0 ml-2">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setPreviewingAd(ad as AdWithRelations) }}
                                      className="bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 text-xs"
                                    >
                                      Preview
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setEditingAd(ad as AdWithRelations) }}
                                      className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 text-xs"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDelete(ad.id) }}
                                      className="bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700 text-xs"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
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

                  <div className="grid grid-cols-4 gap-4 pt-4 border-t text-sm">
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
                    <div>
                      <span className="font-medium">Analytics:</span>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/ads/${ad.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate"
                        >
                          View Analytics
                        </a>
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/ads/${ad.id}`
                            navigator.clipboard.writeText(url)
                            alert('Analytics URL copied!')
                          }}
                          className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Copy analytics URL"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                          </svg>
                        </button>
                      </div>
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

                  <div className="grid grid-cols-4 gap-4 pt-4 border-t text-sm">
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
                    <div>
                      <span className="font-medium">Analytics:</span>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/ads/${ad.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate"
                        >
                          View Analytics
                        </a>
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/ads/${ad.id}`
                            navigator.clipboard.writeText(url)
                            alert('Analytics URL copied!')
                          }}
                          className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Copy analytics URL"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                          </svg>
                        </button>
                      </div>
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
              if (activeStatusTab === 'active') {
                fetchCompanyGroups()
              } else {
                fetchAds()
              }
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
              if (activeStatusTab === 'active') {
                fetchCompanyGroups()
              } else {
                fetchAds()
              }
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