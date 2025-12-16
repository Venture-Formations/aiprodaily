import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Header } from "@/components/salient/Header"
import { Footer } from "@/components/salient/Footer"
import { Container } from "@/components/salient/Container"
import { supabaseAdmin } from "@/lib/supabase"
import { headers } from 'next/headers'
import { getPublicationByDomain, getPublicationSettings } from '@/lib/publication-settings'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params

  const { data: article } = await supabaseAdmin
    .from('manual_articles')
    .select('title, body, image_url, publish_date')
    .eq('slug', slug)
    .in('status', ['published', 'used'])
    .single()

  if (!article) {
    return {
      title: 'Article Not Found'
    }
  }

  // Extract description from body
  const description = article.body.replace(/<[^>]+>/g, '').substring(0, 160) + '...'

  return {
    title: `${article.title} - AI Accounting Daily`,
    description,
    openGraph: {
      title: article.title,
      description,
      type: 'article',
      publishedTime: article.publish_date,
      images: article.image_url ? [{ url: article.image_url }] : []
    }
  }
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params

  // Get domain from headers
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'aiaccountingdaily.com'
  let publicationId: string = await getPublicationByDomain(host) || ''

  // Fallback: if domain lookup fails, get first active publication
  if (!publicationId) {
    const { data: firstPub } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()
    publicationId = firstPub?.id || ''
  }

  // Fetch the article
  const { data: article, error } = await supabaseAdmin
    .from('manual_articles')
    .select(`
      id,
      title,
      slug,
      body,
      image_url,
      publish_date,
      category:article_categories(id, name, slug)
    `)
    .eq('slug', slug)
    .eq('publication_id', publicationId)
    .in('status', ['published', 'used'])
    .single()

  if (error || !article) {
    notFound()
  }

  // Fetch settings
  const settings = await getPublicationSettings(publicationId, [
    'website_header_url',
    'logo_url',
    'newsletter_name',
    'business_name'
  ])

  const headerImageUrl = settings.website_header_url || '/logo.png'
  const logoUrl = settings.logo_url || '/logo.png'
  const newsletterName = settings.newsletter_name || 'AI Accounting Daily'
  const businessName = settings.business_name || 'AI Accounting Daily'
  const currentYear = new Date().getFullYear()

  // Format date
  const [year, month, day] = article.publish_date.split('-').map(Number)
  const formattedDate = new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  // Fetch related articles (same category or recent)
  let relatedArticles: any[] = []
  // Supabase returns single related records as arrays, so access first element
  const categoryData = article.category as { id: string; name: string; slug: string }[] | null
  const category = Array.isArray(categoryData) ? categoryData[0] : categoryData

  if (category) {
    const { data: related } = await supabaseAdmin
      .from('manual_articles')
      .select('slug, title, publish_date, image_url')
      .eq('publication_id', publicationId)
      .eq('category_id', category.id)
      .neq('id', article.id)
      .in('status', ['published', 'used'])
      .order('publish_date', { ascending: false })
      .limit(3)

    relatedArticles = related || []
  }

  // If not enough related, get recent articles
  if (relatedArticles.length < 3) {
    const { data: recent } = await supabaseAdmin
      .from('manual_articles')
      .select('slug, title, publish_date, image_url')
      .eq('publication_id', publicationId)
      .neq('id', article.id)
      .in('status', ['published', 'used'])
      .order('publish_date', { ascending: false })
      .limit(3 - relatedArticles.length)

    if (recent) {
      relatedArticles = [...relatedArticles, ...recent]
    }
  }

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    datePublished: article.publish_date,
    author: {
      '@type': 'Organization',
      name: newsletterName
    },
    publisher: {
      '@type': 'Organization',
      name: businessName,
      logo: {
        '@type': 'ImageObject',
        url: logoUrl
      }
    },
    image: article.image_url ? [article.image_url] : []
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main>
        {/* Hero Section */}
        {article.image_url && (
          <div className="w-full bg-gray-100">
            <div className="max-w-4xl mx-auto">
              <div className="aspect-video relative">
                <img
                  src={article.image_url}
                  alt={article.title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        )}

        <Container className="py-12">
          <article className="max-w-3xl mx-auto">
            {/* Breadcrumb */}
            <nav className="mb-6">
              <ol className="flex items-center space-x-2 text-sm text-gray-500">
                <li>
                  <Link href="/news" className="hover:text-blue-600">
                    News
                  </Link>
                </li>
                {category && (
                  <>
                    <li>/</li>
                    <li>
                      <Link
                        href={`/news?category=${category.slug}`}
                        className="hover:text-blue-600"
                      >
                        {category.name}
                      </Link>
                    </li>
                  </>
                )}
              </ol>
            </nav>

            {/* Article Header */}
            <header className="mb-8">
              {category && (
                <span className="inline-block px-3 py-1 text-sm font-semibold bg-green-100 text-green-800 rounded-full mb-4">
                  {category.name}
                </span>
              )}
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                {article.title}
              </h1>
              <div className="flex items-center text-gray-500">
                <time dateTime={article.publish_date}>{formattedDate}</time>
              </div>
            </header>

            {/* Article Content */}
            <div
              className="prose prose-lg max-w-none prose-headings:font-bold prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline"
              dangerouslySetInnerHTML={{ __html: article.body }}
            />

            {/* Share Section */}
            <div className="mt-12 pt-8 border-t border-gray-200">
              <p className="text-gray-600 mb-4">Share this article:</p>
              <div className="flex gap-3">
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(`https://${host}/news/${article.slug}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-10 h-10 bg-black rounded-lg hover:bg-gray-800 transition-colors"
                  title="Share on Twitter/X"
                >
                  <img
                    src="/images/social/twitter_light.png"
                    alt="Twitter/X"
                    width={24}
                    height={24}
                  />
                </a>
                <a
                  href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(`https://${host}/news/${article.slug}`)}&title=${encodeURIComponent(article.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-10 h-10 bg-[#0A66C2] rounded-lg hover:bg-[#004182] transition-colors"
                  title="Share on LinkedIn"
                >
                  <img
                    src="/images/social/linkedin_light.png"
                    alt="LinkedIn"
                    width={24}
                    height={24}
                  />
                </a>
              </div>
            </div>

            {/* Back Link */}
            <div className="mt-8">
              <Link
                href="/news"
                className="inline-flex items-center text-blue-600 hover:text-blue-800"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to News Archive
              </Link>
            </div>
          </article>

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <div className="max-w-3xl mx-auto mt-16">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Related Articles</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedArticles.map((related) => {
                  const [y, m, d] = related.publish_date.split('-').map(Number)
                  const relatedDate = new Date(y, m - 1, d).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })
                  return (
                    <Link
                      key={related.slug}
                      href={`/news/${related.slug}`}
                      className="group block bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden"
                    >
                      <div className="aspect-video bg-gray-100 overflow-hidden">
                        {related.image_url ? (
                          <img
                            src={related.image_url}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-500 to-green-600">
                            <span className="text-white text-2xl font-bold opacity-50">A</span>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-gray-500 mb-1">{relatedDate}</p>
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 line-clamp-2">
                          {related.title}
                        </h3>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </Container>
      </main>

      <Footer />

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  )
}
