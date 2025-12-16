import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { currentUser } from '@clerk/nextjs/server'
import { getToolById, getApprovedTools, incrementToolViews } from '@/lib/directory'
import { supabaseAdmin } from '@/lib/supabase'
import { Container } from '@/components/salient/Container'
import { Button } from '@/components/salient/Button'
import { ToolClickTracker } from './ToolClickTracker'
import { ClaimListingButton } from './ClaimListingButton'

const PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

interface ToolDetailPageProps {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default async function ToolDetailPage({ params }: ToolDetailPageProps) {
  const { id } = await params
  const [tool, user] = await Promise.all([
    getToolById(id),
    currentUser()
  ])

  if (!tool || !tool.is_active) {
    notFound()
  }

  // Track page view (fire and forget, don't block render)
  incrementToolViews(id).catch(() => {})

  // Check if tool is claimed (has clerk_user_id)
  const isToolClaimed = !!tool.clerk_user_id

  // Check if current user already has a listing
  let currentUserHasListing = false
  if (user) {
    const { data: userListing } = await supabaseAdmin
      .from('ai_applications')
      .select('id')
      .eq('clerk_user_id', user.id)
      .eq('publication_id', PUBLICATION_ID)
      .single()
    currentUserHasListing = !!userListing
  }

  // Use listing image (tool_image_url) for hero, logo_image_url for Quick Info
  // Only show hero image if one exists (no placeholder fallback)
  const heroImageUrl = tool.tool_image_url || null
  const logoUrl = tool.logo_image_url || null

  // Get related tools from same categories (randomly selected)
  const allTools = await getApprovedTools()
  const sameCategoryTools = allTools.filter(t =>
    t.id !== tool.id &&
    t.categories.some(cat => tool.categories.some(tc => tc.id === cat.id))
  )

  // Shuffle and take 4 random tools
  const shuffled = sameCategoryTools.sort(() => Math.random() - 0.5)
  const relatedTools = shuffled.slice(0, 4)

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
    <section className="py-12">
      <Container>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
        />

        {/* Breadcrumb */}
        <nav className="mb-8">
          <ol className="flex items-center space-x-2 text-sm text-slate-500">
            <li><Link href="/tools" className="hover:text-blue-600 transition-colors">Tools</Link></li>
            <li>/</li>
            {tool.categories[0] && (
              <>
                <li>
                  <Link href={`/tools/category/${tool.categories[0].slug}`} className="hover:text-blue-600 transition-colors">
                    {tool.categories[0].name}
                  </Link>
                </li>
                <li>/</li>
              </>
            )}
            <li className="text-slate-900 font-medium">{tool.tool_name}</li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Hero */}
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 overflow-hidden">
              {heroImageUrl && (
                <div className="relative aspect-video bg-slate-100">
                  <Image
                    src={heroImageUrl}
                    alt={tool.tool_name}
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              )}

              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="font-display text-3xl font-medium tracking-tight text-slate-900">
                      {tool.tool_name}
                    </h1>
                    {tool.tagline && (
                      <p className="mt-2 text-lg text-slate-600">{tool.tagline}</p>
                    )}
                  </div>
                </div>

                {/* Categories */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {tool.categories.map(category => (
                    <Link
                      key={category.id}
                      href={`/tools/category/${category.slug}`}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>

                {/* Description */}
                <div className="mt-6 prose prose-slate max-w-none">
                  <p className="text-slate-700 leading-relaxed">{tool.description}</p>
                </div>

                {/* CTA */}
                <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                  <ToolClickTracker
                    toolId={id}
                    websiteUrl={tool.website_url}
                    className="group inline-flex items-center justify-center rounded-full py-3 px-6 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    Visit Website
                    <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </ToolClickTracker>
                  <ClaimListingButton
                    toolId={id}
                    toolName={tool.tool_name}
                    description={tool.description || ''}
                    websiteUrl={tool.website_url}
                    category={tool.categories[0]?.name || 'Productivity'}
                    currentLogoUrl={tool.logo_image_url}
                    currentImageUrl={tool.tool_image_url}
                    isToolClaimed={isToolClaimed}
                    currentUserHasListing={currentUserHasListing}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Info Card */}
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Quick Info</h3>

              {/* Logo Image */}
              {logoUrl && (
                <div className="mb-4">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-100 ring-1 ring-slate-900/5">
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
                  <dt className="text-sm text-slate-500">Website</dt>
                  <dd>
                    <ToolClickTracker
                      toolId={id}
                      websiteUrl={tool.website_url}
                      className="text-blue-600 hover:text-blue-500 text-sm break-all transition-colors"
                    >
                      {new URL(tool.website_url).hostname}
                    </ToolClickTracker>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Categories</dt>
                  <dd className="text-sm text-slate-900">
                    {tool.categories.map(c => c.name).join(', ')}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Related Tools */}
            {relatedTools.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-900/5 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Related Tools</h3>
                <div className="space-y-3">
                  {relatedTools.map(related => (
                    <Link
                      key={related.id}
                      href={`/tools/${related.id}`}
                      className="block p-3 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      <div className="font-medium text-slate-900 text-sm">{related.tool_name}</div>
                      <div className="text-xs text-slate-500 mt-1 line-clamp-1">{related.tagline || related.description}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

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
      </Container>
    </section>
  )
}
