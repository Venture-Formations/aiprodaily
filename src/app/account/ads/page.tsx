import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { getDirectoryPricing } from '@/lib/directory'
import Link from 'next/link'
import Image from 'next/image'
import { Star, Newspaper, ArrowRight, Check, Crown, Clock } from 'lucide-react'

const PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

export const dynamic = 'force-dynamic'

export default async function AdsOverviewPage() {
  const user = await currentUser()

  if (!user) {
    redirect('/sign-in')
  }

  // Fetch user's tool listing and pricing in parallel
  const [toolResult, pricing] = await Promise.all([
    supabaseAdmin
      .from('ai_applications')
      .select('id, app_name, logo_url, is_paid_placement, is_featured, plan, submission_status, publication_id')
      .eq('clerk_user_id', user.id)
      .eq('publication_id', PUBLICATION_ID)
      .single(),
    getDirectoryPricing()
  ])

  const { data: tool, error } = toolResult

  // Debug logging
  console.log('[Account/Ads] Clerk user ID:', user.id)
  console.log('[Account/Ads] Publication ID:', PUBLICATION_ID)
  console.log('[Account/Ads] Tool found:', tool)
  console.log('[Account/Ads] Error:', error)

  const hasListing = !!tool
  const listingType = tool?.is_featured ? 'featured' : tool?.is_paid_placement ? 'paid_placement' : 'free'
  const isPaidListing = listingType !== 'free'
  const isFeatured = listingType === 'featured'
  const billingPeriod = tool?.plan === 'yearly' ? 'Yearly' : tool?.plan === 'monthly' ? 'Monthly' : null

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">My Ads</h1>
        <p className="text-slate-600 mt-1">
          Overview of your advertising options and campaigns
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Tool Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              {tool?.logo_url ? (
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center">
                  <Image
                    src={tool.logo_url}
                    alt={tool.app_name}
                    width={48}
                    height={48}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isFeatured
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                    : isPaidListing
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500'
                      : 'bg-slate-100'
                }`}>
                  {isFeatured ? (
                    <Crown className="w-6 h-6 text-white" />
                  ) : (
                    <Star className={`w-6 h-6 ${isPaidListing ? 'text-white fill-current' : 'text-slate-400'}`} />
                  )}
                </div>
              )}
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Tool Profile</h2>
                <p className="text-sm text-slate-500">Premium listing in directory</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {!hasListing ? (
              <div className="text-center py-4">
                <p className="text-slate-500 mb-4">No tool listing yet</p>
                <Link
                  href="/tools/submit"
                  className="text-blue-600 font-medium hover:underline"
                >
                  Submit your tool first →
                </Link>
              </div>
            ) : isFeatured ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full text-sm font-medium">
                    <Crown className="w-4 h-4" />
                    Featured
                  </span>
                  <span className="text-sm text-slate-500 capitalize">
                    {billingPeriod || 'Monthly'}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  Your listing &ldquo;{tool.app_name}&rdquo; has the #1 position in its category.
                </p>
              </div>
            ) : isPaidListing ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-sm font-medium">
                    <Check className="w-4 h-4" />
                    Paid Placement
                  </span>
                  <span className="text-sm text-slate-500 capitalize">
                    {billingPeriod || 'Monthly'}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  Your listing &ldquo;{tool.app_name}&rdquo; appears on Page 1 of the directory.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-600 mb-4">
                  Upgrade &ldquo;{tool.app_name}&rdquo; to get priority placement and stand out.
                </p>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span>From ${pricing.paidPlacementPrice}/mo</span>
                  <span>•</span>
                  <span>Cancel anytime</span>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
            <Link
              href="/account/ads/profile"
              className="flex items-center justify-between text-blue-600 font-medium hover:underline"
            >
              <span>{isPaidListing ? 'Manage Listing' : 'Upgrade Listing'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Newsletter Ads Card - Coming Soon */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
          {/* Coming Soon Badge */}
          <div className="absolute top-4 right-4 z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-full text-xs font-medium">
              <Clock className="w-3 h-3" />
              Coming Soon
            </span>
          </div>

          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                <Newspaper className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Newsletter Ads</h2>
                <p className="text-sm text-slate-500">Main Sponsor placements</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="text-center py-4">
              <p className="text-slate-500 mb-2">Newsletter advertising coming soon</p>
              <p className="text-sm text-slate-400">
                Reach thousands of accounting professionals
              </p>
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
            <Link
              href="/account/ads/newsletter"
              className="flex items-center justify-between text-slate-400 font-medium"
            >
              <span>Learn More</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Stats / Info */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border border-blue-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Advertising Options</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <Star className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Paid Placement</p>
              <p className="text-sm text-slate-600">
                ${pricing.paidPlacementPrice}/mo. Your tool appears on Page 1 of the directory.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <Crown className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Featured Listing</p>
              <p className="text-sm text-slate-600">
                ${pricing.featuredPrice}/mo. Get the #1 position in your category with premium styling.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <Newspaper className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Newsletter Sponsor</p>
              <p className="text-sm text-slate-600">
                One-time placement. Your ad appears prominently in a newsletter issue.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
