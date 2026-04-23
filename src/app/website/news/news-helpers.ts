import { supabaseAdmin } from '@/lib/supabase'
import { headers } from 'next/headers'
import { getPublicationByDomain, getPublicationSettings } from '@/lib/publication-settings'
import { STORAGE_PUBLIC_URL } from '@/lib/config'

interface SearchParams {
  category?: string
  from?: string
  to?: string
  page?: string
}

export interface NewsItem {
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

export interface NewsPageData {
  publicationId: string
  headerImageUrl: string
  logoUrl: string
  newsletterName: string
  businessName: string
  currentYear: number
  showToolsLink: boolean
  categories: { id: string; name: string; slug: string }[]
  paginatedItems: NewsItem[]
  totalPages: number
  currentPage: number
  params: SearchParams
}

export async function fetchNewsPageData(params: SearchParams): Promise<NewsPageData> {
  const currentPage = parseInt(params.page || '1')
  const itemsPerPage = 9

  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'aiaccountingdaily.com'
  let publicationId: string = await getPublicationByDomain(host) || ''

  if (!publicationId) {
    const { data: firstPub } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()
    publicationId = firstPub?.id || ''
  }

  const settings = await getPublicationSettings(publicationId, [
    'website_header_url', 'logo_url', 'newsletter_name', 'business_name', 'tools_directory_enabled',
    'archive_cover_image_url',
  ])

  const headerImageUrl = settings.website_header_url || '/logo.png'
  const logoUrl = settings.logo_url || '/logo.png'
  const newsletterName = settings.newsletter_name || 'AI Accounting Daily'
  const businessName = settings.business_name || 'AI Accounting Daily'
  const currentYear = new Date().getFullYear()
  const showToolsLink = settings.tools_directory_enabled !== 'false'

  const { data: categoriesData } = await supabaseAdmin
    .from('article_categories')
    .select('id, name, slug')
    .eq('publication_id', publicationId)
    .order('name')

  const categories = categoriesData || []

  let newsletterQuery = supabaseAdmin
    .from('archived_newsletters')
    .select('issue_date, subject_line, articles, metadata')
    .eq('publication_id', publicationId)
    .order('issue_date', { ascending: false })

  if (params.from) newsletterQuery = newsletterQuery.gte('issue_date', params.from)
  if (params.to) newsletterQuery = newsletterQuery.lte('issue_date', params.to)

  const { data: newsletters } = await newsletterQuery

  let articlesQuery = supabaseAdmin
    .from('manual_articles')
    .select('slug, title, publish_date, image_url, body, category:article_categories(name)')
    .eq('publication_id', publicationId)
    .in('status', ['published', 'used'])
    .order('publish_date', { ascending: false })

  if (params.from) articlesQuery = articlesQuery.gte('publish_date', params.from)
  if (params.to) articlesQuery = articlesQuery.lte('publish_date', params.to)
  if (params.category && params.category !== 'newsletter') {
    const cat = categories.find(c => c.slug === params.category)
    if (cat) articlesQuery = articlesQuery.eq('category_id', cat.id)
  }

  const { data: manualArticles } = await articlesQuery

  const newsletterCoverImage =
    settings.archive_cover_image_url ||
    `${STORAGE_PUBLIC_URL}/img/c/ai_accounting_daily_cover_image.jpg`
  const newsItems: NewsItem[] = []

  if (!params.category || params.category === 'newsletter') {
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
  }

  if (params.category !== 'newsletter') {
    manualArticles?.forEach(article => {
      const bodyText = article.body ? String(article.body).replace(/<[^>]+>/g, '') : ''
      newsItems.push({
        type: 'article',
        slug: article.slug,
        title: article.title,
        date: article.publish_date,
        category: (article.category as any)?.name || 'Uncategorized',
        image_url: article.image_url,
        description: bodyText.substring(0, 150) + (bodyText.length > 150 ? '...' : '')
      })
    })
  }

  newsItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const totalItems = newsItems.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedItems = newsItems.slice(startIndex, startIndex + itemsPerPage)

  return {
    publicationId,
    headerImageUrl,
    logoUrl,
    newsletterName,
    businessName,
    currentYear,
    showToolsLink,
    categories,
    paginatedItems,
    totalPages,
    currentPage,
    params,
  }
}

export function formatNewsDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

export function buildQueryString(params: SearchParams, page: number) {
  const queryParams = new URLSearchParams()
  if (params.category) queryParams.set('category', params.category)
  if (params.from) queryParams.set('from', params.from)
  if (params.to) queryParams.set('to', params.to)
  if (page > 1) queryParams.set('page', page.toString())
  const qs = queryParams.toString()
  return qs ? `?${qs}` : ''
}
