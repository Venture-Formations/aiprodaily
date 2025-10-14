'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { Card } from '@/components/ui'
import type { Newsletter } from '@/types/database'

export default function NewsletterSelect() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchNewsletters()
  }, [])

  const fetchNewsletters = async () => {
    try {
      const response = await fetch('/api/newsletters')
      if (!response.ok) throw new Error('Failed to fetch newsletters')
      const data = await response.json()
      setNewsletters(data.newsletters || [])
    } catch (error) {
      console.error('Error fetching newsletters:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNewsletterSelect = (slug: string) => {
    router.push(`/dashboard/${slug}`)
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <header className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Select Your Newsletter
            </h1>
            <p className="text-lg text-gray-600">
              Choose which professional newsletter you'd like to manage
            </p>
          </header>

          {/* Newsletter Cards */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
            </div>
          ) : newsletters.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">No newsletters available</div>
              <p className="text-sm text-gray-400">Contact an administrator to set up newsletters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {newsletters.filter(n => n.is_active).map((newsletter) => (
                <button
                  key={newsletter.id}
                  onClick={() => handleNewsletterSelect(newsletter.slug)}
                  className="text-left focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-lg transition-transform hover:scale-105"
                >
                  <Card hover padding="lg" className="h-full">
                    <div className="flex items-start space-x-4">
                      {/* Logo or Icon */}
                      {newsletter.logo_url ? (
                        <img
                          src={newsletter.logo_url}
                          alt={`${newsletter.name} logo`}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      ) : (
                        <div
                          className="w-16 h-16 rounded-lg flex items-center justify-center text-2xl font-bold text-white"
                          style={{ backgroundColor: newsletter.primary_color }}
                        >
                          {newsletter.name.charAt(0)}
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">
                          {newsletter.name}
                        </h2>
                        {newsletter.description && (
                          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                            {newsletter.description}
                          </p>
                        )}
                        <div className="flex items-center space-x-3 text-xs text-gray-500">
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                            </svg>
                            Newsletter
                          </span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="flex-shrink-0">
                        <svg
                          className="w-6 h-6 text-gray-400 group-hover:text-brand-primary transition-colors"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          )}

          {/* Admin Link */}
          <div className="text-center mt-8">
            <a
              href="/admin/newsletters"
              className="text-sm text-brand-primary hover:text-blue-700 font-medium"
            >
              Manage Newsletters
            </a>
          </div>
        </div>
      </div>
    </Layout>
  )
}
