import { DirectoryHero } from '@/components/directory/DirectoryHero'
import { ToolsGrid } from '@/components/directory/ToolsGrid'
import { CategoryCard } from '@/components/directory/CategoryCard'
import { getApprovedTools, getApprovedCategories } from '@/lib/directory'

export const dynamic = 'force-dynamic'

export default async function ToolsDirectoryPage() {
  const [tools, categories] = await Promise.all([
    getApprovedTools(),
    getApprovedCategories()
  ])

  // JSON-LD structured data for CollectionPage
  const collectionPageSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "AI Tools Directory",
    "description": "Discover the best AI tools for accounting professionals. Browse 200+ tools for finance, payroll, HR, productivity, and more.",
    "url": "https://aiaccountingdaily.com/tools",
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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageSchema) }}
      />
      {/* Hero Section */}
      <DirectoryHero toolCount={tools.length} />

      {/* Categories Section */}
      <section id="categories" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Browse by Category</h2>
            <p className="mt-4 text-lg text-gray-600">
              Find the perfect AI tool for your specific needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map(category => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        </div>
      </section>

      {/* Tools Grid Section */}
      <section id="explore" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">All AI Tools</h2>
            <p className="mt-4 text-lg text-gray-600">
              Explore our curated collection of AI tools for accounting professionals
            </p>
          </div>

          <ToolsGrid tools={tools} categories={categories} />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-10 bg-[#1c293d] relative overflow-hidden">
        {/* Gradient accent */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-gradient-to-br from-[#a855f7] via-[#06b6d4] to-[#14b8a6] rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl font-bold text-white">Have an AI Tool to Share?</h2>
          <p className="mt-4 text-xl text-white/70">
            Submit your tool to reach thousands of accounting professionals looking for AI solutions.
          </p>
          <a
            href="/tools/submit"
            className="mt-8 inline-block bg-white text-[#1c293d] font-semibold px-8 py-3 rounded-lg hover:bg-white/90 transition-colors"
          >
            Submit Your Tool
          </a>
        </div>
      </section>
    </>
  )
}
