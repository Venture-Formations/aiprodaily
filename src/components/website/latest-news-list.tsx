"use client"

import { Calendar } from "lucide-react"
import Link from 'next/link'
import { Container } from '@/components/salient/Container'

interface NewsItem {
  type: 'newsletter' | 'article'
  slug: string
  title: string
  date: string
  category: string
  image_url?: string | null
  description?: string
  metadata?: {
    total_articles?: number
    total_secondary_articles?: number
    has_ai_apps?: boolean
    has_prompt?: boolean
  }
}

interface LatestNewsListProps {
  newsItems: NewsItem[]
  newsletterName: string
}

export function LatestNewsList({ newsItems, newsletterName }: LatestNewsListProps) {
  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const placeholderSvg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"%3E%3Crect width="800" height="600" fill="%23e5e7eb"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" fill="%239ca3af"%3EAI Accounting Daily%3C/text%3E%3C/svg%3E'

  if (newsItems.length === 0) {
    return (
      <section id="latest-news" className="bg-blue-600 py-12 sm:py-16">
        <Container>
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              No News Yet
            </h3>
            <p className="text-slate-600">
              Check back soon for the latest news and updates.
            </p>
          </div>
        </Container>
      </section>
    )
  }

  return (
    <section id="latest-news" className="relative overflow-hidden bg-blue-600 py-12 sm:py-16">
      {/* Background image for purple/pink/teal clouding effect */}
      <img
        src="/images/background-call-to-action.jpg"
        alt=""
        className="absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
        width={2347}
        height={1244}
      />
      <Container className="relative">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center mb-12">
          <h2 className="font-display text-3xl tracking-tight text-white sm:text-4xl">
            Latest News
          </h2>
          <p className="mt-4 text-lg tracking-tight text-blue-100">
            Browse the latest news from {newsletterName}
          </p>
        </div>

        {/* News Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {newsItems.map((item) => {
            const href = item.type === 'newsletter'
              ? `/newsletter/${item.slug}`
              : `/news/${item.slug}`

            return (
              <Link key={`${item.type}-${item.slug}`} href={href}>
                <div className="group cursor-pointer bg-white rounded-2xl p-1 shadow-xl shadow-slate-900/10 hover:shadow-2xl hover:shadow-slate-900/20 transition-shadow h-full flex flex-col">
                  {/* Image */}
                  <div className="overflow-hidden rounded-xl">
                    <div className="relative w-full h-48 bg-slate-100 overflow-hidden">
                      <img
                        src={item.image_url || placeholderSvg}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          e.currentTarget.src = placeholderSvg
                        }}
                      />
                      {/* Category Badge */}
                      <div className="absolute top-3 left-3">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${
                          item.type === 'newsletter'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {item.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="px-5 pt-5 pb-5 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(item.date)}</span>
                    </div>

                    <h3 className="text-base font-semibold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors leading-tight flex-1">
                      {item.title}
                    </h3>

                    {/* Content Stats for newsletters */}
                    {item.type === 'newsletter' && item.metadata && (
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        {((item.metadata.total_articles || 0) + (item.metadata.total_secondary_articles || 0)) > 0 && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {(item.metadata.total_articles || 0) + (item.metadata.total_secondary_articles || 0)} articles
                          </span>
                        )}
                        {item.metadata.has_ai_apps && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                            </svg>
                            AI Apps
                          </span>
                        )}
                        {item.metadata.has_prompt && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            AI Prompt
                          </span>
                        )}
                      </div>
                    )}

                    {/* Description for articles */}
                    {item.type === 'article' && item.description && (
                      <p className="text-sm text-slate-500 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* See More Link */}
        <div className="flex justify-center mt-10">
          <Link
            href="/news"
            className="inline-flex items-center px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
          >
            See more
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </Container>
    </section>
  )
}
