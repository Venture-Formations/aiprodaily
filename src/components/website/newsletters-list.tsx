'use client'

import { useState } from 'react'
import { Card } from "@/components/website/ui/card"
import { Button } from "@/components/website/ui/button"
import { Calendar, ChevronLeft, ChevronRight, Mail } from "lucide-react"
import Link from 'next/link'

const NEWSLETTERS_PER_PAGE = 6

interface Newsletter {
  id: string
  campaign_date: string
  subject_line: string
  send_date: string
  metadata?: {
    total_articles?: number
    total_secondary_articles?: number
    has_road_work?: boolean
    has_ai_apps?: boolean
    has_poll?: boolean
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
}

export function NewslettersList({ newsletters }: NewslettersListProps) {
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
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (newsletters.length === 0) {
    return (
      <section id="newsletters" className="py-10 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="bg-white rounded-xl border border-border shadow-sm p-12 text-center">
            <Mail className="mx-auto h-12 w-12 text-[#1D1D1F]/40 mb-4" />
            <h3 className="text-xl font-semibold text-[#1D1D1F] mb-2">
              No Newsletters Archived Yet
            </h3>
            <p className="text-[#1D1D1F]/60 mb-6">
              Past newsletter editions will appear here once they are sent.
            </p>
            <Link href="/website">
              <Button className="bg-[#1c293d] hover:bg-[#1c293d]/90 text-white">
                Go to Homepage
              </Button>
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="newsletters" className="py-10 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-6xl">
        {/* Newsletter Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentNewsletters.map((newsletter) => {
            const metadata = newsletter.metadata || {}
            const totalArticles = (metadata.total_articles || 0) + (metadata.total_secondary_articles || 0)

            // Get first article's image
            const firstArticle = newsletter.articles?.[0]
            const imageUrl = firstArticle?.rss_post?.image_url
            const placeholderSvg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"%3E%3Crect width="800" height="600" fill="%23e5e7eb"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" fill="%239ca3af"%3EAI Accounting Daily%3C/text%3E%3C/svg%3E'

            return (
              <Link key={newsletter.id} href={`/website/newsletter/${newsletter.campaign_date}`}>
                <Card className="group cursor-pointer hover:shadow-lg transition-shadow overflow-hidden p-0 bg-white border-border h-full flex flex-col">
                  {/* Image */}
                  <div className="relative w-full h-48 bg-gray-100 overflow-hidden">
                    <img
                      src={imageUrl || placeholderSvg}
                      alt={firstArticle?.headline || newsletter.subject_line}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        // Fallback to placeholder if image fails to load
                        e.currentTarget.src = placeholderSvg
                      }}
                    />
                  </div>

                  {/* Content */}
                  <div className="px-4 pt-4 pb-4 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 text-xs text-[#1D1D1F]/60 mb-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(newsletter.send_date)}</span>
                    </div>

                    <h3 className="text-base font-bold text-[#1D1D1F] mb-2 group-hover:text-[#a855f7] transition-colors leading-tight flex-1">
                      {newsletter.subject_line}
                    </h3>

                    {/* Content Stats */}
                    <div className="flex items-center gap-3 text-xs text-[#1D1D1F]/70">
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
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-[#1D1D1F]/40 hover:text-[#1D1D1F]/60 hover:bg-transparent"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
            >
              First
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-[#1D1D1F]/40 hover:text-[#1D1D1F]/60 hover:bg-transparent"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              {getPageNumbers().map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "ghost"}
                  size="sm"
                  className={`w-10 h-10 rounded-lg ${
                    currentPage === page
                      ? "bg-[#1c293d] text-white hover:bg-[#1c293d]/90"
                      : "text-[#1D1D1F] hover:bg-white/50"
                  }`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-[#1D1D1F] hover:text-[#1D1D1F]/80 hover:bg-transparent"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-[#1D1D1F] hover:text-[#1D1D1F]/80 hover:bg-transparent"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
            >
              Last
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
