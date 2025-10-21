import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { newsletterArchiver } from '@/lib/newsletter-archiver'
import type { ArchivedNewsletter } from '@/types/database'
import { Header } from "@/components/website/header"
import { Footer } from "@/components/website/footer"
import { supabaseAdmin } from "@/lib/supabase"

interface PageProps {
  params: Promise<{ date: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params
  const newsletter = await newsletterArchiver.getArchivedNewsletter(date)

  if (!newsletter) {
    return {
      title: 'Newsletter Not Found'
    }
  }

  return {
    title: `${newsletter.subject_line} - AI Accounting Daily`,
    description: `AI Accounting Daily newsletter from ${new Date(newsletter.campaign_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
    openGraph: {
      title: newsletter.subject_line,
      description: `AI Accounting Daily newsletter from ${new Date(newsletter.campaign_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
      type: 'article',
      publishedTime: newsletter.send_date,
    }
  }
}

export default async function NewsletterPage({ params }: PageProps) {
  const { date } = await params
  const newsletter = await newsletterArchiver.getArchivedNewsletter(date)

  if (!newsletter) {
    notFound()
  }

  // Fetch header image from settings
  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'website_header_url')
    .single()

  const headerImageUrl = settings?.value || '/logo.png'

  const formattedDate = new Date(newsletter.campaign_date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const articles = newsletter.articles || []
  const aiApps = newsletter.sections?.ai_apps || []

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Header logoUrl={headerImageUrl} />

      {/* Content */}
      <section className="pt-20 py-10 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <Link
            href="/newsletters"
            className="text-sm text-[#a855f7] hover:text-[#a855f7]/80 mb-4 inline-block"
          >
            ← Back to Newsletter Archive
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-[#1D1D1F] mb-2">
              {newsletter.subject_line}
            </h1>
            <p className="text-[#1D1D1F]/60">{formattedDate}</p>
          </div>

          {/* Articles */}
          {articles.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 mb-6">
              <h2 className="text-2xl font-bold text-[#1D1D1F] mb-6">Top Stories</h2>
              <div className="space-y-8">
                {articles.map((article: any, index: number) => (
                  <article key={article.id} className="border-b border-border last:border-0 pb-8 last:pb-0">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-[#1c293d] text-white rounded-full flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] mb-3">
                          {article.headline}
                        </h3>

                        <div className="prose prose-lg max-w-none text-[#1D1D1F]/80 leading-relaxed mb-4">
                          {article.content}
                        </div>

                        {article.rss_post?.source_url && (
                          <a
                            href={article.rss_post.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#a855f7] hover:text-[#a855f7]/80 text-sm font-medium inline-flex items-center gap-1"
                          >
                            Read full story
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}

                        {article.rss_post?.author && (
                          <p className="text-sm text-[#1D1D1F]/60 mt-2">
                            By {article.rss_post.author}
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* AI Apps Section */}
          {aiApps.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 mb-6">
              <h2 className="text-2xl font-bold text-[#1D1D1F] mb-6">Featured AI Apps</h2>
              <div className="grid gap-6 md:grid-cols-2">
                {aiApps.map((item: any) => {
                  const app = item.app
                  return (
                    <div
                      key={app.id}
                      className={`border rounded-lg p-4 ${item.is_featured ? 'border-[#a855f7] bg-purple-50' : 'border-border'}`}
                    >
                      {item.is_featured && (
                        <span className="inline-block bg-[#a855f7] text-white text-xs font-semibold px-2 py-1 rounded mb-2">
                          FEATURED
                        </span>
                      )}

                      <h3 className="font-bold text-lg text-[#1D1D1F] mb-2">
                        {app.app_name}
                      </h3>

                      {app.tagline && (
                        <p className="text-[#1D1D1F]/70 text-sm mb-3">
                          {app.tagline}
                        </p>
                      )}

                      {app.description && (
                        <p className="text-[#1D1D1F]/70 text-sm mb-3">
                          {app.description}
                        </p>
                      )}

                      {app.app_url && (
                        <a
                          href={app.app_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-block text-[#a855f7] hover:text-[#a855f7]/80 text-sm font-medium"
                        >
                          Learn More →
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Footer CTA */}
          <div className="text-center py-8 border-t border-border bg-white rounded-xl px-6">
            <p className="text-[#1D1D1F]/60 mb-4">
              This is an archived edition of the AI Accounting Daily newsletter.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/newsletters"
                className="text-[#a855f7] hover:text-[#a855f7]/80 font-medium"
              >
                View All Newsletters
              </Link>
              <Link
                href="/website"
                className="text-[#a855f7] hover:text-[#a855f7]/80 font-medium"
              >
                Subscribe Today
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
