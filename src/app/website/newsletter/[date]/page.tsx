import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { newsletterArchiver } from '@/lib/newsletter-archiver'
import type { ArchivedNewsletter } from '@/types/database'
import { Header } from "@/components/salient/Header"
import { Footer } from "@/components/salient/Footer"
import { Container } from "@/components/salient/Container"
import { supabaseAdmin } from "@/lib/supabase"
import { headers } from 'next/headers'
import { getPublicationByDomain, getPublicationSettings } from '@/lib/publication-settings'

interface PageProps {
  params: Promise<{ date: string }>
}

// Helper function to clean email merge tags for website display
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

  // Parse date as local date to avoid timezone offset issues
  const [year, month, day] = newsletter.issue_date.split('-').map(Number)
  const formattedDate = new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return {
    title: `${newsletter.subject_line} - AI Accounting Daily`,
    description: `AI Accounting Daily newsletter from ${formattedDate}`,
    openGraph: {
      title: newsletter.subject_line,
      description: `AI Accounting Daily newsletter from ${formattedDate}`,
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

  // Get domain from headers (Next.js 15 requires await)
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'aiaccountingdaily.com'

  // Get publication ID from domain
  const publicationId = await getPublicationByDomain(host) || 'accounting'

  // Fetch settings from publication_settings
  const settings = await getPublicationSettings(publicationId, [
    'website_header_url',
    'logo_url',
    'newsletter_name',
    'business_name'
  ])

  const { data: sections } = await supabaseAdmin
    .from('newsletter_sections')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  const headerImageUrl = settings.website_header_url || '/logo.png'
  const logoUrl = settings.logo_url || '/logo.png'
  const newsletterName = settings.newsletter_name || 'AI Accounting Daily'
  const businessName = settings.business_name || 'AI Accounting Daily'
  const currentYear = new Date().getFullYear()

  // Parse date as local date to avoid timezone offset issues
  const [year, month, day] = newsletter.issue_date.split('-').map(Number)
  const formattedDate = new Date(year, month - 1, day).toLocaleDateString('en-US', {
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
  const advertorial = newsletter.sections?.advertorial
  const adModules = newsletter.sections?.ad_modules || []
  const pollModules = newsletter.sections?.poll_modules || []

  // Section IDs for stable matching
  const SECTION_IDS = {
    AI_APPLICATIONS: '853f8d0b-bc76-473a-bfc6-421418266222',
    PROMPT_IDEAS: 'a917ac63-6cf0-428b-afe7-60a74fbf160b',
    ADVERTISEMENT: 'c0bc7173-de47-41b2-a260-77f55525ee3d'
  }

  // Combine all renderable items and sort by display_order
  type RenderItem =
    | { type: 'section'; data: any; display_order: number }
    | { type: 'ad_module'; data: any; display_order: number }
    | { type: 'poll_module'; data: any; display_order: number }

  const allRenderItems: RenderItem[] = [
    // Newsletter sections (excluding Advertisement and AI Applications which are handled by modules)
    ...(sections || [])
      .filter((s: any) => s.id !== SECTION_IDS.ADVERTISEMENT && s.id !== SECTION_IDS.AI_APPLICATIONS)
      .map((s: any) => ({ type: 'section' as const, data: s, display_order: s.display_order ?? 999 })),
    // Ad modules
    ...adModules.map((m: any) => ({ type: 'ad_module' as const, data: m, display_order: m.display_order ?? 999 })),
    // Poll modules
    ...pollModules.map((m: any) => ({ type: 'poll_module' as const, data: m, display_order: m.display_order ?? 999 }))
  ].sort((a, b) => a.display_order - b.display_order)

  // Process advertorial body to make last sentence or arrow CTA a hyperlink (like email template)
  const processAdvertorialBody = (body: string, url: string) => {
    if (!url || url === '#' || !body) return body

    let processedBody = body

    // Check for arrow CTA pattern in paragraph format (e.g., "→ Try Fiskl")
    // Pattern handles: <p><strong>→ Try Fiskl</strong></p> or plain "→ Try Fiskl"
    const arrowCtaPattern = /(<(?:strong|b)[^>]*>)?(→\s*)([^<\n]+?)(<\/(?:strong|b)>)?(\s*<\/p>)?(\s*)$/i
    const arrowMatch = processedBody.match(arrowCtaPattern)

    if (arrowMatch) {
      // Found arrow CTA pattern - make arrow bold, text after arrow is the link
      const openingTag = arrowMatch[1] || '' // "<strong>" or "<b>" if present
      const arrow = arrowMatch[2] // "→ "
      const ctaText = arrowMatch[3].trim() // "Try Fiskl"
      const closingStrongTag = arrowMatch[4] || '' // "</strong>" or "</b>" if present
      const closingPTag = arrowMatch[5] || '' // "</p>" if present
      const trailingSpace = arrowMatch[6] || ''

      return processedBody.replace(
        arrowCtaPattern,
        `${openingTag}${arrow}${closingStrongTag || '</strong>'}<a href="${url}" target="_blank" rel="noopener noreferrer" style="text-decoration: underline; font-weight: bold;">${ctaText}</a>${closingPTag}${trailingSpace}`
      )
    }

    // No arrow CTA - use last-sentence logic (matching email template approach)
    // Strip HTML to get plain text
    const plainText = processedBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    // Find all sentence-ending punctuation marks (., !, ?)
    // But exclude periods that are part of domains (.com, .ai, .io, etc.) or abbreviations
    const sentenceEndPattern = /[.!?](?=\s+[A-Z]|$)/g
    const matches = Array.from(plainText.matchAll(sentenceEndPattern))

    if (matches.length > 0) {
      // Get the position of the last sentence-ending punctuation
      const lastMatch = matches[matches.length - 1] as RegExpMatchArray
      const lastPeriodIndex = lastMatch.index!

      // Find the second-to-last sentence-ending punctuation
      let startIndex = 0
      if (matches.length > 1) {
        const secondLastMatch = matches[matches.length - 2] as RegExpMatchArray
        startIndex = secondLastMatch.index! + 1
      }

      // Extract the last complete sentence (from after previous punctuation to end, including the final punctuation)
      const lastSentence = plainText.substring(startIndex, lastPeriodIndex + 1).trim()

      if (lastSentence.length > 5) {
        // Escape special regex characters
        const escapedSentence = lastSentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

        // Replace in the original HTML
        // Look for the sentence text, accounting for HTML tags that might be in between
        const parts = escapedSentence.split(/\s+/)
        const flexiblePattern = parts.join('\\s*(?:<[^>]*>\\s*)*')
        const sentenceRegex = new RegExp(flexiblePattern, 'i')

        return processedBody.replace(
          sentenceRegex,
          `<a href="${url}" target="_blank" rel="noopener noreferrer" style="text-decoration: underline; font-weight: bold;">$&</a>`
        )
      }
    } else {
      // No sentence-ending punctuation found - wrap the entire text
      const trimmedText = plainText.trim()
      if (trimmedText.length > 5) {
        const escapedText = trimmedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const parts = escapedText.split(/\s+/)
        const flexiblePattern = parts.join('\\s*(?:<[^>]*>\\s*)*')
        const textRegex = new RegExp(flexiblePattern, 'i')

        return processedBody.replace(
          textRegex,
          `<a href="${url}" target="_blank" rel="noopener noreferrer" style="text-decoration: underline; font-weight: bold;">$&</a>`
        )
      }
    }

    return body
  }

  // JSON-LD structured data for NewsArticle
  const newsArticleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": newsletter.subject_line,
    "datePublished": newsletter.send_date,
    "dateModified": newsletter.send_date,
    "author": {
      "@type": "Organization",
      "name": "AI Accounting Daily"
    },
    "publisher": {
      "@type": "Organization",
      "name": "AI Accounting Daily",
      "logo": {
        "@type": "ImageObject",
        "url": "https://aiaccountingdaily.com/logo.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://aiaccountingdaily.com/newsletter/${date}`
    },
    "description": `AI Accounting Daily newsletter from ${formattedDate}`
  }

  return (
    <main className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(newsArticleSchema) }}
      />
      <Header logoUrl={headerImageUrl} />

      {/* Page Header - Full width blue section with cloud effect */}
      <section className="relative overflow-hidden bg-blue-600 py-8">
        {/* Cloud effect background image */}
        <img
          src="/images/background-call-to-action.jpg"
          alt=""
          className="absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
          width={2347}
          height={1244}
        />
        <Container className="relative">
          <div className="mx-auto max-w-4xl">
            <Link
              href="/"
              className="text-sm text-blue-100 hover:text-white mb-4 inline-flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </Link>
            <h1 className="font-display text-3xl tracking-tight text-white sm:text-4xl mt-4">
              {newsletter.subject_line}
            </h1>
            <p className="mt-2 text-blue-100">{formattedDate}</p>
          </div>
        </Container>
      </section>

      {/* Content */}
      <section className="py-12">
        <Container>
          <div className="mx-auto max-w-4xl">
          {/* Render all items in display_order (sections, ad modules, poll modules combined) */}
          {allRenderItems.map((item) => {
            // Render newsletter sections
            if (item.type === 'section') {
              const section = item.data

              // Welcome Section
              if (section.section_type === 'welcome' && welcome && (welcome.intro || welcome.tagline || welcome.summary)) {
                return (
                  <div key={section.id} className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6 ring-1 ring-slate-200">
                    <div className="p-6 sm:p-8">
                    {/* Cover Image */}
                    <div className="mb-4">
                      <img
                        src="/images/accounting_website/ai_accounting_daily_cover_image.jpg"
                        alt="AI Accounting Daily"
                        className="mx-auto max-w-full rounded-lg"
                        style={{ maxHeight: '400px' }}
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="text-slate-900 leading-relaxed">
                        Hey, Accounting Pros!
                      </div>
                      {welcome.tagline && (
                        <div className="text-slate-900 leading-relaxed font-bold whitespace-pre-wrap">
                          {cleanMergeTags(welcome.tagline)}
                        </div>
                      )}
                      {welcome.summary && (
                        <div className="text-slate-900 leading-relaxed whitespace-pre-wrap">
                          {cleanMergeTags(welcome.summary)}
                        </div>
                      )}
                    </div>
                    </div>
                  </div>
                )
              }

              // Primary Articles Section
              if (section.section_type === 'primary_articles' && articles.length > 0) {
                return (
                  <div key={section.id} className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
                    <h2 className="text-2xl font-bold py-3 px-6 sm:px-8 bg-slate-800 text-white">{section.name}</h2>
                    <div className="p-6 sm:p-8">
                    <div className="space-y-8">
                      {articles.map((article: any, index: number) => (
                        <article key={article.id} className="border-b border-slate-200 last:border-0 pb-8 last:pb-0">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-slate-800 text-white rounded-full flex items-center justify-center font-bold text-sm">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3">
                                {article.headline}
                              </h3>

                              <div className="text-slate-900/80 leading-relaxed mb-4 whitespace-pre-wrap">
                                {article.content}
                              </div>

                              {article.rss_post?.source_url && (
                                <a
                                  href={article.rss_post.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-500 text-sm font-medium inline-flex items-center gap-1"
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
                  </div>
                )
              }

              // Secondary Articles Section
              if (section.section_type === 'secondary_articles' && secondaryArticles.length > 0) {
                return (
                  <div key={section.id} className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
                    <h2 className="text-2xl font-bold py-3 px-6 sm:px-8 bg-slate-800 text-white">{section.name}</h2>
                    <div className="p-6 sm:p-8">
                    <div className="space-y-8">
                      {secondaryArticles.map((article: any, index: number) => (
                        <article key={article.id} className="border-b border-slate-200 last:border-0 pb-8 last:pb-0">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-slate-800 text-white rounded-full flex items-center justify-center font-bold text-sm">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3">
                                {article.headline}
                              </h3>

                              <div className="text-slate-900/80 leading-relaxed mb-4 whitespace-pre-wrap">
                                {article.content}
                              </div>

                              {article.rss_post?.source_url && (
                                <a
                                  href={article.rss_post.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-500 text-sm font-medium inline-flex items-center gap-1"
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
                  </div>
                )
              }

              // Prompt Ideas Section (by ID)
              if (section.id === SECTION_IDS.PROMPT_IDEAS && newsletter.sections?.prompt) {
                const prompt = newsletter.sections.prompt
                return (
                  <div key={section.id} className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
                    <h2 className="text-2xl font-bold py-3 px-6 sm:px-8 bg-slate-800 text-white">{section.name}</h2>
                    <div className="p-6 sm:p-8">
                    <div className="text-center mb-4">
                      <div className="text-xl font-bold text-slate-900">{prompt.title}</div>
                    </div>
                    <div className="bg-black text-white p-4 rounded-md font-mono text-sm leading-relaxed whitespace-pre-wrap border-2 border-gray-800">
                      {prompt.prompt_text}
                    </div>
                    </div>
                  </div>
                )
              }

              // Poll Section (legacy)
              if (section.section_type === 'poll' && poll) {
                return (
                  <div key={section.id} className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
                    <h2 className="text-2xl font-bold py-3 px-6 sm:px-8 bg-slate-800 text-white">{section.name}</h2>
                    <div className="p-6 sm:p-8">
                    <div className="text-xl font-bold text-center text-slate-900 mb-4">{poll.question}</div>
                    <p className="text-slate-900/60 text-sm text-center">
                      This poll was available in the email newsletter.
                    </p>
                    </div>
                  </div>
                )
              }

              // Road Work Section
              if (section.name === 'Road Work' && roadWork) {
                return (
                  <div key={section.id} className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
                    <h2 className="text-2xl font-bold py-3 px-6 sm:px-8 bg-slate-800 text-white">{section.name}</h2>
                    <div className="p-6 sm:p-8">
                    <div className="space-y-3">
                      {roadWork.items && roadWork.items.map((item: any, index: number) => (
                        <div key={index} className="border-b border-slate-200 last:border-0 pb-3 last:pb-0">
                          <div className="font-bold text-slate-900">{item.title}</div>
                          <div className="text-slate-900/80 text-sm mt-1">{item.description}</div>
                        </div>
                      ))}
                    </div>
                    </div>
                  </div>
                )
              }

              return null
            }

            // Render Ad Modules
            if (item.type === 'ad_module') {
              const adModule = item.data
              const ad = adModule.ad
              if (!ad) return null

              const blockOrder: string[] = adModule.block_order || ['title', 'image', 'body', 'button']

              return (
                <div key={`ad-${adModule.module_name}`} className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
                  <h2 className="text-2xl font-bold py-3 px-6 sm:px-8 bg-slate-800 text-white">{adModule.module_name}</h2>
                  <div className="p-6 sm:p-8">
                    <div className="text-center">
                      {blockOrder.map((blockType: string) => {
                        switch (blockType) {
                          case 'title':
                            return ad.title ? (
                              <h3 key="title" className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">{ad.title}</h3>
                            ) : null
                          case 'image':
                            if (!ad.image_url) return null
                            return ad.button_url ? (
                              <div key="image" className="mb-4">
                                <a href={ad.button_url} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={ad.image_url}
                                    alt={ad.title || adModule.module_name}
                                    className="mx-auto max-w-full rounded-lg hover:opacity-90 transition-opacity"
                                    style={{ maxHeight: '400px' }}
                                  />
                                </a>
                              </div>
                            ) : (
                              <div key="image" className="mb-4">
                                <img
                                  src={ad.image_url}
                                  alt={ad.title || adModule.module_name}
                                  className="mx-auto max-w-full rounded-lg"
                                  style={{ maxHeight: '400px' }}
                                />
                              </div>
                            )
                          case 'body':
                            return ad.body ? (
                              <div
                                key="body"
                                className="text-slate-900 leading-relaxed text-left prose prose-sm max-w-none mb-4 [&_a]:underline"
                                dangerouslySetInnerHTML={{ __html: ad.body }}
                              />
                            ) : null
                          case 'button':
                            return ad.button_url ? (
                              <div key="button" className="mt-4">
                                <a
                                  href={ad.button_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-block px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                  {ad.button_text || 'Learn More'}
                                </a>
                              </div>
                            ) : null
                          default:
                            return null
                        }
                      })}
                      {adModule.advertiser?.company_name && (
                        <div className="mt-4 text-xs text-slate-500">
                          Sponsored by {adModule.advertiser.company_name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            }

            // Render Poll Modules
            if (item.type === 'poll_module') {
              const pollModule = item.data
              const modulePoll = pollModule.poll
              if (!modulePoll) return null

              const blockOrder: string[] = pollModule.block_order || ['title', 'question', 'image', 'options']

              return (
                <div key={`poll-${pollModule.module_name}`} className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
                  <h2 className="text-2xl font-bold py-3 px-6 sm:px-8 bg-purple-600 text-white">{pollModule.module_name}</h2>
                  <div className="p-6 sm:p-8">
                    <div className="text-center">
                      {blockOrder.map((blockType: string) => {
                        switch (blockType) {
                          case 'title':
                            return modulePoll.title ? (
                              <h3 key="title" className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">{modulePoll.title}</h3>
                            ) : null
                          case 'question':
                            return modulePoll.question ? (
                              <div key="question" className="text-lg text-slate-700 mb-4">{modulePoll.question}</div>
                            ) : null
                          case 'image':
                            if (!modulePoll.image_url) return null
                            return (
                              <div key="image" className="mb-4">
                                <img
                                  src={modulePoll.image_url}
                                  alt={modulePoll.title || pollModule.module_name}
                                  className="mx-auto max-w-full rounded-lg"
                                  style={{ maxHeight: '400px' }}
                                />
                              </div>
                            )
                          case 'options':
                            return modulePoll.options && modulePoll.options.length > 0 ? (
                              <div key="options" className="mt-4">
                                <div className="text-sm text-slate-500 mb-2">Poll options:</div>
                                <div className="flex flex-wrap justify-center gap-2">
                                  {modulePoll.options.map((option: string, idx: number) => (
                                    <span
                                      key={idx}
                                      className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"
                                    >
                                      {option}
                                    </span>
                                  ))}
                                </div>
                                <div className="mt-4 text-xs text-slate-500">
                                  This poll was available in the email newsletter.
                                </div>
                              </div>
                            ) : null
                          default:
                            return null
                        }
                      })}
                    </div>
                  </div>
                </div>
              )
            }

            return null
          })}

          {/* Fallback: Render advertorial if it exists but wasn't rendered in sections loop */}
          {advertorial && !sections?.some((s: any) => s.id === SECTION_IDS.ADVERTISEMENT) && (() => {
            const processedBody = processAdvertorialBody(advertorial.body, advertorial.button_url)
            return (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
                <h2 className="text-2xl font-bold py-3 px-6 sm:px-8 bg-slate-800 text-white">Presented By</h2>
                <div className="p-6 sm:p-8">
                  <div className="text-center">
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">{advertorial.title}</h3>
                    {advertorial.image_url && advertorial.button_url ? (
                      <div className="mb-4">
                        <a href={advertorial.button_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={advertorial.image_url}
                            alt={advertorial.title}
                            className="mx-auto max-w-full rounded-lg hover:opacity-90 transition-opacity"
                            style={{ maxHeight: '400px' }}
                          />
                        </a>
                      </div>
                    ) : advertorial.image_url ? (
                      <div className="mb-4">
                        <img
                          src={advertorial.image_url}
                          alt={advertorial.title}
                          className="mx-auto max-w-full rounded-lg"
                          style={{ maxHeight: '400px' }}
                        />
                      </div>
                    ) : null}
                    <div
                      className="text-slate-900 leading-relaxed text-left prose prose-sm max-w-none [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-none [&_ol]:pl-0 [&_li]:mb-1 [&_ol_li[data-list='bullet']]:pl-6 [&_ol_li[data-list='bullet']]:relative [&_ol_li[data-list='bullet']]:before:content-['•'] [&_ol_li[data-list='bullet']]:before:absolute [&_ol_li[data-list='bullet']]:before:left-0 [&_ol]:counter-reset-[item] [&_ol_li[data-list='ordered']]:pl-6 [&_ol_li[data-list='ordered']]:relative [&_ol_li[data-list='ordered']]:before:content-[counter(item)_'.'] [&_ol_li[data-list='ordered']]:before:absolute [&_ol_li[data-list='ordered']]:before:left-0 [&_ol_li[data-list='ordered']]:counter-increment-[item]"
                      dangerouslySetInnerHTML={{ __html: processedBody }}
                    />
                  </div>
                </div>
              </div>
            )
          })()}
          </div>
        </Container>
      </section>

      <Footer logoUrl={logoUrl} newsletterName={newsletterName} businessName={businessName} currentYear={currentYear} />
    </main>
  )
}
