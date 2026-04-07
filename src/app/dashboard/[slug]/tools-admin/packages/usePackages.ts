'use client'

import { useState, useEffect } from 'react'
import type { SponsorshipPackage } from '@/types/database'

export interface PackageFormData {
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

export const emptyFormData: PackageFormData = {
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

export function usePackages() {
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

  return {
    packages,
    loading,
    showModal,
    setShowModal,
    editingPackage,
    formData,
    setFormData,
    saving,
    message,
    openCreateModal,
    openEditModal,
    handleSave,
    handleDelete,
    handleToggleActive,
  }
}
