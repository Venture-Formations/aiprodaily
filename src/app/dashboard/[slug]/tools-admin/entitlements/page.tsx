'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  Search,
  Newspaper,
  Star,
  Calendar,
  User,
  MoreVertical,
  Gift,
  X,
  Save,
  RefreshCw
} from 'lucide-react'
import type { CustomerEntitlement, SponsorshipPackage, EntitlementType, EntitlementStatus } from '@/types/database'

interface EntitlementWithCustomer extends CustomerEntitlement {
  customer_email?: string
  customer_name?: string
  quantity_remaining: number
}

interface GrantFormData {
  clerk_user_id: string
  customer_email: string
  entitlement_type: EntitlementType
  quantity_total: number
  valid_months: number | null // null = no expiration
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

export default function EntitlementsAdminPage() {
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

  // Filter entitlements
  const filteredEntitlements = entitlements.filter(e => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesEmail = e.customer_email?.toLowerCase().includes(query)
      const matchesName = e.customer_name?.toLowerCase().includes(query)
      const matchesId = e.clerk_user_id.toLowerCase().includes(query)
      if (!matchesEmail && !matchesName && !matchesId) return false
    }

    // Type filter
    if (filterType !== 'all' && e.entitlement_type !== filterType) return false

    // Status filter
    if (filterStatus !== 'all' && e.status !== filterStatus) return false

    return true
  })

  const getStatusColor = (status: EntitlementStatus) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'expired': return 'bg-gray-100 text-gray-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="../tools-admin"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Tools Admin
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Customer Entitlements
              </h1>
              <p className="text-gray-600">
                View and manage customer entitlements for newsletter ads and featured listings.
              </p>
            </div>
            <button
              onClick={() => setShowGrantModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Gift className="w-4 h-4 mr-2" />
              Grant Entitlement
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by email, name, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as typeof filterType)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="newsletter_ad">Newsletter Ads</option>
              <option value="featured_listing">Featured Listings</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
              <option value="paused">Paused</option>
            </select>

            {/* Refresh */}
            <button
              onClick={fetchData}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Entitlements Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {filteredEntitlements.length === 0 ? (
            <div className="p-12 text-center">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No entitlements found</h3>
              <p className="text-gray-500">
                {searchQuery || filterType !== 'all' || filterStatus !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Grant entitlements to customers to get started'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valid Until
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEntitlements.map((entitlement) => (
                    <tr key={entitlement.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {entitlement.customer_name || entitlement.clerk_user_id}
                          </div>
                          {entitlement.customer_email && (
                            <div className="text-sm text-gray-500">
                              {entitlement.customer_email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {entitlement.entitlement_type === 'newsletter_ad' ? (
                            <Newspaper className="w-4 h-4 text-blue-500" />
                          ) : (
                            <Star className="w-4 h-4 text-amber-500" />
                          )}
                          <span className="text-sm text-gray-900">
                            {entitlement.entitlement_type === 'newsletter_ad'
                              ? 'Newsletter Ad'
                              : 'Featured Listing'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {entitlement.quantity_used} / {entitlement.quantity_total} used
                        </div>
                        <div className="w-24 h-2 bg-gray-200 rounded-full mt-1">
                          <div
                            className="h-2 bg-blue-500 rounded-full"
                            style={{
                              width: `${Math.min(100, (entitlement.quantity_used / entitlement.quantity_total) * 100)}%`
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {entitlement.valid_until ? (
                          <div className="flex items-center gap-1 text-sm text-gray-900">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {new Date(entitlement.valid_until).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">No expiration</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(entitlement.status)}`}>
                          {entitlement.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {entitlement.package_id ? (
                          <span className="text-blue-600">Package</span>
                        ) : (
                          <span className="text-gray-500">Manual</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleUpdateStatus(entitlement.id, e.target.value as EntitlementStatus)
                            }
                          }}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="">Actions...</option>
                          {entitlement.status !== 'active' && (
                            <option value="active">Activate</option>
                          )}
                          {entitlement.status === 'active' && (
                            <option value="paused">Pause</option>
                          )}
                          {entitlement.status !== 'cancelled' && (
                            <option value="cancelled">Cancel</option>
                          )}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Total Active</div>
            <div className="text-2xl font-bold text-gray-900">
              {entitlements.filter(e => e.status === 'active').length}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Newsletter Ads</div>
            <div className="text-2xl font-bold text-blue-600">
              {entitlements.filter(e => e.entitlement_type === 'newsletter_ad' && e.status === 'active')
                .reduce((sum, e) => sum + (e.quantity_total - e.quantity_used), 0)} remaining
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Featured Listings</div>
            <div className="text-2xl font-bold text-amber-600">
              {entitlements.filter(e => e.entitlement_type === 'featured_listing' && e.status === 'active').length} active
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Expiring Soon</div>
            <div className="text-2xl font-bold text-red-600">
              {entitlements.filter(e => {
                if (e.status !== 'active' || !e.valid_until) return false
                const daysLeft = Math.ceil((new Date(e.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                return daysLeft <= 30 && daysLeft > 0
              }).length}
            </div>
          </div>
        </div>

        {/* Grant Entitlement Modal */}
        {showGrantModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowGrantModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
              <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Grant Entitlement</h2>
                <button
                  onClick={() => setShowGrantModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Email *
                  </label>
                  <input
                    type="email"
                    value={grantForm.customer_email}
                    onChange={(e) => setGrantForm({ ...grantForm, customer_email: e.target.value })}
                    placeholder="customer@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Clerk User ID (if known)
                  </label>
                  <input
                    type="text"
                    value={grantForm.clerk_user_id}
                    onChange={(e) => setGrantForm({ ...grantForm, clerk_user_id: e.target.value })}
                    placeholder="user_..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entitlement Type *
                  </label>
                  <select
                    value={grantForm.entitlement_type}
                    onChange={(e) => setGrantForm({ ...grantForm, entitlement_type: e.target.value as EntitlementType })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="newsletter_ad">Newsletter Ad Spots</option>
                    <option value="featured_listing">Featured Listing</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={grantForm.quantity_total}
                    onChange={(e) => setGrantForm({ ...grantForm, quantity_total: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid For
                  </label>
                  <select
                    value={grantForm.valid_months ?? ''}
                    onChange={(e) => setGrantForm({
                      ...grantForm,
                      valid_months: e.target.value ? parseInt(e.target.value) : null
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No expiration</option>
                    <option value="1">1 month</option>
                    <option value="3">3 months</option>
                    <option value="6">6 months</option>
                    <option value="12">12 months</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (internal)
                  </label>
                  <textarea
                    value={grantForm.notes}
                    onChange={(e) => setGrantForm({ ...grantForm, notes: e.target.value })}
                    rows={2}
                    placeholder="Reason for granting, promo code, etc."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowGrantModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGrantEntitlement}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Gift className="w-4 h-4 mr-2" />
                  {saving ? 'Granting...' : 'Grant Entitlement'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
