import { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { PUBLICATION_ID, SITE_BASE_URL } from '@/lib/config'

// Regenerate sitemap every hour (3600 seconds)
// This ensures new tools, articles, and newsletters appear without redeploying
export const revalidate = 3600

const BASE_URL = SITE_BASE_URL

// Tool categories from directory.ts
const TOOL_CATEGORIES = [
  'accounting-bookkeeping',
  'tax-compliance',
  'payroll',
  'finance-analysis',
  'expense-management',
  'client-management',
  'productivity',
  'hr',
  'banking-payments',
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/subscribe`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/tools`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/tools/categories`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/tools/submit`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/news`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/contactus`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/privacypolicy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ]

  // Tool category pages
  const categoryPages: MetadataRoute.Sitemap = TOOL_CATEGORIES.map((slug) => ({
    url: `${BASE_URL}/tools/category/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  // Dynamic tool pages from ai_applications
  let toolPages: MetadataRoute.Sitemap = []
  try {
    const { data: tools } = await supabaseAdmin
      .from('ai_applications')
      .select('id, updated_at')
      .eq('publication_id', PUBLICATION_ID)
      .eq('is_active', true)

    if (tools) {
      toolPages = tools.map((tool) => ({
        url: `${BASE_URL}/tools/${tool.id}`,
        lastModified: tool.updated_at ? new Date(tool.updated_at) : now,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))
    }
  } catch (error) {
    console.error('[Sitemap] Error fetching tools:', error)
  }

  // Newsletter archive pages from archived_newsletters
  let newsletterPages: MetadataRoute.Sitemap = []
  try {
    const { data: newsletters } = await supabaseAdmin
      .from('archived_newsletters')
      .select('issue_date')
      .eq('publication_id', PUBLICATION_ID)
      .order('issue_date', { ascending: false })

    if (newsletters) {
      newsletterPages = newsletters.map((nl) => ({
        url: `${BASE_URL}/newsletter/${nl.issue_date}`,
        lastModified: new Date(nl.issue_date),
        changeFrequency: 'never' as const,
        priority: 0.5,
      }))
    }
  } catch (error) {
    console.error('[Sitemap] Error fetching newsletters:', error)
  }

  // Manual articles from manual_articles
  let articlePages: MetadataRoute.Sitemap = []
  try {
    const { data: articles } = await supabaseAdmin
      .from('manual_articles')
      .select('slug, updated_at')
      .eq('publication_id', PUBLICATION_ID)
      .in('status', ['published', 'used'])

    if (articles) {
      articlePages = articles.map((article) => ({
        url: `${BASE_URL}/news/${article.slug}`,
        lastModified: article.updated_at ? new Date(article.updated_at) : now,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      }))
    }
  } catch (error) {
    console.error('[Sitemap] Error fetching articles:', error)
  }

  return [
    ...staticPages,
    ...categoryPages,
    ...toolPages,
    ...newsletterPages,
    ...articlePages,
  ]
}
