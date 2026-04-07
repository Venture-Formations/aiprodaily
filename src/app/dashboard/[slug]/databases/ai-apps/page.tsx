'use client'

import Layout from '@/components/Layout'
import { useAIAppsDatabase } from './useAIAppsDatabase'
import { UploadModal } from './UploadModal'
import { AddAppForm } from './AddAppForm'
import { StatsBar } from './StatsBar'
import { FiltersBar } from './FiltersBar'
import { AppsTable } from './AppsTable'

export default function AIApplicationsPage() {
  const db = useAIAppsDatabase()

  if (db.loading) {
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
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Product Cards Database
            </h1>
            <p className="text-gray-600">
              Manage product cards and recommendations for your newsletter
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => db.setShowUploadModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium"
              disabled={db.uploadingCSV}
            >
              {db.uploadingCSV ? 'Uploading...' : 'Upload CSV'}
            </button>
            <button
              onClick={() => db.setShowAddForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              + Add Product
            </button>
          </div>
        </div>

        {/* Upload Modal */}
        {db.showUploadModal && (
          <UploadModal
            modules={db.modules}
            uploadModuleId={db.uploadModuleId}
            setUploadModuleId={db.setUploadModuleId}
            onClose={() => db.setShowUploadModal(false)}
            onUpload={db.handleCSVUpload}
            downloadTemplate={db.downloadTemplate}
          />
        )}

        {/* Upload Message */}
        {db.uploadMessage && (
          <div className={`mb-4 p-3 rounded-lg ${db.uploadMessage.startsWith('\u2713') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {db.uploadMessage}
          </div>
        )}

        {/* Add Form */}
        {db.showAddForm && (
          <AddAppForm
            addForm={db.addForm}
            setAddForm={db.setAddForm}
            modules={db.modules}
            onSubmit={db.handleAddApp}
            onCancel={() => db.setShowAddForm(false)}
          />
        )}

        {/* Stats */}
        <StatsBar apps={db.apps} />

        {/* Filters */}
        <FiltersBar
          searchQuery={db.searchQuery}
          setSearchQuery={db.setSearchQuery}
          filterCategory={db.filterCategory}
          setFilterCategory={db.setFilterCategory}
          filterAffiliate={db.filterAffiliate}
          setFilterAffiliate={db.setFilterAffiliate}
          filterModule={db.filterModule}
          setFilterModule={db.setFilterModule}
          modules={db.modules}
          filteredCount={db.filteredApps.length}
          totalCount={db.apps.length}
        />

        {/* Table */}
        <AppsTable
          filteredApps={db.filteredApps}
          editingId={db.editingId}
          editForm={db.editForm}
          setEditForm={db.setEditForm}
          modules={db.modules}
          onEdit={db.handleEdit}
          onCancelEdit={db.handleCancelEdit}
          onSave={db.handleSave}
          onDelete={db.handleDelete}
          getModuleName={db.getModuleName}
        />
      </div>
    </Layout>
  )
}
