'use client'

import Link from 'next/link'
import Layout from '@/components/Layout'
import AddAdModal from '@/components/ads-database/AddAdModal'
import EditAdModal from '@/components/ads-database/EditAdModal'
import AdPreviewModal from '@/components/ads-database/AdPreviewModal'
import { useAdsDatabase } from './useAdsDatabase'
import SelectionModeInfo from './SelectionModeInfo'
import ActiveAdsView from './ActiveAdsView'
import { ReviewAdCard, InactiveAdCard } from './AdCard'

export default function AdsManagementPage() {
  const {
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
    setActiveStatusTab,
    setSelectedSection,
    setShowAddModal,
    setEditingAd,
    setPreviewingAd,
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
    handleResetPosition,
    handleSetPosition,
    handleSetNextAdPosition,
    fetchCompanyGroups,
    fetchAds,
  } = useAdsDatabase()

  const displayCount = activeStatusTab === 'active'
    ? companyGroups.reduce((sum, g) => sum + g.advertisements.length, 0)
    : ads.length

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
                {displayCount} {activeStatusTab} {displayCount === 1 ? 'advertisement' : 'advertisements'}
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
        {activeStatusTab === 'active' && !loading && companyGroups.length > 0 && (
          <SelectionModeInfo
            moduleSelectionMode={moduleSelectionMode}
            moduleNextPosition={moduleNextPosition}
            companyGroups={companyGroups}
            onResetPosition={handleResetPosition}
            onSetPosition={handleSetPosition}
          />
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Active Ads - Company Grouped View */}
        {!loading && activeStatusTab === 'active' && (
          <ActiveAdsView
            companyGroups={companyGroups}
            expandedCompanies={expandedCompanies}
            moduleSelectionMode={moduleSelectionMode}
            moduleNextPosition={moduleNextPosition}
            onToggleExpanded={toggleCompanyExpanded}
            onCompanyDragStart={handleCompanyDragStart}
            onCompanyDragOver={handleCompanyDragOver}
            onCompanyDrop={handleCompanyDrop}
            onAdDragStart={handleAdDragStart}
            onAdDragOver={handleAdDragOver}
            onAdDrop={handleAdDrop}
            onPreview={setPreviewingAd}
            onEdit={setEditingAd}
            onDelete={handleDelete}
            onSetNextAdPosition={handleSetNextAdPosition}
          />
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
                <ReviewAdCard
                  key={ad.id}
                  ad={ad}
                  onPreview={setPreviewingAd}
                  onEdit={setEditingAd}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
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
                <InactiveAdCard
                  key={ad.id}
                  ad={ad}
                  onPreview={setPreviewingAd}
                  onEdit={setEditingAd}
                  onActivate={handleActivate}
                  onDelete={handleDelete}
                />
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
