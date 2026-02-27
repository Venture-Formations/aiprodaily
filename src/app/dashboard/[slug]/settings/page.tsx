'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Layout from '@/components/Layout'
import SystemStatus from '@/components/settings/SystemStatus'
import BusinessSettings from '@/components/settings/BusinessSettings'
import NewsletterSettings from '@/components/settings/NewsletterSettings'
import EmailSettings from '@/components/settings/EmailSettings'
import BlockedDomainsSettings from '@/components/settings/BlockedDomainsSettings'
import IPExclusionSettings from '@/components/settings/IPExclusionSettings'
import Notifications from '@/components/settings/Notifications'
import FacebookSettings from '@/components/settings/FacebookSettings'
import Users from '@/components/settings/Users'
import DangerZone from '@/components/settings/DangerZone'

export default function SettingsPage() {
  const params = useParams()
  const slug = params?.slug as string
  const [activeTab, setActiveTab] = useState('system')
  const [publicationId, setPublicationId] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/newsletters`)
      .then((res) => res.json())
      .then((data) => {
        const pub = (data.newsletters || []).find((n: { slug: string }) => n.slug === slug)
        if (pub) setPublicationId(pub.id)
      })
      .catch(() => {})
  }, [slug])

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Settings
          </h1>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex flex-wrap space-x-8">
              {[
                { id: 'system', name: 'System Status' },
                { id: 'business', name: 'Publication Settings' },
                { id: 'newsletter', name: 'Sections' },
                { id: 'email', name: 'Email' },
                { id: 'blocked-domains', name: 'Blocked Domains' },
                { id: 'ip-exclusion', name: 'IP Exclusion' },
                { id: 'notifications', name: 'Notifications' },
                { id: 'facebook', name: 'Facebook' },
                { id: 'users', name: 'Users' },
                { id: 'danger', name: 'Danger Zone' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? tab.id === 'danger' ? 'border-red-500 text-red-600' : 'border-brand-primary text-brand-primary'
                      : tab.id === 'danger'
                        ? 'border-transparent text-red-400 hover:text-red-600 hover:border-red-300'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'system' && <SystemStatus />}
          {activeTab === 'business' && <BusinessSettings />}
          {activeTab === 'newsletter' && <NewsletterSettings />}
          {activeTab === 'email' && <EmailSettings />}
          {activeTab === 'blocked-domains' && <BlockedDomainsSettings />}
          {activeTab === 'ip-exclusion' && <IPExclusionSettings />}
          {activeTab === 'notifications' && <Notifications />}
          {activeTab === 'facebook' && <FacebookSettings />}
          {activeTab === 'users' && <Users />}
          {activeTab === 'danger' && publicationId && slug && (
            <DangerZone publicationId={publicationId} slug={slug} />
          )}
        </div>
      </div>
    </Layout>
  )
}
