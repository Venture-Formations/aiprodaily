'use client'

import type { TradeRow, TradeStats, IngestionStats, FeedSettings, StagingStatus, EditSettings } from '../types'

interface TradesTabProps {
  trades: TradeRow[]
  tradeStats: TradeStats | null
  uploading: boolean
  uploadResult: any
  uploadProgress: string
  handleTradeUpload: (e: React.FormEvent<HTMLFormElement>) => void
  settings: FeedSettings | null
  editSettings: EditSettings
  setEditSettings: (s: EditSettings) => void
  savingSettings: boolean
  handleSaveSettings: () => void
  ingesting: boolean
  ingestionResult: IngestionStats | null
  handleRunIngestion: () => void
  handleRunIngestionWorkflow: () => void
  stagingStatus: StagingStatus | null
  activating: boolean
  activationResult: any
  handleActivateNow: () => void
  handleDiscardStaged: () => void
}

export function TradesTab({
  trades,
  tradeStats,
  uploading,
  uploadResult,
  uploadProgress,
  handleTradeUpload,
  settings,
  editSettings,
  setEditSettings,
  savingSettings,
  handleSaveSettings,
  ingesting,
  ingestionResult,
  handleRunIngestion,
  handleRunIngestionWorkflow,
  stagingStatus,
  activating,
  activationResult,
  handleActivateNow,
  handleDiscardStaged,
}: TradesTabProps) {
  return (
    <div className="space-y-6">
      {/* Ingestion Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-gray-700">Feed Ingestion</h2>
            <p className="text-xs text-gray-500 mt-1">
              Fetch Google News feeds for top trades and store approved articles in the database.
              {settings?.last_ingestion_at && (
                <> Last run: <span className="font-medium">{new Date(settings.last_ingestion_at).toLocaleString()}</span></>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRunIngestion}
              disabled={ingesting}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
              title="Runs synchronously — may time out for large ingestions (> 600s)"
            >
              {ingesting ? 'Ingesting...' : 'Ingest Now'}
            </button>
            <button
              onClick={handleRunIngestionWorkflow}
              disabled={ingesting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
              title="Starts a durable workflow with separate 800s timeouts per step. Runs in background."
            >
              {ingesting ? 'Starting...' : 'Ingest (Workflow)'}
            </button>
          </div>
        </div>
        {ingestionResult && (
          <div className="mt-3 p-3 rounded bg-gray-50 text-sm grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <div className="text-xs text-gray-500">Feeds Fetched</div>
              <div className="font-medium text-gray-900">{ingestionResult.feedsFetched}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Feeds Failed</div>
              <div className="font-medium text-red-600">{ingestionResult.feedsFailed}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Articles Stored</div>
              <div className="font-medium text-green-600">{ingestionResult.articlesStored}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Filtered Out</div>
              <div className="font-medium text-orange-600">{ingestionResult.articlesFiltered}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Duplicates</div>
              <div className="font-medium text-gray-500">{ingestionResult.articlesSkippedDuplicate}</div>
            </div>
          </div>
        )}
      </div>

      {tradeStats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{tradeStats.totalTrades.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">Total Trades</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{tradeStats.uniqueTickers}</div>
            <div className="text-xs text-gray-500 mt-1">Unique Tickers</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{tradeStats.selectedForFeed}</div>
            <div className="text-xs text-gray-500 mt-1">Selected for Feed</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Upload XLSX</h2>
          <form onSubmit={handleTradeUpload}>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-3"
            />
            <button
              type="submit"
              disabled={uploading}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Stage Upload'}
            </button>
          </form>
          <p className="mt-2 text-xs text-gray-500">
            Uploads are staged until the scheduled activation time. Use &quot;Activate Now&quot; for immediate processing.
          </p>

          {uploadProgress && (
            <div className="mt-2 text-xs text-blue-600">{uploadProgress}</div>
          )}

          {uploadResult && (
            <div className="mt-3 p-3 rounded bg-gray-50 text-sm">
              {uploadResult.error ? (
                <div className="text-red-600">{uploadResult.error}</div>
              ) : (
                <>
                  <div className="font-medium mb-1">
                    Staged: {uploadResult.inserted?.toLocaleString()} of {uploadResult.total?.toLocaleString()} rows
                  </div>
                  <div className="text-blue-700">Unique tickers: {uploadResult.uniqueTickers}</div>
                  {uploadResult.errors?.length > 0 && (
                    <div className="mt-2 text-red-600 text-xs">
                      {uploadResult.errors.map((err: string, i: number) => (
                        <div key={i}>{err}</div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Staging Status */}
          {stagingStatus && stagingStatus.count > 0 && (
            <div className="mt-3 p-3 rounded bg-amber-50 border border-amber-200 text-sm">
              <div className="font-medium text-amber-800 mb-1">
                {stagingStatus.count.toLocaleString()} rows staged
              </div>
              <div className="text-amber-700 text-xs mb-2">
                Will activate on {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][stagingStatus.upload_schedule_day]} at {
                  (() => {
                    const [h, m] = stagingStatus.upload_schedule_time.split(':').map(Number)
                    const ampm = h >= 12 ? 'PM' : 'AM'
                    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
                    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
                  })()
                } CT
                {stagingStatus.staged_upload_at && (
                  <> (uploaded {new Date(stagingStatus.staged_upload_at).toLocaleDateString()})</>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleActivateNow}
                  disabled={activating}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {activating ? 'Activating...' : 'Activate Now'}
                </button>
                <button
                  onClick={handleDiscardStaged}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 border border-red-200"
                >
                  Discard
                </button>
              </div>
              {activationResult && (
                <div className={`mt-2 text-xs ${activationResult.activated ? 'text-green-700' : 'text-red-600'}`}>
                  {activationResult.activated
                    ? `Activated ${activationResult.rowsCopied?.toLocaleString()} trades. ${activationResult.ingestion?.articlesStored ?? 0} articles ingested.`
                    : `Activation failed: ${activationResult.reason}`}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Feed Generation</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sale URL Template</label>
              <input
                type="text"
                value={editSettings.sale_url_template}
                onChange={(e) => setEditSettings({ ...editSettings, sale_url_template: e.target.value })}
                placeholder="https://news.google.com/rss/search?q={company_name}+stock..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">For Sale, Sale (Partial), Sale (Full) transactions. Use {'{company_name}'} as placeholder.</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Purchase URL Template</label>
              <input
                type="text"
                value={editSettings.purchase_url_template}
                onChange={(e) => setEditSettings({ ...editSettings, purchase_url_template: e.target.value })}
                placeholder="https://news.google.com/rss/search?q={company_name}+stock..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">For Purchase transactions. Use {'{company_name}'} as placeholder.</p>
            </div>

            <div className="border-t border-gray-200 pt-3 mt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500">Secondary Templates (Fallback)</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-gray-500">{editSettings.secondary_templates_enabled ? 'Enabled' : 'Disabled'}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={editSettings.secondary_templates_enabled}
                    onClick={() => setEditSettings({ ...editSettings, secondary_templates_enabled: !editSettings.secondary_templates_enabled })}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${editSettings.secondary_templates_enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${editSettings.secondary_templates_enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                </label>
              </div>
              <p className="text-xs text-gray-400 mb-3">Broader templates used when the primary returns fewer than the minimum posts per trade. Supports {'{company_name}'} and {'{ticker}'} placeholders.</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Secondary Sale URL Template</label>
                  <input
                    type="text"
                    value={editSettings.secondary_sale_url_template}
                    onChange={(e) => setEditSettings({ ...editSettings, secondary_sale_url_template: e.target.value })}
                    placeholder="https://news.google.com/rss/search?q={ticker}+stock..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Secondary Purchase URL Template</label>
                  <input
                    type="text"
                    value={editSettings.secondary_purchase_url_template}
                    onChange={(e) => setEditSettings({ ...editSettings, secondary_purchase_url_template: e.target.value })}
                    placeholder="https://news.google.com/rss/search?q={ticker}+stock..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Min Posts Per Trade</label>
                  <input
                    type="number"
                    value={editSettings.min_posts_per_trade}
                    onChange={(e) => setEditSettings({ ...editSettings, min_posts_per_trade: parseInt(e.target.value) || 1 })}
                    min={1}
                    max={100}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                  <p className="text-xs text-gray-400 mt-1">If a trade has fewer approved articles than this, the secondary template is used.</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Total Trades for Feed</label>
              <input
                type="number"
                value={editSettings.max_trades}
                onChange={(e) => setEditSettings({ ...editSettings, max_trades: parseInt(e.target.value) || 1 })}
                min={1}
                max={200}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
              />
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {savingSettings ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Selected Trades Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-700">
            Top Trades Selected for Feed ({trades.length})
          </h2>
        </div>
        {trades.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No trades yet. Upload an XLSX file to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ticker</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Traded</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Transaction</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Trade Size</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Party</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Chamber</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {trades.map((trade) => (
                  <tr key={trade.id}>
                    <td className="px-3 py-2 font-medium text-blue-700">{trade.ticker}</td>
                    <td className="px-3 py-2 text-gray-700">{trade.company_name}</td>
                    <td className="px-3 py-2 text-gray-500">{trade.traded}</td>
                    <td className="px-3 py-2 text-gray-500">{trade.transaction || '-'}</td>
                    <td className="px-3 py-2 text-gray-500 text-right">{trade.trade_size_usd || '-'}</td>
                    <td className="px-3 py-2 text-gray-700">{trade.name || '-'}</td>
                    <td className="px-3 py-2 text-gray-500">{trade.party || '-'}</td>
                    <td className="px-3 py-2 text-gray-500">{trade.chamber || '-'}</td>
                    <td className="px-3 py-2 text-gray-500">{trade.state || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
