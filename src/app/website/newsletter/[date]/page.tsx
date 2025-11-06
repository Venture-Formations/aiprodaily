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

// Helper function to clean MailerLite merge tags for website display
function cleanMergeTags(text: string): string {
  // Replace {$name|default:'Accounting Pro'} with "Accounting Pro"
  return text.replace(/\{\$name\|default:"([^"]+)"\}/g, '$1')
    // Handle other merge tag patterns if needed
    .replace(/\{\$[^}]+\}/g, '') // Remove any other merge tags
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

  // Fetch settings and sections from database
  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .in('key', ['website_header_url', 'logo_url', 'newsletter_name', 'business_name', 'primary_color'])

  const { data: sections } = await supabaseAdmin
    .from('newsletter_sections')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  const headerImageUrl = settings?.find(s => s.key === 'website_header_url')?.value || '/logo.png'
  const logoUrl = settings?.find(s => s.key === 'logo_url')?.value || '/logo.png'
  const newsletterName = settings?.find(s => s.key === 'newsletter_name')?.value || 'AI Accounting Daily'
  const businessName = settings?.find(s => s.key === 'business_name')?.value || 'AI Accounting Daily'
  const primaryColor = settings?.find(s => s.key === 'primary_color')?.value || '#1877F2'
  const currentYear = new Date().getFullYear()

  const formattedDate = new Date(newsletter.campaign_date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const articles = newsletter.articles || []
  const secondaryArticles = newsletter.secondary_articles || []
  const aiApps = newsletter.sections?.ai_apps || []
  const poll = newsletter.sections?.poll
  const roadWork = newsletter.sections?.road_work
  const welcome = newsletter.sections?.welcome

  // Section IDs for stable matching
  const SECTION_IDS = {
    AI_APPLICATIONS: '853f8d0b-bc76-473a-bfc6-421418266222',
    PROMPT_IDEAS: 'a917ac63-6cf0-428b-afe7-60a74fbf160b'
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Header logoUrl={headerImageUrl} />

      {/* Content */}
      <section className="pt-20 py-10 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <Link
            href="/"
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

          {/* Render sections in database order */}
          {sections && sections.map((section: any) => {
            // Welcome Section
            if (section.name === 'Welcome' && welcome && (welcome.intro || welcome.tagline || welcome.summary)) {
              return (
                <div key={section.id} className="bg-white rounded-xl shadow-sm p-6 sm:p-8 mb-6">
                  <h2 className="text-2xl font-bold mb-6 inline-block px-3 py-1.5 rounded-md text-white" style={{ backgroundColor: primaryColor }}>{section.name}</h2>
                  <div className="space-y-3">
                    <div className="text-[#1D1D1F] leading-relaxed">
                      Hey, Accounting Pros!
                    </div>
                    {welcome.tagline && (
                      <div className="text-[#1D1D1F] leading-relaxed font-bold whitespace-pre-wrap">
                        {cleanMergeTags(welcome.tagline)}
                      </div>
                    )}
                    {welcome.summary && (
                      <div className="text-[#1D1D1F] leading-relaxed whitespace-pre-wrap">
                        {cleanMergeTags(welcome.summary)}
                      </div>
                    )}
                  </div>
                </div>
              )
            }

            // Primary Articles Section (display_order 3)
            if (section.display_order === 3 && articles.length > 0) {
              return (
                <div key={section.id} className="bg-white rounded-xl shadow-sm p-6 sm:p-8 mb-6">
                  <h2 className="text-2xl font-bold mb-6 inline-block px-3 py-1.5 rounded-md text-white" style={{ backgroundColor: primaryColor }}>{section.name}</h2>
                  <div className="space-y-8">
                    {articles.map((article: any, index: number) => (
                      <article key={article.id} className="border-b border-gray-200 last:border-0 pb-8 last:pb-0">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-8 h-8 bg-[#1c293d] text-white rounded-full flex items-center justify-center font-bold text-sm">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] mb-3">
                              {article.headline}
                            </h3>

                            <div className="text-[#1D1D1F]/80 leading-relaxed mb-4 whitespace-pre-wrap">
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
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )
            }

            // Secondary Articles Section (display_order 5)
            if (section.display_order === 5 && secondaryArticles.length > 0) {
              return (
                <div key={section.id} className="bg-white rounded-xl shadow-sm p-6 sm:p-8 mb-6">
                  <h2 className="text-2xl font-bold mb-6 inline-block px-3 py-1.5 rounded-md text-white" style={{ backgroundColor: primaryColor }}>{section.name}</h2>
                  <div className="space-y-8">
                    {secondaryArticles.map((article: any, index: number) => (
                      <article key={article.id} className="border-b border-gray-200 last:border-0 pb-8 last:pb-0">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-8 h-8 bg-[#1c293d] text-white rounded-full flex items-center justify-center font-bold text-sm">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] mb-3">
                              {article.headline}
                            </h3>

                            <div className="text-[#1D1D1F]/80 leading-relaxed mb-4 whitespace-pre-wrap">
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
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )
            }

            // AI Applications Section (by ID)
            if (section.id === SECTION_IDS.AI_APPLICATIONS && aiApps.length > 0) {
              return (
                <div key={section.id} className="bg-white rounded-xl shadow-sm p-6 sm:p-8 mb-6">
                  <h2 className="text-2xl font-bold mb-6 inline-block px-3 py-1.5 rounded-md text-white" style={{ backgroundColor: primaryColor }}>{section.name}</h2>
                  <div className="space-y-3">
                    {aiApps.map((item: any, index: number) => {
                      const app = item.app
                      return (
                        <div
                          key={app.id}
                          className="border-b border-gray-200 last:border-0 pb-3 last:pb-0 text-base leading-relaxed"
                        >
                          <strong>{index + 1}.</strong> {app.app_url ? (
                            <a
                              href={app.app_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#a855f7] hover:text-[#a855f7]/80 underline font-bold"
                            >
                              {app.app_name}
                            </a>
                          ) : (
                            <span className="font-bold">{app.app_name}</span>
                          )} - {app.description || app.tagline || 'AI-powered application'}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            }

            // Prompt Ideas Section (by ID)
            if (section.id === SECTION_IDS.PROMPT_IDEAS && newsletter.sections?.prompt) {
              const prompt = newsletter.sections.prompt
              return (
                <div key={section.id} className="bg-white rounded-xl shadow-sm p-6 sm:p-8 mb-6">
                  <h2 className="text-2xl font-bold mb-6 inline-block px-3 py-1.5 rounded-md text-white" style={{ backgroundColor: primaryColor }}>{section.name}</h2>
                  <div className="text-center mb-4">
                    <div className="text-xl font-bold text-[#1D1D1F]">{prompt.title}</div>
                  </div>
                  <div className="bg-black text-white p-4 rounded-md font-mono text-sm leading-relaxed whitespace-pre-wrap border-2 border-gray-800">
                    {prompt.prompt_text}
                  </div>
                </div>
              )
            }

            // Poll Section
            if (section.name === 'Poll' && poll) {
              return (
                <div key={section.id} className="bg-white rounded-xl shadow-sm p-6 sm:p-8 mb-6">
                  <h2 className="text-2xl font-bold mb-6 inline-block px-3 py-1.5 rounded-md text-white" style={{ backgroundColor: primaryColor }}>{section.name}</h2>
                  <div className="text-xl font-bold text-center text-[#1D1D1F] mb-4">{poll.question}</div>
                  <p className="text-[#1D1D1F]/60 text-sm text-center">
                    This poll was available in the email newsletter.
                  </p>
                </div>
              )
            }

            // Road Work Section
            if (section.name === 'Road Work' && roadWork) {
              return (
                <div key={section.id} className="bg-white rounded-xl shadow-sm p-6 sm:p-8 mb-6">
                  <h2 className="text-2xl font-bold mb-6 inline-block px-3 py-1.5 rounded-md text-white" style={{ backgroundColor: primaryColor }}>{section.name}</h2>
                  <div className="space-y-3">
                    {roadWork.items && roadWork.items.map((item: any, index: number) => (
                      <div key={index} className="border-b border-gray-200 last:border-0 pb-3 last:pb-0">
                        <div className="font-bold text-[#1D1D1F]">{item.title}</div>
                        <div className="text-[#1D1D1F]/80 text-sm mt-1">{item.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }

            return null
          })}
        </div>
      </section>

      <Footer logoUrl={logoUrl} newsletterName={newsletterName} businessName={businessName} currentYear={currentYear} />
    </div>
  )
}
