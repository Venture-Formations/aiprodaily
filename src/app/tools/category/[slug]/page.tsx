import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ToolCard } from '@/components/directory/ToolCard'
import { getToolsByCategory, getApprovedCategories } from '@/lib/directory'

interface CategoryPageProps {
  params: Promise<{ slug: string }>
}

export const dynamic = 'force-dynamic'

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params
  const { category, tools } = await getToolsByCategory(slug)

  if (!category) {
    notFound()
  }

  // Get all categories for sidebar
  const allCategories = await getApprovedCategories()

  // JSON-LD structured data for CollectionPage
  const categoryPageSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": `${category.name} - AI Tools Directory`,
    "description": category.description || `Discover AI tools for ${category.name.toLowerCase()}. Browse curated tools for accounting professionals.`,
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
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryPageSchema) }}
      />
      {/* Breadcrumb */}
      <nav className="mb-8">
        <ol className="flex items-center space-x-2 text-sm text-gray-500">
          <li><Link href="/tools" className="hover:text-[#06b6d4]">Tools</Link></li>
          <li>/</li>
          <li><Link href="/tools/categories" className="hover:text-[#06b6d4]">Categories</Link></li>
          <li>/</li>
          <li className="text-gray-900 font-medium">{category.name}</li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">{category.name}</h1>
            {category.description && (
              <p className="mt-2 text-lg text-gray-600">{category.description}</p>
            )}
            <p className="mt-4 text-sm text-gray-500">
              {tools.length} {tools.length === 1 ? 'tool' : 'tools'} in this category
            </p>
          </div>

          {/* Tools List */}
          {tools.length > 0 ? (
            <div className="flex flex-col gap-4">
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No tools yet</h3>
              <p className="text-gray-500 mb-4">Be the first to submit a tool in this category</p>
              <Link
                href="/tools/submit"
                className="inline-block bg-[#1c293d] text-white px-6 py-2 rounded-lg hover:bg-[#1c293d]/90 transition-colors"
              >
                Submit a Tool
              </Link>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-8 space-y-6">
            {/* Other Categories */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">All Categories</h3>
              <ul className="space-y-2">
                {allCategories.map(cat => (
                  <li key={cat.id}>
                    <Link
                      href={`/tools/category/${cat.slug}`}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                        cat.id === category.id
                          ? 'bg-[#06b6d4]/10 text-[#06b6d4] font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-sm">{cat.name}</span>
                      <span className="text-xs text-gray-500">{cat.tool_count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Submit CTA */}
            <div className="bg-gradient-to-br from-[#a855f7]/10 via-[#06b6d4]/10 to-[#14b8a6]/10 rounded-xl p-6 border border-[#06b6d4]/20">
              <h3 className="font-semibold text-[#1c293d] mb-2">Have a Tool?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Submit your AI tool to reach accounting professionals.
              </p>
              <Link
                href="/tools/submit"
                className="block text-center bg-[#1c293d] text-white px-4 py-2 rounded-lg hover:bg-[#1c293d]/90 transition-colors text-sm font-medium"
              >
                Submit Tool
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
