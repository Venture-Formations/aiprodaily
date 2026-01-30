'use client'

import { use, useState } from 'react'
import Layout from '@/components/Layout'
import IssuesAnalyticsTab from './components/IssuesAnalyticsTab'
import ArticlesTab from './components/ArticlesTab'
import PollsAnalyticsTab from './components/PollsAnalyticsTab'
import AIAppsAnalyticsTab from './components/AIAppsAnalyticsTab'
import AdsAnalyticsTab from './components/AdsAnalyticsTab'

export default function AnalyticsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [activeTab, setActiveTab] = useState('issues')
  const [excludeIps, setExcludeIps] = useState(true)

  const tabs = [
    { id: 'issues', name: 'Issues' },
    { id: 'articles', name: 'Articles' },
    { id: 'polls', name: 'Polls' },
    { id: 'ai-apps', name: 'AI Apps' },
    { id: 'ads', name: 'Ads' }
  ]

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Newsletter Analytics
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                View comprehensive analytics across all aspects of your newsletter
              </p>
            </div>
            {/* Exclude IPs Toggle */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">
                Exclude IPs
              </label>
              <button
                onClick={() => setExcludeIps(!excludeIps)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  excludeIps ? 'bg-blue-600' : 'bg-gray-200'
                }`}
                title={excludeIps ? 'IP exclusion enabled - bot/scanner clicks filtered out' : 'IP exclusion disabled - showing all clicks'}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    excludeIps ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-xs ${excludeIps ? 'text-blue-600' : 'text-gray-500'}`}>
                {excludeIps ? 'On' : 'Off'}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="-mb-px flex space-x-8 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === tab.id
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.name}
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'issues' && <IssuesAnalyticsTab slug={slug} excludeIps={excludeIps} />}
          {activeTab === 'articles' && <ArticlesTab slug={slug} excludeIps={excludeIps} />}
          {activeTab === 'polls' && <PollsAnalyticsTab slug={slug} excludeIps={excludeIps} />}
          {activeTab === 'ai-apps' && <AIAppsAnalyticsTab slug={slug} excludeIps={excludeIps} />}
          {activeTab === 'ads' && <AdsAnalyticsTab slug={slug} excludeIps={excludeIps} />}
        </div>
      </div>
    </Layout>
  )
}
