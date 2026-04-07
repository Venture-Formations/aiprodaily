import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { newsletterArchiver } from '@/lib/newsletter-archiver'
import { Header } from "@/components/salient/Header"
import { Footer } from "@/components/salient/Footer"
import { Container } from "@/components/salient/Container"
import { supabaseAdmin } from "@/lib/supabase"
import { resolvePublicationFromRequest } from '@/lib/publication-settings'
import { formatLocalDate, buildRenderItems, SECTION_IDS } from './types'
import RenderItemList from './components/RenderItemList'
import AdvertorialSection from './components/AdvertorialSection'

interface PageProps {
  params: Promise<{ date: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params
  const { publicationId, settings } = await resolvePublicationFromRequest()
  const newsletterName = settings.newsletter_name || 'Newsletter'
  const newsletter = await newsletterArchiver.getArchivedNewsletter(date, publicationId)

  if (!newsletter) {
    return { title: 'Newsletter Not Found' }
  }

  const formattedDate = formatLocalDate(newsletter.issue_date)

  return {
    title: `${newsletter.subject_line} - ${newsletterName}`,
    description: `${newsletterName} newsletter from ${formattedDate}`,
    openGraph: {
      title: newsletter.subject_line,
      description: `${newsletterName} newsletter from ${formattedDate}`,
      type: 'article',
      publishedTime: newsletter.send_date,
    }
  }
}

export default async function NewsletterPage({ params }: PageProps) {
  const { date } = await params
  const { publicationId, host, settings } = await resolvePublicationFromRequest()
  const newsletter = await newsletterArchiver.getArchivedNewsletter(date, publicationId)

  if (!newsletter) {
    notFound()
  }

  // Use archived newsletter_sections if available (snapshot at time of send), otherwise fetch live
  let newsletterSectionsConfig = newsletter.sections?.newsletter_sections || null
  if (!newsletterSectionsConfig) {
    const { data: liveSections } = await supabaseAdmin
      .from('newsletter_sections')
      .select('id, newsletter_id, name, display_order, is_active, section_type, description, created_at')
      .eq('newsletter_id', publicationId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    newsletterSectionsConfig = liveSections
  }

  // Settings
  const headerImageUrl = settings.website_header_url || '/logo.png'
  const logoUrl = settings.logo_url || '/logo.png'
  const newsletterName = settings.newsletter_name || 'Newsletter'
  const businessName = settings.business_name || 'Newsletter'
  const currentYear = new Date().getFullYear()
  const siteUrl = `https://${host}`
  const showToolsLink = settings.tools_directory_enabled !== 'false'
  const formattedDate = formatLocalDate(newsletter.issue_date)

  // Extract sections data
  const articles = newsletter.articles || []
  const secondaryArticles = newsletter.secondary_articles || []
  const sections = newsletter.sections || {}
  const aiApps = sections.ai_apps || []
  const poll = sections.poll
  const roadWork = sections.road_work
  const welcome = sections.welcome
  const advertorial = sections.advertorial
  const adModules = sections.ad_modules || []
  const pollModules = sections.poll_modules || []
  const aiAppModules = sections.ai_app_modules || []
  const promptModules = sections.prompt_modules || []
  const articleModules = sections.article_modules || []
  const textBoxModules = sections.text_box_modules || []
  const legacyPrompt = sections.prompt

  // Build sorted render items
  const allRenderItems = buildRenderItems(
    newsletterSectionsConfig,
    adModules,
    pollModules,
    aiAppModules,
    promptModules,
    articleModules,
    textBoxModules,
    aiApps,
    legacyPrompt
  )

  // JSON-LD structured data for NewsArticle
  const newsArticleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": newsletter.subject_line,
    "datePublished": newsletter.send_date,
    "dateModified": newsletter.send_date,
    "author": {
      "@type": "Organization",
      "name": businessName
    },
    "publisher": {
      "@type": "Organization",
      "name": businessName,
      "logo": {
        "@type": "ImageObject",
        "url": logoUrl.startsWith('http') ? logoUrl : `${siteUrl}${logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`}`
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${siteUrl}/newsletter/${date}`
    },
    "description": `${newsletterName} newsletter from ${formattedDate}`
  }

  const hasTextBoxModules = textBoxModules && textBoxModules.length > 0
  const showAdvertorialFallback = advertorial && !newsletterSectionsConfig?.some((s: any) => s.id === SECTION_IDS.ADVERTISEMENT)

  return (
    <main className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(newsArticleSchema) }}
      />
      <Header logoUrl={headerImageUrl} showToolsLink={showToolsLink} />

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
            <RenderItemList
              items={allRenderItems}
              articles={articles}
              secondaryArticles={secondaryArticles}
              welcome={welcome}
              poll={poll}
              roadWork={roadWork}
              hasTextBoxModules={hasTextBoxModules}
            />

            {/* Fallback: Render advertorial if it exists but wasn't rendered in sections loop */}
            {showAdvertorialFallback && <AdvertorialSection advertorial={advertorial} />}
          </div>
        </Container>
      </section>

      <Footer logoUrl={logoUrl} newsletterName={newsletterName} businessName={businessName} currentYear={currentYear} showToolsLink={showToolsLink} />
    </main>
  )
}
