'use client'

import type { FeedSettings, EditSettings } from '../types'

interface SettingsTabProps {
  settings: FeedSettings | null
  editSettings: EditSettings
  setEditSettings: (s: EditSettings) => void
  savingSettings: boolean
  handleSaveSettings: () => void
  feedUrl: string
  copied: boolean
  handleCopy: () => void
}

export function SettingsTab({
  settings,
  editSettings,
  setEditSettings,
  savingSettings,
  handleSaveSettings,
  feedUrl,
  copied,
  handleCopy,
}: SettingsTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Feed Settings</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Feed Title</label>
            <input
              type="text"
              value={editSettings.feed_title}
              onChange={(e) => setEditSettings({ ...editSettings, feed_title: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ingestion Max Age (days)</label>
              <input
                type="number"
                value={editSettings.max_age_days}
                onChange={(e) => setEditSettings({ ...editSettings, max_age_days: parseInt(e.target.value) || 1 })}
                min={1}
                max={90}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cache TTL (minutes)</label>
              <input
                type="number"
                value={editSettings.cache_ttl_minutes}
                onChange={(e) => setEditSettings({ ...editSettings, cache_ttl_minutes: parseInt(e.target.value) || 1 })}
                min={1}
                max={1440}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Feed Article Age (days)</label>
              <input
                type="number"
                value={editSettings.feed_article_age_days}
                onChange={(e) => setEditSettings({ ...editSettings, feed_article_age_days: parseInt(e.target.value) || 14 })}
                min={1}
                max={90}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
              />
              <p className="text-xs text-gray-400 mt-1">Starting window for articles in feed output. Expands by 5 days as needed.</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Min Articles per Company</label>
              <input
                type="number"
                value={editSettings.min_articles_per_company}
                onChange={(e) => setEditSettings({ ...editSettings, min_articles_per_company: parseInt(e.target.value) || 2 })}
                min={1}
                max={20}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
              />
              <p className="text-xs text-gray-400 mt-1">Window expands until each company has at least this many.</p>
            </div>
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {savingSettings ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Upload Schedule</h2>
        <p className="text-xs text-gray-500 mb-3">
          Staged uploads will be automatically activated at this time each week (US Central Time).
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Day of Week</label>
            <select
              value={editSettings.upload_schedule_day}
              onChange={(e) => setEditSettings({ ...editSettings, upload_schedule_day: parseInt(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            >
              <option value={0}>Sunday</option>
              <option value={1}>Monday</option>
              <option value={2}>Tuesday</option>
              <option value={3}>Wednesday</option>
              <option value={4}>Thursday</option>
              <option value={5}>Friday</option>
              <option value={6}>Saturday</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Time (CT)</label>
            <select
              value={editSettings.upload_schedule_time}
              onChange={(e) => setEditSettings({ ...editSettings, upload_schedule_time: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            >
              {Array.from({ length: 48 }, (_, i) => {
                const h = Math.floor(i / 2)
                const m = i % 2 === 0 ? '00' : '30'
                const val = `${String(h).padStart(2, '0')}:${m}`
                const ampm = h >= 12 ? 'PM' : 'AM'
                const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
                return <option key={val} value={val}>{h12}:{m} {ampm}</option>
              })}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Trade Freshness (days)</label>
            <input
              type="number"
              value={editSettings.trade_freshness_days}
              onChange={(e) => setEditSettings({ ...editSettings, trade_freshness_days: parseInt(e.target.value) || 7 })}
              min={1}
              max={90}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
            <p className="text-xs text-gray-400 mt-1">
              Only trades added within this window (Quiver_Upload_Time).
            </p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Max Trades per Member</label>
            <input
              type="number"
              value={editSettings.max_trades_per_member}
              onChange={(e) => setEditSettings({ ...editSettings, max_trades_per_member: parseInt(e.target.value) || 5 })}
              min={1}
              max={50}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
            <p className="text-xs text-gray-400 mt-1">
              Limit per congress member to ensure diversity.
            </p>
          </div>
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={savingSettings}
          className="mt-3 w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {savingSettings ? 'Saving...' : 'Save Schedule'}
        </button>

        {/* Activation Status */}
        {settings && (
          <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500 space-y-1">
            {settings.last_activation_at && (
              <div>Last activation: {new Date(settings.last_activation_at).toLocaleString()}</div>
            )}
            {settings.last_ingestion_at && (
              <div>Last ingestion: {new Date(settings.last_ingestion_at).toLocaleString()}</div>
            )}
            {settings.staged_upload_at && (
              <div className="text-amber-600 font-medium">Data staged: {new Date(settings.staged_upload_at).toLocaleString()}</div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Combined Feed URL</label>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-gray-50 rounded px-3 py-2 text-sm text-gray-800 border border-gray-200 overflow-x-auto">
            {feedUrl}
          </code>
          <button
            onClick={handleCopy}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Requires Bearer token (CRON_SECRET) or ?secret= param. Add ?refresh=true to force cache bust.
        </p>
      </div>
    </div>
  )
}
