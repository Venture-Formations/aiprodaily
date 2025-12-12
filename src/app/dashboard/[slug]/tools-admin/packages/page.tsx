'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Package,
  DollarSign,
  Newspaper,
  Star,
  ToggleLeft,
  ToggleRight,
  X,
  Save
} from 'lucide-react'
import type { SponsorshipPackage } from '@/types/database'

interface PackageFormData {
  name: string
  description: string
  newsletter_ad_spots: number
  featured_listing_included: boolean
  featured_listing_months: number
  price_monthly: number | null
  price_yearly: number | null
  is_active: boolean
  is_featured: boolean
  display_order: number
}

const emptyFormData: PackageFormData = {
  name: '',
  description: '',
  newsletter_ad_spots: 0,
  featured_listing_included: false,
  featured_listing_months: 0,
  price_monthly: null,
  price_yearly: null,
  is_active: true,
  is_featured: false,
  display_order: 0
}

export default function PackagesAdminPage() {
  const [packages, setPackages] = useState<SponsorshipPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPackage, setEditingPackage] = useState<SponsorshipPackage | null>(null)
  const [formData, setFormData] = useState<PackageFormData>(emptyFormData)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchPackages()
  }, [])

  async function fetchPackages() {
    setLoading(true)
    try {
      const res = await fetch('/api/tools/packages')
      const data = await res.json()
      if (data.success) {
        setPackages(data.packages)
      }
    } catch (error) {
      console.error('Failed to fetch packages:', error)
      setMessage({ type: 'error', text: 'Failed to load packages' })
    }
    setLoading(false)
  }

  function openCreateModal() {
    setEditingPackage(null)
    setFormData(emptyFormData)
    setShowModal(true)
  }

  function openEditModal(pkg: SponsorshipPackage) {
    setEditingPackage(pkg)
    setFormData({
      name: pkg.name,
      description: pkg.description || '',
      newsletter_ad_spots: pkg.newsletter_ad_spots,
      featured_listing_included: pkg.featured_listing_included,
      featured_listing_months: pkg.featured_listing_months,
      price_monthly: pkg.price_monthly,
      price_yearly: pkg.price_yearly,
      is_active: pkg.is_active,
      is_featured: pkg.is_featured,
      display_order: pkg.display_order
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'Package name is required' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const url = editingPackage
        ? `/api/tools/packages/${editingPackage.id}`
        : '/api/tools/packages'

      const res = await fetch(url, {
        method: editingPackage ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await res.json()

      if (data.success) {
        setMessage({ type: 'success', text: editingPackage ? 'Package updated!' : 'Package created!' })
        setShowModal(false)
        fetchPackages()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save package' })
      }
    } catch (error) {
      console.error('Failed to save package:', error)
      setMessage({ type: 'error', text: 'Failed to save package' })
    }

    setSaving(false)
  }

  async function handleDelete(pkg: SponsorshipPackage) {
    if (!confirm(`Are you sure you want to delete "${pkg.name}"?`)) {
      return
    }

    try {
      const res = await fetch(`/api/tools/packages/${pkg.id}`, {
        method: 'DELETE'
      })

      const data = await res.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Package deleted' })
        fetchPackages()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to delete package' })
      }
    } catch (error) {
      console.error('Failed to delete package:', error)
      setMessage({ type: 'error', text: 'Failed to delete package' })
    }
  }

  async function handleToggleActive(pkg: SponsorshipPackage) {
    try {
      const res = await fetch(`/api/tools/packages/${pkg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !pkg.is_active })
      })

      const data = await res.json()

      if (data.success) {
        fetchPackages()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update package' })
      }
    } catch (error) {
      console.error('Failed to toggle package:', error)
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
                Sponsorship Packages
              </h1>
              <p className="text-gray-600">
                Create and manage custom sponsorship packages that bundle newsletter ads with featured listings.
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Package
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

        {/* Packages Grid */}
        {packages.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No packages yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first sponsorship package to start offering bundled deals.
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Package
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`bg-white rounded-lg border-2 ${
                  pkg.is_featured ? 'border-amber-500' : 'border-gray-200'
                } overflow-hidden ${!pkg.is_active ? 'opacity-60' : ''}`}
              >
                {pkg.is_featured && (
                  <div className="bg-amber-500 text-white text-xs font-semibold text-center py-1">
                    Featured Package
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{pkg.name}</h3>
                      {pkg.description && (
                        <p className="text-sm text-gray-500 mt-1">{pkg.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleActive(pkg)}
                      className="text-gray-400 hover:text-gray-600"
                      title={pkg.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {pkg.is_active ? (
                        <ToggleRight className="w-6 h-6 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-6 h-6" />
                      )}
                    </button>
                  </div>

                  {/* Pricing */}
                  <div className="mb-4">
                    {pkg.price_monthly && (
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-gray-900">${pkg.price_monthly}</span>
                        <span className="text-gray-500">/month</span>
                      </div>
                    )}
                    {pkg.price_yearly && (
                      <div className="text-sm text-gray-500">
                        or ${pkg.price_yearly}/year
                      </div>
                    )}
                    {!pkg.price_monthly && !pkg.price_yearly && (
                      <span className="text-gray-500 italic">No pricing set</span>
                    )}
                  </div>

                  {/* Benefits */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Newspaper className="w-4 h-4 text-blue-500" />
                      <span className="text-gray-700">
                        {pkg.newsletter_ad_spots} newsletter ad{pkg.newsletter_ad_spots !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {pkg.featured_listing_included && (
                      <div className="flex items-center gap-2 text-sm">
                        <Star className="w-4 h-4 text-amber-500" />
                        <span className="text-gray-700">
                          Featured listing ({pkg.featured_listing_months} month{pkg.featured_listing_months !== 1 ? 's' : ''})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => openEditModal(pkg)}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(pkg)}
                      className="inline-flex items-center justify-center px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingPackage ? 'Edit Package' : 'Create Package'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Package Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Professional, Enterprise"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    placeholder="Brief description of the package..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Benefits */}
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Included Benefits</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Newsletter Ad Spots
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.newsletter_ad_spots}
                        onChange={(e) => setFormData({ ...formData, newsletter_ad_spots: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Number of ad placements in newsletters</p>
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.featured_listing_included}
                          onChange={(e) => setFormData({
                            ...formData,
                            featured_listing_included: e.target.checked,
                            featured_listing_months: e.target.checked ? (formData.featured_listing_months || 1) : 0
                          })}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Include Featured Listing</span>
                      </label>
                    </div>

                    {formData.featured_listing_included && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Featured Listing Duration (months)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.featured_listing_months}
                          onChange={(e) => setFormData({ ...formData, featured_listing_months: parseInt(e.target.value) || 1 })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Pricing */}
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Pricing</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Monthly Price ($)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          min="0"
                          value={formData.price_monthly ?? ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            price_monthly: e.target.value ? parseFloat(e.target.value) : null
                          })}
                          placeholder="Optional"
                          className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Yearly Price ($)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          min="0"
                          value={formData.price_yearly ?? ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            price_yearly: e.target.value ? parseFloat(e.target.value) : null
                          })}
                          placeholder="Optional"
                          className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Display Options */}
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Display Options</h3>

                  <div className="space-y-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Active (visible to customers)</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.is_featured}
                        onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Featured (highlighted in UI)</span>
                    </label>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Display Order
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.display_order}
                        onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                        className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : (editingPackage ? 'Update Package' : 'Create Package')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
