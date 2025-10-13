'use client'

import { useEffect, useState, useMemo } from 'react'
import Layout from '@/components/Layout'
import Link from 'next/link'
import { VrboListing } from '@/types/database'
import CsvUploadSummary from '@/components/CsvUploadSummary'

type SortField = 'title' | 'city' | 'listing_type' | 'bedrooms' | 'bathrooms' | 'sleeps' | 'created_at'
type SortDirection = 'asc' | 'desc'

interface VrboFilter {
  search: string
  listing_type: 'all' | 'Local' | 'Greater'
  active: 'all' | 'true' | 'false'
}

interface ColumnConfig {
  key: keyof VrboListing
  label: string
  visible: boolean
  sortable: boolean
}

export default function VrboDatabasePage() {
  const [listings, setListings] = useState<VrboListing[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [filter, setFilter] = useState<VrboFilter>({
    search: '',
    listing_type: 'all',
    active: 'all'
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const [showCsvUpload, setShowCsvUpload] = useState(false)
  const [csvUploadResult, setCsvUploadResult] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [editingListing, setEditingListing] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<VrboListing>>({})
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [columns, setColumns] = useState<ColumnConfig[]>([
    { key: 'title', label: 'Title', visible: true, sortable: true },
    { key: 'city', label: 'City', visible: true, sortable: true },
    { key: 'listing_type', label: 'Type', visible: true, sortable: true },
    { key: 'bedrooms', label: 'BR', visible: true, sortable: true },
    { key: 'bathrooms', label: 'BA', visible: true, sortable: true },
    { key: 'sleeps', label: 'Sleeps', visible: true, sortable: true },
    { key: 'adjusted_image_url', label: 'Image', visible: true, sortable: false },
    { key: 'is_active', label: 'Active', visible: true, sortable: true },
    { key: 'created_at', label: 'Created', visible: false, sortable: true }
  ])

  useEffect(() => {
    fetchListings()
  }, [])

  const fetchListings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/vrbo/listings')
      if (response.ok) {
        const data = await response.json()
        setListings(data.listings || [])
      } else {
        console.error('Failed to fetch listings')
      }
    } catch (error) {
      console.error('Error fetching listings:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredAndSortedListings = useMemo(() => {
    let filtered = listings.filter(listing => {
      const matchesSearch = !filter.search ||
        listing.title.toLowerCase().includes(filter.search.toLowerCase()) ||
        listing.city?.toLowerCase().includes(filter.search.toLowerCase())

      const matchesType = filter.listing_type === 'all' || listing.listing_type === filter.listing_type
      const matchesActive = filter.active === 'all' ||
        (filter.active === 'true') === listing.is_active

      return matchesSearch && matchesType && matchesActive
    })

    return filtered.sort((a, b) => {
      let aVal = a[sortField as keyof VrboListing]
      let bVal = b[sortField as keyof VrboListing]

      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return sortDirection === 'asc' ? 1 : -1
      if (bVal == null) return sortDirection === 'asc' ? -1 : 1

      // Convert to strings for comparison
      aVal = String(aVal)
      bVal = String(bVal)

      const result = aVal.localeCompare(bVal, undefined, { numeric: true })
      return sortDirection === 'asc' ? result : -result
    })
  }, [listings, filter, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleEdit = (listing: VrboListing) => {
    setEditingListing(listing.id)
    setEditData({
      title: listing.title,
      city: listing.city,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      sleeps: listing.sleeps,
      listing_type: listing.listing_type,
      is_active: listing.is_active,
      link: listing.link
    })
  }

  const handleSaveEdit = async () => {
    if (!editingListing) return

    try {
      setUpdating(true)
      const response = await fetch(`/api/vrbo/listings/${editingListing}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      })

      if (response.ok) {
        await fetchListings()
        setEditingListing(null)
        setEditData({})
      } else {
        console.error('Failed to update listing')
      }
    } catch (error) {
      console.error('Error updating listing:', error)
    } finally {
      setUpdating(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingListing(null)
    setEditData({})
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this listing?')) return

    try {
      setDeleting(id)
      const response = await fetch(`/api/vrbo/listings/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchListings()
      } else {
        console.error('Failed to delete listing')
      }
    } catch (error) {
      console.error('Error deleting listing:', error)
    } finally {
      setDeleting(null)
    }
  }

  const toggleColumn = (key: keyof VrboListing) => {
    setColumns(prev => prev.map(col =>
      col.key === key ? { ...col, visible: !col.visible } : col
    ))
  }

  const visibleColumns = columns.filter(col => col.visible)

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        {/* Header */}
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              VRBO Listings
            </h1>
            <p className="text-gray-600">
              Manage Minnesota Getaways properties for newsletter campaigns.
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowCsvUpload(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Upload CSV
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-brand-primary hover:bg-brand-dark text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Add Listing
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-brand-primary">{listings.length}</div>
            <div className="text-sm text-gray-600">Total Listings</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600">
              {listings.filter(l => l.listing_type === 'Local').length}
            </div>
            <div className="text-sm text-gray-600">Local Properties</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600">
              {listings.filter(l => l.listing_type === 'Greater').length}
            </div>
            <div className="text-sm text-gray-600">Greater MN</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-gray-600">
              {listings.filter(l => l.is_active).length}
            </div>
            <div className="text-sm text-gray-600">Active Listings</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={filter.search}
                onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
                placeholder="Search title or city..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={filter.listing_type}
                onChange={(e) => setFilter(prev => ({ ...prev, listing_type: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">All Types</option>
                <option value="Local">Local</option>
                <option value="Greater">Greater</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filter.active}
                onChange={(e) => setFilter(prev => ({ ...prev, active: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilter({ search: '', listing_type: 'all', active: 'all' })}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-gray-600">
            Showing {filteredAndSortedListings.length} of {listings.length} listings
          </div>
        </div>

        {/* Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {visibleColumns.map((column) => (
                    <th
                      key={column.key}
                      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                        column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                      }`}
                      onClick={() => column.sortable && handleSort(column.key as SortField)}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{column.label}</span>
                        {column.sortable && sortField === column.key && (
                          <span className="text-brand-primary">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedListings.map((listing) => (
                  <tr key={listing.id} className="hover:bg-gray-50">
                    {visibleColumns.map((column) => (
                      <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm">
                        {editingListing === listing.id ? (
                          // Edit mode
                          <EditCell
                            column={column}
                            value={editData[column.key]}
                            onChange={(value) => setEditData(prev => ({ ...prev, [column.key]: value }))}
                          />
                        ) : (
                          // Display mode
                          <DisplayCell column={column} listing={listing} />
                        )}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {editingListing === listing.id ? (
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={handleSaveEdit}
                            disabled={updating}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                          >
                            {updating ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(listing)}
                            className="text-brand-primary hover:text-brand-dark"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(listing.id)}
                            disabled={deleting === listing.id}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
                          >
                            {deleting === listing.id ? '...' : 'Delete'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAndSortedListings.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500 text-sm">
                {listings.length === 0 ? 'No listings found. Add your first listing above.' : 'No listings match your current filters.'}
              </div>
            </div>
          )}
        </div>

        {/* Add Form Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Add New VRBO Listing</h3>
                <AddListingForm onClose={() => setShowAddForm(false)} onSuccess={fetchListings} />
              </div>
            </div>
          </div>
        )}

        {/* CSV Upload Modal */}
        {showCsvUpload && !csvUploadResult && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Upload VRBO CSV</h3>
                <CsvUploadForm
                  onClose={() => setShowCsvUpload(false)}
                  onSuccess={(result) => {
                    setCsvUploadResult(result)
                    fetchListings()
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* CSV Upload Summary */}
        {csvUploadResult && (
          <CsvUploadSummary
            result={csvUploadResult}
            uploadType="VRBO Listings"
            onClose={() => {
              setCsvUploadResult(null)
              setShowCsvUpload(false)
            }}
          />
        )}
      </div>
    </Layout>
  )
}

// Component for displaying cell values
function DisplayCell({ column, listing }: { column: ColumnConfig; listing: VrboListing }) {
  const value = listing[column.key]

  switch (column.key) {
    case 'adjusted_image_url':
      return value ? (
        <img src={value as string} alt="Property" className="w-16 h-10 object-cover rounded" />
      ) : (
        <div className="w-16 h-10 bg-gray-200 rounded flex items-center justify-center">
          <span className="text-xs text-gray-500">No image</span>
        </div>
      )
    case 'is_active':
      return (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {value ? 'Active' : 'Inactive'}
        </span>
      )
    case 'listing_type':
      return (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          value === 'Local' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
        }`}>
          {value}
        </span>
      )
    case 'title':
      return (
        <div className="max-w-xs">
          <div className="truncate font-medium text-gray-900" title={value as string}>
            {value}
          </div>
          {listing.link && (
            <a
              href={listing.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-primary hover:underline"
            >
              View listing →
            </a>
          )}
        </div>
      )
    default:
      return <span className="text-gray-900">{value?.toString() || '—'}</span>
  }
}

// Component for editing cell values
function EditCell({
  column,
  value,
  onChange
}: {
  column: ColumnConfig;
  value: any;
  onChange: (value: any) => void
}) {
  switch (column.key) {
    case 'listing_type':
      return (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        >
          <option value="Local">Local</option>
          <option value="Greater">Greater</option>
        </select>
      )
    case 'is_active':
      return (
        <input
          type="checkbox"
          checked={value || false}
          onChange={(e) => onChange(e.target.checked)}
          className="rounded border-gray-300"
        />
      )
    case 'bedrooms':
    case 'sleeps':
      return (
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(parseInt(e.target.value) || null)}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          min="0"
        />
      )
    case 'bathrooms':
      return (
        <input
          type="number"
          step="0.5"
          value={value || ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || null)}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          min="0"
        />
      )
    default:
      return (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
      )
  }
}

// Add Listing Form Component
function AddListingForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    title: '',
    city: '',
    bedrooms: '',
    bathrooms: '',
    sleeps: '',
    link: '',
    non_tracked_link: '',
    listing_type: 'Local' as 'Local' | 'Greater',
    main_image_url: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/vrbo/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : null,
          bathrooms: formData.bathrooms ? parseFloat(formData.bathrooms) : null,
          sleeps: formData.sleeps ? parseInt(formData.sleeps) : null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create listing')
      }

      onSuccess()
      onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
        <input
          type="text"
          required
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
        <input
          type="text"
          value={formData.city}
          onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Listing Type *</label>
        <select
          required
          value={formData.listing_type}
          onChange={(e) => setFormData(prev => ({ ...prev, listing_type: e.target.value as 'Local' | 'Greater' }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="Local">Local</option>
          <option value="Greater">Greater</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bedrooms</label>
          <input
            type="number"
            min="0"
            value={formData.bedrooms}
            onChange={(e) => setFormData(prev => ({ ...prev, bedrooms: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bathrooms</label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={formData.bathrooms}
            onChange={(e) => setFormData(prev => ({ ...prev, bathrooms: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sleeps</label>
          <input
            type="number"
            min="0"
            value={formData.sleeps}
            onChange={(e) => setFormData(prev => ({ ...prev, sleeps: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tracked Link *</label>
        <input
          type="url"
          required
          value={formData.link}
          onChange={(e) => setFormData(prev => ({ ...prev, link: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          placeholder="https://..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Original VRBO Link</label>
        <input
          type="url"
          value={formData.non_tracked_link}
          onChange={(e) => setFormData(prev => ({ ...prev, non_tracked_link: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          placeholder="https://..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Main Image URL</label>
        <input
          type="url"
          value={formData.main_image_url}
          onChange={(e) => setFormData(prev => ({ ...prev, main_image_url: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          placeholder="https://..."
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-white bg-brand-primary border border-transparent rounded-md hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? 'Adding...' : 'Add Listing'}
        </button>
      </div>
    </form>
  )
}

// CSV Upload Form Component
function CsvUploadForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: (result: any) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/vrbo/upload-csv', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const result = await response.json()
      onSuccess(result.results)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Download Template Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="text-sm font-medium text-blue-900 mb-1">Need a template?</h4>
            <p className="text-xs text-blue-700">
              Download our CSV template to easily bulk upload VRBO listings with proper formatting.
            </p>
          </div>
          <a
            href="/api/vrbo/template"
            download
            className="ml-4 inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Template
          </a>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select CSV File
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            CSV should have columns: Title, City, Bedrooms, Bathrooms, Sleeps, Link, Non-tracked Link, Listing Type, Main Image URL
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!file || uploading}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload CSV'}
          </button>
        </div>
      </form>
    </div>
  )
}