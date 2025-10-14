'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Newsletter } from '@/types/database'

export default function NewsletterSelectorPage() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/newsletters')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setNewsletters(data.newsletters)
        }
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading newsletters...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">AI Professional Newsletter Platform</h1>
          <p className="text-gray-600 mt-2">Select a newsletter to manage</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {newsletters.map((newsletter) => (
            <Link
              key={newsletter.id}
              href={`/admin/newsletters/${newsletter.slug}/dashboard`}
              className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 border border-gray-200 hover:border-blue-300"
            >
              <div className="flex items-start space-x-4">
                {newsletter.logo_url ? (
                  <img
                    src={newsletter.logo_url}
                    alt={newsletter.name}
                    className="w-16 h-16 rounded object-cover"
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded flex items-center justify-center text-white font-bold text-2xl"
                    style={{ backgroundColor: newsletter.primary_color }}
                  >
                    {newsletter.name.charAt(0)}
                  </div>
                )}

                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900">{newsletter.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">{newsletter.subdomain}.localhost:3000</p>
                  {newsletter.description && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{newsletter.description}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <span className="text-sm text-blue-600 font-medium">Manage Newsletter →</span>
              </div>
            </Link>
          ))}
        </div>

        {newsletters.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <p className="text-gray-500 mb-4">No newsletters found. Create your first newsletter to get started.</p>
            <Link
              href="/admin/newsletters/create"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Newsletter
            </Link>
          </div>
        )}

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Development Testing</h3>
          <p className="text-blue-800 text-sm mb-3">
            To test subdomain routing locally, add entries to your hosts file:
          </p>
          <div className="bg-white rounded p-3 font-mono text-xs text-gray-700 border border-blue-300">
            <p>127.0.0.1  accounting.localhost</p>
            <p>127.0.0.1  admin.localhost</p>
          </div>
          <p className="text-blue-800 text-sm mt-3">
            Then access: <code className="bg-white px-2 py-1 rounded">http://accounting.localhost:3000</code>
          </p>
        </div>
      </div>
    </div>
  )
}
