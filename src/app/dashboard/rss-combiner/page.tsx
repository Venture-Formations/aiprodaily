'use client'

import Layout from '@/components/Layout'
import { TABS } from './constants'
import { useRSSCombinerData } from './hooks/useRSSCombinerData'
import { TradesTab } from './components/TradesTab'
import { TickerDatabaseTab } from './components/TickerDatabaseTab'
import { ExcludedCompaniesTab } from './components/ExcludedCompaniesTab'
import { ApprovedSourcesTab } from './components/ApprovedSourcesTab'
import { ExcludedKeywordsTab } from './components/ExcludedKeywordsTab'
import { SettingsTab } from './components/SettingsTab'

export default function RSSCombinerPage() {
  const data = useRSSCombinerData()

  if (data.loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Congressional Trading RSS</h1>
          <p className="mt-1 text-sm text-gray-600">
            Upload congressional trade data to auto-generate news feeds for the highest-value trades.
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-6 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => data.setActiveTab(tab.key)}
                className={`whitespace-nowrap pb-3 px-1 border-b-2 text-sm font-medium ${
                  data.activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                {tab.key === 'ticker-db' && data.unknownTickers.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                    {data.unknownTickers.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {data.activeTab === 'trades' && (
          <TradesTab
            trades={data.trades}
            tradeStats={data.tradeStats}
            uploading={data.uploading}
            uploadResult={data.uploadResult}
            uploadProgress={data.uploadProgress}
            handleTradeUpload={data.handleTradeUpload}
            settings={data.settings}
            editSettings={data.editSettings}
            setEditSettings={data.setEditSettings}
            savingSettings={data.savingSettings}
            handleSaveSettings={data.handleSaveSettings}
            ingesting={data.ingesting}
            ingestionResult={data.ingestionResult}
            handleRunIngestion={data.handleRunIngestion}
            handleRunIngestionWorkflow={data.handleRunIngestionWorkflow}
            stagingStatus={data.stagingStatus}
            activating={data.activating}
            activationResult={data.activationResult}
            handleActivateNow={data.handleActivateNow}
            handleDiscardStaged={data.handleDiscardStaged}
          />
        )}

        {data.activeTab === 'ticker-db' && (
          <TickerDatabaseTab
            tickers={data.tickers}
            filteredTickers={data.filteredTickers}
            tickerSearch={data.tickerSearch}
            setTickerSearch={data.setTickerSearch}
            tickerPage={data.tickerPage}
            setTickerPage={data.setTickerPage}
            newTicker={data.newTicker}
            setNewTicker={data.setNewTicker}
            newTickerName={data.newTickerName}
            setNewTickerName={data.setNewTickerName}
            editingTickerId={data.editingTickerId}
            setEditingTickerId={data.setEditingTickerId}
            editTickerName={data.editTickerName}
            setEditTickerName={data.setEditTickerName}
            tickerUploading={data.tickerUploading}
            tickerUploadResult={data.tickerUploadResult}
            handleTickerCSVUpload={data.handleTickerCSVUpload}
            handleAddTicker={data.handleAddTicker}
            handleEditTicker={data.handleEditTicker}
            handleDeleteTicker={data.handleDeleteTicker}
            unknownTickers={data.unknownTickers}
            confirmingTicker={data.confirmingTicker}
            setConfirmingTicker={data.setConfirmingTicker}
            handleConfirmUnknownTicker={data.handleConfirmUnknownTicker}
            excludedTickerSet={data.excludedTickerSet}
            handleToggleExclude={data.handleToggleExclude}
          />
        )}

        {data.activeTab === 'excluded-companies' && (
          <ExcludedCompaniesTab
            excludedCompanies={data.excludedCompanies}
            newExcludedTicker={data.newExcludedTicker}
            setNewExcludedTicker={data.setNewExcludedTicker}
            newExcludedCompanyName={data.newExcludedCompanyName}
            setNewExcludedCompanyName={data.setNewExcludedCompanyName}
            editingCompanyId={data.editingCompanyId}
            setEditingCompanyId={data.setEditingCompanyId}
            editCompanyTicker={data.editCompanyTicker}
            setEditCompanyTicker={data.setEditCompanyTicker}
            editCompanyName={data.editCompanyName}
            setEditCompanyName={data.setEditCompanyName}
            handleAddExcludedCompany={data.handleAddExcludedCompany}
            handleEditExcludedCompany={data.handleEditExcludedCompany}
            handleDeleteExcludedCompany={data.handleDeleteExcludedCompany}
          />
        )}

        {data.activeTab === 'approved-sources' && (
          <ApprovedSourcesTab
            approvedSources={data.approvedSources}
            newApprovedName={data.newApprovedName}
            setNewApprovedName={data.setNewApprovedName}
            newApprovedDomain={data.newApprovedDomain}
            setNewApprovedDomain={data.setNewApprovedDomain}
            handleAddApprovedSource={data.handleAddApprovedSource}
            handleDeleteApprovedSource={data.handleDeleteApprovedSource}
            handleToggleApprovedSource={data.handleToggleApprovedSource}
          />
        )}

        {data.activeTab === 'excluded-keywords' && (
          <ExcludedKeywordsTab
            excludedKeywords={data.excludedKeywords}
            newKeyword={data.newKeyword}
            setNewKeyword={data.setNewKeyword}
            handleAddKeyword={data.handleAddKeyword}
            handleDeleteKeyword={data.handleDeleteKeyword}
          />
        )}

        {data.activeTab === 'settings' && (
          <SettingsTab
            settings={data.settings}
            editSettings={data.editSettings}
            setEditSettings={data.setEditSettings}
            savingSettings={data.savingSettings}
            handleSaveSettings={data.handleSaveSettings}
            feedUrl={data.feedUrl}
            copied={data.copied}
            handleCopy={data.handleCopy}
          />
        )}
      </div>
    </Layout>
  )
}
