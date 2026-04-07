'use client'

import { useState, useEffect, useMemo } from 'react'
import type { CustomerEntitlement, SponsorshipPackage, EntitlementType, EntitlementStatus } from '@/types/database'

export interface EntitlementWithCustomer extends CustomerEntitlement {
  customer_email?: string
  customer_name?: string
  quantity_remaining: number
}

export interface GrantFormData {
  clerk_user_id: string
  customer_email: string
  entitlement_type: EntitlementType
  quantity_total: number
  valid_months: number | null
  notes: string
}

const emptyGrantForm: GrantFormData = {
  clerk_user_id: '',
  customer_email: '',
  entitlement_type: 'newsletter_ad',
  quantity_total: 1,
  valid_months: null,
  notes: ''
}

export function useEntitlements() {
  const [entitlements, setEntitlements] = useState<EntitlementWithCustomer[]>([])
  const [packages, setPackages] = useState<SponsorshipPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [showGrantModal, setShowGrantModal] = useState(false)
  const [grantForm, setGrantForm] = useState<GrantFormData>(emptyGrantForm)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | EntitlementType>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | EntitlementStatus>('all')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [entitlementsRes, packagesRes] = await Promise.all([
        fetch('/api/tools/entitlements'),
        fetch('/api/tools/packages')
      ])

      const entitlementsData = await entitlementsRes.json()
      const packagesData = await packagesRes.json()

      if (entitlementsData.success) {
        setEntitlements(entitlementsData.entitlements)
      }
      if (packagesData.success) {
        setPackages(packagesData.packages)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
      setMessage({ type: 'error', text: 'Failed to load data' })
    }
    setLoading(false)
  }

  async function handleGrantEntitlement() {
    if (!grantForm.clerk_user_id.trim() && !grantForm.customer_email.trim()) {
      setMessage({ type: 'error', text: 'Customer ID or email is required' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/tools/entitlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...grantForm,
          valid_until: grantForm.valid_months
            ? new Date(Date.now() + grantForm.valid_months * 30 * 24 * 60 * 60 * 1000).toISOString()
            : null
        })
      })

      const data = await res.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Entitlement granted successfully!' })
        setShowGrantModal(false)
        setGrantForm(emptyGrantForm)
        fetchData()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to grant entitlement' })
      }
    } catch (error) {
      console.error('Failed to grant entitlement:', error)
      setMessage({ type: 'error', text: 'Failed to grant entitlement' })
    }

    setSaving(false)
  }

  async function handleUpdateStatus(entitlementId: string, newStatus: EntitlementStatus) {
    try {
      const res = await fetch(`/api/tools/entitlements/${entitlementId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      const data = await res.json()

      if (data.success) {
        fetchData()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update entitlement' })
      }
    } catch (error) {
      console.error('Failed to update entitlement:', error)
    }
  }

  const filteredEntitlements = useMemo(() => entitlements.filter(e => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesEmail = e.customer_email?.toLowerCase().includes(query)
      const matchesName = e.customer_name?.toLowerCase().includes(query)
      const matchesId = e.clerk_user_id.toLowerCase().includes(query)
      if (!matchesEmail && !matchesName && !matchesId) return false
    }
    if (filterType !== 'all' && e.entitlement_type !== filterType) return false
    if (filterStatus !== 'all' && e.status !== filterStatus) return false
    return true
  }), [entitlements, searchQuery, filterType, filterStatus])

  const stats = useMemo(() => ({
    totalActive: entitlements.filter(e => e.status === 'active').length,
    newsletterAdsRemaining: entitlements
      .filter(e => e.entitlement_type === 'newsletter_ad' && e.status === 'active')
      .reduce((sum, e) => sum + (e.quantity_total - e.quantity_used), 0),
    featuredListingsActive: entitlements
      .filter(e => e.entitlement_type === 'featured_listing' && e.status === 'active').length,
    expiringSoon: entitlements.filter(e => {
      if (e.status !== 'active' || !e.valid_until) return false
      const daysLeft = Math.ceil((new Date(e.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      return daysLeft <= 30 && daysLeft > 0
    }).length,
  }), [entitlements])

  return {
    entitlements,
    filteredEntitlements,
    packages,
    loading,
    showGrantModal,
    setShowGrantModal,
    grantForm,
    setGrantForm,
    saving,
    message,
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    filterStatus,
    setFilterStatus,
    fetchData,
    handleGrantEntitlement,
    handleUpdateStatus,
    stats,
  }
}

export function getStatusColor(status: EntitlementStatus) {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800'
    case 'expired': return 'bg-gray-100 text-gray-800'
    case 'cancelled': return 'bg-red-100 text-red-800'
    case 'paused': return 'bg-yellow-100 text-yellow-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}
