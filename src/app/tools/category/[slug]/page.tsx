import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { CategoryToolsGrid } from '@/components/directory/CategoryToolsGrid'
import { getToolsByCategory, getApprovedCategories } from '@/lib/directory'
import { Container } from '@/components/salient/Container'
import { Button } from '@/components/salient/Button'

interface CategoryPageProps {
  params: Promise<{ slug: string }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params
  const { category, tools } = await getToolsByCategory(slug)

  if (!category) {
    return { title: 'Category Not Found' }
  }

  const toolCount = tools.length >= 10 ? 10 : tools.length
  const pageTitle = `${toolCount} Best AI ${category.name} Tools for Accounting`

  return {
    title: pageTitle,
    description: category.description || `Discover the best AI ${category.name.toLowerCase()} tools for accounting professionals. Browse our curated directory.`,
    openGraph: {
      title: pageTitle,
      description: category.description || `Discover the best AI ${category.name.toLowerCase()} tools for accounting professionals.`,
      url: `https://aiaccountingdaily.com/tools/category/${slug}`,
    },
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params
  const { category, tools } = await getToolsByCategory(slug)

  if (!category) {
    notFound()
  }

  // Get all categories for sidebar
  const allCategories = await getApprovedCategories()

  // Page title for display and SEO
  const toolCount = tools.length >= 10 ? 10 : tools.length
  const pageTitle = `${toolCount} Best AI ${category.name} Tools for Accounting`

  // JSON-LD structured data for CollectionPage
  const categoryPageSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": pageTitle,
    "description": category.description || `Discover the best AI ${category.name.toLowerCase()} tools for accounting professionals. Browse our curated directory.`,
    "url": `https://aiaccountingdaily.com/tools/category/${slug}`,
    "publisher": {
      "@type": "Organization",
      "name": "AI Accounting Daily",
      "url": "https://aiaccountingdaily.com"
    },
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": tools.length,
      "itemListElement": tools.slice(0, 10).map((tool, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
          "@type": "SoftwareApplication",
          "name": tool.tool_name,
          "description": tool.description || tool.tagline,
          "url": `https://aiaccountingdaily.com/tools/${tool.id}`,
          "applicationCategory": "BusinessApplication"
        }
      }))
    }
  }

  return (
    <section className="py-12">
      <Container>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryPageSchema) }}
        />

        {/* Breadcrumb */}
        <nav className="mb-8">
          <ol className="flex items-center space-x-2 text-sm text-slate-500">
            <li><Link href="/tools" className="hover:text-blue-600 transition-colors">Tools</Link></li>
            <li>/</li>
            <li><Link href="/tools/categories" className="hover:text-blue-600 transition-colors">Categories</Link></li>
            <li>/</li>
            <li className="text-slate-900 font-medium">{category.name}</li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Header */}
            <div className="mb-8">
              <h1 className="font-display text-3xl font-medium tracking-tight text-slate-900 sm:text-4xl">
                {pageTitle}
              </h1>
              {category.description && (
                <p className="mt-2 text-lg text-slate-700">{category.description}</p>
              )}
              <p className="mt-4 text-sm text-slate-500">
                {tools.length} {tools.length === 1 ? 'tool' : 'tools'} in this category
              </p>
            </div>

            {/* Affiliate Disclosure */}
            <p className="text-xs text-slate-400 mb-6">
              Disclosure: Some products in this list include affiliate links or paid placements. We may earn a commission or receive compensation when you click our links or purchase through them.
            </p>

            {/* Tools List */}
            {tools.length > 0 ? (
              <CategoryToolsGrid tools={tools} />
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl ring-1 ring-slate-900/5">
                <div className="text-slate-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-1">No tools yet</h3>
                <p className="text-slate-500 mb-6">Be the first to submit a tool in this category</p>
                <Button href="/tools/submit" color="blue">
                  Submit a Tool
                </Button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              {/* Other Categories */}
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">All Categories</h3>
                <ul className="space-y-2">
                  {allCategories.map(cat => (
                    <li key={cat.id}>
                      <Link
                        href={`/tools/category/${cat.slug}`}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                          cat.id === category.id
                            ? 'bg-blue-50 text-blue-600 font-medium'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-sm">{cat.name}</span>
                        <span className="text-xs text-slate-500">{cat.tool_count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Submit CTA */}
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 ring-1 ring-blue-500/10">
                <h3 className="font-semibold text-slate-900 mb-2">Have a Tool?</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Submit your AI tool to reach accounting professionals.
                </p>
                <Button href="/tools/submit" color="blue" className="w-full justify-center">
                  Submit Tool
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
