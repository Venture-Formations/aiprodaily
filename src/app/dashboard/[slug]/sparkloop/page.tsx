'use client'

import Layout from '@/components/Layout'
import { RefreshCw } from 'lucide-react'
import DetailedTab from './components/DetailedTab'
import OffersTab from './components/OffersTab'
import PublicationsTab from './components/PublicationsTab'
import OverviewTab from './components/OverviewTab'
import { useSparkLoopData } from './components/useSparkLoopData'

export default function SparkLoopAdminPage() {
  const {
    recommendations, counts, globalStats, defaults,
    loading, syncing, error,
    chartStats, chartLoading, timeframe, setTimeframe,
    activeTab, setActiveTab,
    popupPreview, recsPagePreview, estimatedValue,
    fetchRecommendations, syncFromSparkLoop,
  } = useSparkLoopData()

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold">SparkLoop Recommendations</h1>
            <p className="text-gray-600 mt-1">
              Manage which newsletters appear in the signup popup
            </p>
          </div>
          <button
            onClick={syncFromSparkLoop}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync from SparkLoop'}
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-red-600 font-medium text-sm">Error:</span>
              <span className="text-red-700 text-sm">{error}</span>
            </div>
            <button
              onClick={fetchRecommendations}
              className="mt-2 text-sm text-red-600 underline hover:text-red-800"
            >
              Retry
            </button>
          </div>
        )}

        {/* Tab Buttons */}
        <div className="flex gap-1 mb-6 border-b">
          {(['overview', 'detailed', 'publications', 'offers'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize ${
                activeTab === tab
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'overview' ? 'Overview' : tab === 'detailed' ? 'Detailed' : tab === 'publications' ? 'Publications' : 'Offers'}
            </button>
          ))}
        </div>

        {activeTab === 'offers' ? (
          <OffersTab />
        ) : activeTab === 'publications' ? (
          <PublicationsTab recommendations={recommendations} />
        ) : activeTab === 'overview' ? (
          <OverviewTab
            chartStats={chartStats}
            chartLoading={chartLoading}
            timeframe={timeframe}
            setTimeframe={setTimeframe}
            loading={loading}
            counts={counts}
            popupPreview={popupPreview}
            recsPagePreview={recsPagePreview}
            estimatedValue={estimatedValue}
          />
        ) : (
          <DetailedTab
            recommendations={recommendations}
            globalStats={globalStats}
            defaults={defaults}
            loading={loading}
            onRefresh={fetchRecommendations}
          />
        )}
      </div>
    </Layout>
  )
}
