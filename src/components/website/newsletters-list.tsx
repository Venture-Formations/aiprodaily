'use client'

import { useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Mail } from "lucide-react"
import Link from 'next/link'
import { Container } from '@/components/salient/Container'
import { Button } from '@/components/salient/Button'

const NEWSLETTERS_PER_PAGE = 6

interface Newsletter {
  id: string
  issue_id?: string
  issue_date: string  // The date of the newsletter (YYYY-MM-DD)
  subject_line: string
  send_date: string   // The timestamp when sent
  metadata?: {
    total_articles?: number
    total_secondary_articles?: number
    has_road_work?: boolean
    has_ai_apps?: boolean
    has_poll?: boolean
    has_prompt?: boolean
  }
  articles?: Array<{
    id: string
    headline: string
    rss_post?: {
      image_url?: string
      title?: string
    }
  }>
}

interface NewslettersListProps {
  newsletters: Newsletter[]
  imageOverride?: string // Optional: Use this image for all newsletter cards
}

export function NewslettersList({ newsletters, imageOverride }: NewslettersListProps) {
  const [currentPage, setCurrentPage] = useState(1)

  // Calculate pagination
  const totalPages = Math.ceil(newsletters.length / NEWSLETTERS_PER_PAGE)
  const startIndex = (currentPage - 1) * NEWSLETTERS_PER_PAGE
  const endIndex = startIndex + NEWSLETTERS_PER_PAGE
  const currentNewsletters = newsletters.slice(startIndex, endIndex)

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: number[] = []
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i)
    }
    return pages
  }

  const formatDate = (dateString: string) => {
    // Parse date as local date to avoid timezone offset issues
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day) // month is 0-indexed
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (newsletters.length === 0) {
    return (
      <section id="newsletters" className="bg-blue-600 py-12 sm:py-16">
        <Container>
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <Mail className="mx-auto h-12 w-12 text-slate-400 mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              No Newsletters Archived Yet
            </h3>
            <p className="text-slate-600 mb-6">
              Past newsletter editions will appear here once they are sent.
            </p>
            <Button href="/" color="blue">
              Go to Homepage
            </Button>
          </div>
        </Container>
      </section>
    )
  }

  return (
    <section id="newsletters" className="relative overflow-hidden bg-blue-600 py-12 sm:py-16">
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
            Newsletter Archive
          </h2>
          <p className="mt-4 text-lg tracking-tight text-blue-100">
            Browse our past issues and catch up on what you might have missed.
          </p>
        </div>

        {/* Newsletter Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentNewsletters.map((newsletter) => {
            const metadata = newsletter.metadata || {}
            const totalArticles = (metadata.total_articles || 0) + (metadata.total_secondary_articles || 0)

            // Get first article's image or use override
            const firstArticle = newsletter.articles?.[0]
            const imageUrl = imageOverride || firstArticle?.rss_post?.image_url
            const placeholderSvg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"%3E%3Crect width="800" height="600" fill="%23e5e7eb"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" fill="%239ca3af"%3EAI Accounting Daily%3C/text%3E%3C/svg%3E'

            // Use issue_date for the URL (already in YYYY-MM-DD format)
            const dateForUrl = newsletter.issue_date

            return (
              <Link key={newsletter.id} href={`/newsletter/${dateForUrl}`}>
                <div className="group cursor-pointer bg-white rounded-2xl p-1 shadow-xl shadow-slate-900/10 hover:shadow-2xl hover:shadow-slate-900/20 transition-shadow h-full flex flex-col">
                  {/* Image */}
                  <div className="overflow-hidden rounded-xl">
                    <div className="relative w-full h-48 bg-slate-100 overflow-hidden">
                      <img
                        src={imageUrl || placeholderSvg}
                        alt={firstArticle?.headline || newsletter.subject_line}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          // Fallback to placeholder if image fails to load
                          e.currentTarget.src = placeholderSvg
                        }}
                      />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="px-5 pt-5 pb-5 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(newsletter.issue_date)}</span>
                    </div>

                    <h3 className="text-base font-semibold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors leading-tight flex-1">
                      {newsletter.subject_line}
                    </h3>

                    {/* Content Stats */}
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {totalArticles > 0 && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {totalArticles} {totalArticles === 1 ? 'article' : 'articles'}
                        </span>
                      )}
                      {metadata.has_ai_apps && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                          </svg>
                          AI Apps
                        </span>
                      )}
                      {metadata.has_prompt && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          AI Prompt
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12">
            <button
              className="px-3 py-2 text-sm text-blue-100 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
            >
              First
            </button>
            <button
              className="flex items-center px-3 py-2 text-sm text-blue-100 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </button>

            <div className="flex items-center gap-2">
              {getPageNumbers().map((page) => (
                <button
                  key={page}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? "bg-white text-blue-600"
                      : "text-white hover:bg-white/10"
                  }`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              className="flex items-center px-3 py-2 text-sm text-white hover:text-white/80 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
            <button
              className="px-3 py-2 text-sm text-white hover:text-white/80 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
            >
              Last
            </button>
          </div>
        )}
      </Container>
    </section>
  )
}
