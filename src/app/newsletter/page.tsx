import { Metadata } from 'next'
import Link from 'next/link'
import { newsletterArchiver } from '@/lib/newsletter-archiver'

export const metadata: Metadata = {
  title: 'Newsletter Archive - St. Cloud Scoop',
  description: 'Browse past editions of the St. Cloud Scoop newsletter featuring local news, events, and community updates.',
}

export default async function NewsletterArchivePage() {
  const newsletters = await newsletterArchiver.getArchiveList(100)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Newsletter Archive
          </h1>
          <p className="text-lg text-gray-600">
            Browse past editions of the St. Cloud Scoop newsletter
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {newsletters.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No Newsletters Archived Yet
            </h2>
            <p className="text-gray-600 mb-6">
              Past newsletter editions will appear here once they are sent.
            </p>
            <Link
              href="/"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 font-medium"
            >
              Go to Homepage
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-200">
              {newsletters.map((newsletter) => {
                const sendDate = new Date(newsletter.send_date)
                const formattedDate = sendDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })

                const metadata = newsletter.metadata as Record<string, any>
                const totalArticles = metadata?.total_articles || 0
                const totalEvents = metadata?.total_events || 0

                return (
                  <Link
                    key={newsletter.id}
                    href={`/newsletter/${newsletter.campaign_date}`}
                    className="block p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-gray-900 mb-2 hover:text-blue-600 transition-colors">
                          {newsletter.subject_line}
                        </h2>
                        <p className="text-gray-600 mb-3">{formattedDate}</p>

                        {/* Content stats */}
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          {totalArticles > 0 && (
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {totalArticles} {totalArticles === 1 ? 'article' : 'articles'}
                            </span>
                          )}
                          {totalEvents > 0 && (
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {totalEvents} {totalEvents === 1 ? 'event' : 'events'}
                            </span>
                          )}
                          {metadata?.has_road_work && (
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Road work updates
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Arrow icon */}
                      <div className="ml-4 flex-shrink-0">
                        <svg
                          className="w-6 h-6 text-gray-400 group-hover:text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Subscribe CTA */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Don't Miss Future Editions
          </h3>
          <p className="text-gray-600 mb-6">
            Get the St. Cloud Scoop delivered to your inbox every day
          </p>
          <Link
            href="/"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 font-medium text-lg"
          >
            Subscribe Now
          </Link>
        </div>
      </main>
    </div>
  )
}
