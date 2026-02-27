import { DirectoryHero } from '@/components/directory/DirectoryHero'
import { ToolsGrid } from '@/components/directory/ToolsGrid'
import { CategoryCard } from '@/components/directory/CategoryCard'
import { getApprovedTools, getApprovedCategories } from '@/lib/directory'
import { Container } from '@/components/salient/Container'
import { Button } from '@/components/salient/Button'
import { SITE_BASE_URL } from '@/lib/config'

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
    "url": `${SITE_BASE_URL}/tools`,
    "publisher": {
      "@type": "Organization",
      "name": "AI Tools Directory",
      "url": SITE_BASE_URL
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
          "url": `${SITE_BASE_URL}/tools/${tool.id}`,
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
      <DirectoryHero toolCount={tools.length} categoryCount={categories.length} />

      {/* Categories Section */}
      <section id="categories" className="py-16 bg-blue-600 relative overflow-hidden">
        {/* Background image for purple/pink/teal clouding effect */}
        <img
          src="/images/background-call-to-action.jpg"
          alt=""
          className="absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
          width={2347}
          height={1244}
        />

        <Container className="relative">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-medium tracking-tight text-white sm:text-4xl">
              Browse AI Tools by Category
            </h2>
            <p className="mt-4 text-lg tracking-tight text-blue-100">
              Find the perfect AI tool for your specific needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map(category => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        </Container>
      </section>

      {/* Tools Grid Section */}
      <section id="explore" className="py-16">
        <Container>
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-medium tracking-tight text-slate-900 sm:text-4xl">
              All AI Tools
            </h2>
            <p className="mt-4 text-lg tracking-tight text-slate-700">
              Explore our curated collection of AI tools for accounting professionals
            </p>
          </div>

          {/* Affiliate Disclosure */}
          <p className="text-xs text-slate-400 mb-6 text-center">
            Disclosure: Some products in this list include affiliate links or paid placements. We may earn a commission or receive compensation when you click our links or purchase through them.
          </p>

          <ToolsGrid tools={tools} categories={categories} />
        </Container>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-600 relative overflow-hidden">
        {/* Background image for purple/pink/teal clouding effect */}
        <img
          src="/images/background-call-to-action.jpg"
          alt=""
          className="absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
          width={2347}
          height={1244}
        />

        <Container className="relative">
          <div className="text-center">
            <h2 className="font-display text-3xl font-medium tracking-tight text-white sm:text-4xl">
              Have an AI Tool to Share?
            </h2>
            <p className="mt-4 text-lg tracking-tight text-blue-100 max-w-2xl mx-auto">
              Submit your tool to reach thousands of accounting professionals looking for AI solutions.
            </p>
            <div className="mt-8">
              <Button href="/tools/submit" color="white">
                Submit Your Tool
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}
