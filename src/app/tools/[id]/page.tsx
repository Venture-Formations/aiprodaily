import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getToolById, getApprovedTools } from '@/lib/directory'

interface ToolDetailPageProps {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default async function ToolDetailPage({ params }: ToolDetailPageProps) {
  const { id } = await params
  const tool = await getToolById(id)

  if (!tool || tool.status !== 'approved') {
    notFound()
  }

  // Use listing image (tool_image_url) for hero, logo_image_url for Quick Info
  const heroImageUrl = tool.tool_image_url || '/placeholder-tool.png'
  const logoUrl = tool.logo_image_url || null

  // Get related tools from same categories
  const allTools = await getApprovedTools()
  const relatedTools = allTools
    .filter(t =>
      t.id !== tool.id &&
      t.categories.some(cat => tool.categories.some(tc => tc.id === cat.id))
    )
    .slice(0, 4)

  // JSON-LD structured data for SoftwareApplication
  const softwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": tool.tool_name,
    "description": tool.description,
    "url": `https://aiaccountingdaily.com/tools/${id}`,
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    ...(tool.tagline && { "slogan": tool.tagline }),
    ...(tool.logo_image_url && {
      "image": tool.logo_image_url
    }),
    "offers": {
      "@type": "Offer",
      "url": tool.website_url,
      "availability": "https://schema.org/OnlineOnly"
    },
    "publisher": {
      "@type": "Organization",
      "name": "AI Accounting Daily",
      "url": "https://aiaccountingdaily.com"
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      {/* Breadcrumb */}
      <nav className="mb-8">
        <ol className="flex items-center space-x-2 text-sm text-gray-500">
          <li><Link href="/tools" className="hover:text-[#06b6d4]">Tools</Link></li>
          <li>/</li>
          {tool.categories[0] && (
            <>
              <li>
                <Link href={`/tools/category/${tool.categories[0].slug}`} className="hover:text-[#06b6d4]">
                  {tool.categories[0].name}
                </Link>
              </li>
              <li>/</li>
            </>
          )}
          <li className="text-gray-900 font-medium">{tool.tool_name}</li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Hero */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="relative h-64 md:h-80 bg-gray-100">
              <Image
                src={heroImageUrl}
                alt={tool.tool_name}
                fill
                className="object-cover"
                priority
              />
              {tool.is_sponsored && (
                <span className="absolute top-4 right-4 bg-orange-500 text-white text-sm font-semibold px-3 py-1 rounded-full">
                  Sponsored
                </span>
              )}
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{tool.tool_name}</h1>
                  {tool.tagline && (
                    <p className="mt-2 text-lg text-gray-600">{tool.tagline}</p>
                  )}
                </div>
              </div>

              {/* Categories */}
              <div className="flex flex-wrap gap-2 mt-4">
                {tool.categories.map(category => (
                  <Link
                    key={category.id}
                    href={`/tools/category/${category.slug}`}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#06b6d4]/10 text-[#06b6d4] hover:bg-[#06b6d4]/20 transition-colors"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>

              {/* Description */}
              <div className="mt-6 prose prose-gray max-w-none">
                <p className="text-gray-700 leading-relaxed">{tool.description}</p>
              </div>

              {/* CTA */}
              <div className="mt-8">
                <a
                  href={tool.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-3 bg-[#1c293d] text-white font-semibold rounded-lg hover:bg-[#1c293d]/90 transition-colors"
                >
                  Visit Website
                  <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Info</h3>

            {/* Logo Image */}
            {logoUrl && (
              <div className="mb-4">
                <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  <Image
                    src={logoUrl}
                    alt={`${tool.tool_name} logo`}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
              </div>
            )}

            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">Website</dt>
                <dd>
                  <a
                    href={tool.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#06b6d4] hover:underline text-sm break-all"
                  >
                    {new URL(tool.website_url).hostname}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Categories</dt>
                <dd className="text-sm text-gray-900">
                  {tool.categories.map(c => c.name).join(', ')}
                </dd>
              </div>
            </dl>
          </div>

          {/* Related Tools */}
          {relatedTools.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Related Tools</h3>
              <div className="space-y-3">
                {relatedTools.map(related => (
                  <Link
                    key={related.id}
                    href={`/tools/${related.id}`}
                    className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium text-gray-900 text-sm">{related.tool_name}</div>
                    <div className="text-xs text-gray-500 mt-1 line-clamp-1">{related.tagline || related.description}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
