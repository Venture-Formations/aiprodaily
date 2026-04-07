'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { AdWithRelations, CompanyGroup, StatusTab, AdModule } from './types'

export function useAdsDatabase() {
  const pathname = usePathname()
  const [activeStatusTab, setActiveStatusTab] = useState<StatusTab>('active')
  const [ads, setAds] = useState<AdWithRelations[]>([])
  const [adModules, setAdModules] = useState<AdModule[]>([])
  const [selectedSection, setSelectedSection] = useState<string>('') // ad_module_id
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingAd, setEditingAd] = useState<AdWithRelations | null>(null)
  const [previewingAd, setPreviewingAd] = useState<AdWithRelations | null>(null)
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
    if (!selectedSection || !publicationId) return
    setLoading(true)
    try {
      const response = await fetch(`/api/ad-modules/${selectedSection}/companies?publication_id=${publicationId}`)
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

      if (publicationId) {
        params.set('publication_id', publicationId)
      }

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

  const handleResetPosition = async () => {
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
  }

  const handleSetPosition = async (newPos: number) => {
    const res = await fetch(`/api/ad-modules/${selectedSection}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ next_position: newPos })
    })
    if (res.ok) {
      fetchCompanyGroups()
      fetchAdModules()
    }
  }

  const handleSetNextAdPosition = async (companyAdvertiserId: string, newPos: number) => {
    await fetch(`/api/ad-modules/${selectedSection}/companies/${companyAdvertiserId}/next-position`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ next_ad_position: newPos })
    })
    fetchCompanyGroups()
  }

  return {
    // State
    activeStatusTab,
    ads,
    adModules,
    selectedSection,
    loading,
    showAddModal,
    editingAd,
    previewingAd,
    publicationId,
    companyGroups,
    expandedCompanies,
    moduleNextPosition,
    moduleSelectionMode,

    // Setters
    setActiveStatusTab,
    setSelectedSection,
    setShowAddModal,
    setEditingAd,
    setPreviewingAd,

    // Handlers
    toggleCompanyExpanded,
    handleCompanyDragStart,
    handleCompanyDragOver,
    handleCompanyDrop,
    handleAdDragStart,
    handleAdDragOver,
    handleAdDrop,
    handleApprove,
    handleReject,
    handleActivate,
    handleDelete,
    handleExtendWeeks,
    handleResetPosition,
    handleSetPosition,
    handleSetNextAdPosition,

    // Refetch
    fetchCompanyGroups,
    fetchAds,
  }
}
