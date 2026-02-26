import { Header } from "@/components/salient/Header"
import { Hero } from "@/components/salient/Hero"
import { Footer } from "@/components/salient/Footer"
import { LatestNewsList } from "@/components/website/latest-news-list"
import { supabaseAdmin } from "@/lib/supabase"
import { resolvePublicationFromRequest } from '@/lib/publication-settings'
import { STORAGE_PUBLIC_URL } from '@/lib/config'

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic'

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

export default async function WebsiteHome() {
  const { publicationId, host, settings } = await resolvePublicationFromRequest()

  const headerImageUrl = settings.website_header_url || '/logo.png'
  const logoUrl = settings.logo_url || '/logo.png'
  const newsletterName = settings.newsletter_name || 'Newsletter'
  const businessName = settings.business_name || 'Newsletter'
  const currentYear = new Date().getFullYear()
  const siteUrl = `https://${host}`

  // Newsletter cover image
  const newsletterCoverImage = `${STORAGE_PUBLIC_URL}/img/c/ai_accounting_daily_cover_image.jpg`

  // Fetch newsletters (filtered by publication)
  const { data: newsletters } = await supabaseAdmin
    .from('archived_newsletters')
    .select('issue_date, subject_line, metadata')
    .eq('publication_id', publicationId)
    .order('issue_date', { ascending: false })
    .limit(6)

  // Fetch manual articles (published and used)
  let manualArticles: any[] = []
  try {
    const { data, error } = await supabaseAdmin
      .from('manual_articles')
      .select('slug, title, publish_date, image_url, body, category:article_categories(name)')
      .eq('publication_id', publicationId)
      .in('status', ['published', 'used'])
      .order('publish_date', { ascending: false })
      .limit(6)

    if (error) {
      console.error('[Website] Error fetching manual articles:', error.message)
    } else {
      manualArticles = data || []
    }
  } catch (err) {
    console.error('[Website] Exception fetching manual articles:', err)
  }

  // Combine and format items
  const newsItems: NewsItem[] = []

  // Add newsletters
  newsletters?.forEach(nl => {
    newsItems.push({
      type: 'newsletter',
      slug: nl.issue_date,
      title: nl.subject_line || `Newsletter - ${nl.issue_date}`,
      date: nl.issue_date,
      category: 'Newsletter',
      image_url: newsletterCoverImage,
      metadata: nl.metadata as NewsItem['metadata']
    })
  })

  // Add manual articles
  manualArticles.forEach(article => {
    const bodyText = article.body ? String(article.body).replace(/<[^>]+>/g, '') : ''
    newsItems.push({
      type: 'article',
      slug: article.slug,
      title: article.title,
      date: article.publish_date,
      category: (article.category as any)?.name || 'Article',
      image_url: article.image_url,
      description: bodyText.substring(0, 150) + (bodyText.length > 150 ? '...' : '')
    })
  })

  // Sort all items by date and take latest 6
  newsItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const latestNews = newsItems.slice(0, 6)

  // JSON-LD structured data for WebPage
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": `${newsletterName} - Latest News`,
    "description": `Daily insights, tools, and strategies from ${newsletterName}.`,
    "publisher": {
      "@type": "Organization",
      "name": businessName,
      "url": siteUrl
    }
  }

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <Header logoUrl={headerImageUrl} />
      <Hero />
      {/* Latest News Content */}
      <LatestNewsList
        newsItems={latestNews}
        newsletterName={newsletterName}
      />
      <Footer logoUrl={logoUrl} newsletterName={newsletterName} businessName={businessName} currentYear={currentYear} />
    </main>
  )
}
