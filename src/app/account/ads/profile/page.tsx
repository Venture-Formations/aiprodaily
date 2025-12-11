import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { getCategoriesWithFeaturedTools } from '@/lib/directory'
import Link from 'next/link'
import { Star, Check, Zap, TrendingUp, Eye, ArrowRight, Crown } from 'lucide-react'

export const dynamic = 'force-dynamic'

// Pricing constants
const PAID_PLACEMENT_MONTHLY = 30
const FEATURED_MONTHLY = 60
const YEARLY_DISCOUNT_MONTHS = 2

export default async function ToolProfileAdsPage() {
  const user = await currentUser()

  if (!user) {
    redirect('/sign-in')
  }

  // Fetch user's tool listing from ai_applications table
  const { data: tool } = await supabaseAdmin
    .from('ai_applications')
    .select('id, app_name, category, is_paid_placement, is_featured, listing_type, billing_period, submission_status, plan, view_count, click_count')
    .eq('clerk_user_id', user.id)
    .single()

  // Get categories with featured tools
  const categoriesWithFeatured = await getCategoriesWithFeaturedTools()

  const hasListing = !!tool
  const listingType = tool?.listing_type || (tool?.is_featured ? 'featured' : tool?.is_paid_placement ? 'paid_placement' : 'free')
  const isPaidListing = listingType !== 'free'
  const isFeatured = listingType === 'featured'

  // Check if user's category already has a featured tool (and it's not theirs)
  const categoryHasFeatured = tool?.category ? categoriesWithFeatured.has(tool.category) && !tool.is_featured : false

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Tool Profile Advertising</h1>
        <p className="text-slate-600 mt-1">
          Boost your tool&apos;s visibility with a premium listing
        </p>
      </div>

      {!hasListing ? (
        // No listing yet
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Star className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-3">No Tool Listing Yet</h2>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            You need to submit a tool to the directory before you can upgrade to a premium listing.
          </p>
          <Link
            href="/tools/submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-500 transition-colors"
          >
            Submit Your Tool
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : isFeatured ? (
        // Already featured
        <div className="space-y-6">
          {/* Status Card */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-1">
            <div className="bg-white rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center">
                    <Crown className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{tool.app_name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-sm font-medium">
                        <Crown className="w-4 h-4" />
                        Featured
                      </span>
                      <span className="text-sm text-slate-500 capitalize">
                        {tool.billing_period || tool.plan} Plan
                      </span>
                    </div>
                  </div>
                </div>
                <Link
                  href="/account/billing"
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                >
                  Manage Subscription
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 mt-6 pt-6 border-t border-slate-100">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 text-slate-500 mb-1">
                    <Eye className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wide">Views</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {tool.view_count?.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 text-slate-500 mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wide">Clicks</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {tool.click_count?.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 text-slate-500 mb-1">
                    <Zap className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wide">Position</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-600">#1</p>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits Reminder */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Your Featured Benefits</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 text-sm">#1 Position</p>
                  <p className="text-xs text-slate-500">First in your category</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 text-sm">Featured Badge</p>
                  <p className="text-xs text-slate-500">Prominent visual distinction</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 text-sm">Highlighted Card</p>
                  <p className="text-xs text-slate-500">Stand out with premium styling</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 text-sm">Maximum Visibility</p>
                  <p className="text-xs text-slate-500">Top placement everywhere</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : isPaidListing ? (
        // Has paid placement - show current status and upgrade to featured option
        <div className="space-y-6">
          {/* Status Card */}
          <div className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl p-1">
            <div className="bg-white rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 flex items-center justify-center">
                    <Star className="w-7 h-7 text-white fill-current" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{tool.app_name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm font-medium">
                        <Star className="w-4 h-4 fill-current" />
                        Paid Placement
                      </span>
                      <span className="text-sm text-slate-500 capitalize">
                        {tool.billing_period || tool.plan} Plan
                      </span>
                    </div>
                  </div>
                </div>
                <Link
                  href="/account/billing"
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                >
                  Manage Subscription
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 mt-6 pt-6 border-t border-slate-100">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 text-slate-500 mb-1">
                    <Eye className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wide">Views</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {tool.view_count?.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 text-slate-500 mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wide">Clicks</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {tool.click_count?.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 text-slate-500 mb-1">
                    <Zap className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wide">Position</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">Page 1</p>
                </div>
              </div>
            </div>
          </div>

          {/* Upgrade to Featured CTA */}
          {!categoryHasFeatured && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center">
                  <Crown className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Upgrade to Featured</h2>
                <p className="text-slate-600 max-w-lg mx-auto">
                  Get the #1 position in your category and maximum visibility
                </p>
              </div>

              {/* Featured Pricing */}
              <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
                {/* Monthly */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="font-semibold text-slate-900 mb-1">Monthly</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-slate-900">${FEATURED_MONTHLY}</span>
                    <span className="text-slate-500">/month</span>
                  </div>
                  <ul className="space-y-2 mb-6">
                    <li className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="w-4 h-4 text-amber-500" />
                      #1 position in category
                    </li>
                    <li className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="w-4 h-4 text-amber-500" />
                      Featured badge
                    </li>
                    <li className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="w-4 h-4 text-amber-500" />
                      Cancel anytime
                    </li>
                  </ul>
                  <Link
                    href={`/account/ads/upgrade?listing_type=featured&billing_period=monthly&tool=${tool.id}`}
                    className="block w-full py-2.5 bg-slate-900 text-white text-center rounded-full font-medium hover:bg-slate-700 transition-colors"
                  >
                    Choose Monthly
                  </Link>
                </div>

                {/* Yearly */}
                <div className="bg-white rounded-xl border-2 border-amber-500 p-6 relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 bg-amber-500 text-white text-xs font-medium rounded-full">
                      Save ${FEATURED_MONTHLY * YEARLY_DISCOUNT_MONTHS}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1">Yearly</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-slate-900">${FEATURED_MONTHLY * (12 - YEARLY_DISCOUNT_MONTHS)}</span>
                    <span className="text-slate-500">/year</span>
                  </div>
                  <ul className="space-y-2 mb-6">
                    <li className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="w-4 h-4 text-amber-500" />
                      All monthly benefits
                    </li>
                    <li className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="w-4 h-4 text-amber-500" />
                      {YEARLY_DISCOUNT_MONTHS} months free
                    </li>
                    <li className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="w-4 h-4 text-amber-500" />
                      Locked-in pricing
                    </li>
                  </ul>
                  <Link
                    href={`/account/ads/upgrade?listing_type=featured&billing_period=yearly&tool=${tool.id}`}
                    className="block w-full py-2.5 bg-amber-500 text-white text-center rounded-full font-medium hover:bg-amber-400 transition-colors"
                  >
                    Choose Yearly
                  </Link>
                </div>
              </div>
            </div>
          )}

          {categoryHasFeatured && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 text-center">
              <Crown className="w-8 h-8 text-amber-500 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">Featured Slot Unavailable</h3>
              <p className="text-sm text-slate-600">
                Another tool is currently the Featured listing in your category.
                Featured slots are limited to one per category.
              </p>
            </div>
          )}

          {/* Current Benefits */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Your Paid Placement Benefits</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 text-sm">Page 1 Placement</p>
                  <p className="text-xs text-slate-500">Appear on the first page</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 text-sm">Priority Search</p>
                  <p className="text-xs text-slate-500">Higher in search results</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 text-sm">Enhanced Visibility</p>
                  <p className="text-xs text-slate-500">Stand out from free listings</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 text-sm">More Engagement</p>
                  <p className="text-xs text-slate-500">3-5x more clicks</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Free listing - show upgrade options for both tiers
        <div className="space-y-6">
          {/* Current Status */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                  <Star className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{tool.app_name}</h2>
                  <span className="text-sm text-slate-500">Free Listing</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Current Status</p>
                <p className="font-medium text-slate-900 capitalize">{tool.submission_status}</p>
              </div>
            </div>
          </div>

          {/* Pricing Options */}
          <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl border border-slate-200 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Upgrade Your Listing</h2>
              <p className="text-slate-600 max-w-lg mx-auto">
                Get more visibility and stand out from the crowd
              </p>
            </div>

            {/* Three-tier pricing */}
            <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto">
              {/* Free - Current */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 opacity-60">
                <h3 className="font-semibold text-slate-900 mb-1">Free</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-slate-900">$0</span>
                </div>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-slate-400" />
                    Basic listing
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-slate-400" />
                    Category placement
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-slate-400" />
                    Search visibility
                  </li>
                </ul>
                <div className="w-full py-2.5 bg-slate-200 text-slate-500 text-center rounded-full font-medium">
                  Current Plan
                </div>
              </div>

              {/* Paid Placement */}
              <div className="bg-white rounded-xl border-2 border-blue-500 p-6 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                    Popular
                  </span>
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Paid Placement</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-slate-900">${PAID_PLACEMENT_MONTHLY}</span>
                  <span className="text-slate-500">/mo</span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  or ${PAID_PLACEMENT_MONTHLY * (12 - YEARLY_DISCOUNT_MONTHS)}/year
                </p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-blue-500" />
                    Page 1 placement
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-blue-500" />
                    Priority search
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-blue-500" />
                    &quot;Paid Placement&quot; label
                  </li>
                </ul>
                <Link
                  href={`/account/ads/upgrade?listing_type=paid_placement&tool=${tool.id}`}
                  className="block w-full py-2.5 bg-blue-600 text-white text-center rounded-full font-medium hover:bg-blue-500 transition-colors"
                >
                  Upgrade
                </Link>
              </div>

              {/* Featured */}
              <div className={`bg-white rounded-xl p-6 relative ${
                categoryHasFeatured
                  ? 'border border-slate-200 opacity-60'
                  : 'border-2 border-amber-500'
              }`}>
                {!categoryHasFeatured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 bg-amber-500 text-white text-xs font-medium rounded-full">
                      Premium
                    </span>
                  </div>
                )}
                <h3 className="font-semibold text-slate-900 mb-1">Featured</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-slate-900">${FEATURED_MONTHLY}</span>
                  <span className="text-slate-500">/mo</span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  or ${FEATURED_MONTHLY * (12 - YEARLY_DISCOUNT_MONTHS)}/year
                </p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className={`w-4 h-4 ${categoryHasFeatured ? 'text-slate-400' : 'text-amber-500'}`} />
                    #1 in category
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className={`w-4 h-4 ${categoryHasFeatured ? 'text-slate-400' : 'text-amber-500'}`} />
                    Featured badge
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className={`w-4 h-4 ${categoryHasFeatured ? 'text-slate-400' : 'text-amber-500'}`} />
                    Highlighted card
                  </li>
                </ul>
                {categoryHasFeatured ? (
                  <div className="w-full py-2.5 bg-slate-200 text-slate-500 text-center rounded-full font-medium text-sm">
                    Slot Taken
                  </div>
                ) : (
                  <Link
                    href={`/account/ads/upgrade?listing_type=featured&tool=${tool.id}`}
                    className="block w-full py-2.5 bg-amber-500 text-white text-center rounded-full font-medium hover:bg-amber-400 transition-colors"
                  >
                    Upgrade
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Benefits Comparison */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Why Upgrade?</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Priority Placement</p>
                  <p className="text-sm text-slate-500">Appear at the top of search results and category pages</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center flex-shrink-0">
                  <Star className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Stand Out</p>
                  <p className="text-sm text-slate-500">Visual distinction from free listings</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                  <Eye className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">More Visibility</p>
                  <p className="text-sm text-slate-500">Premium placements drive more traffic</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Better Results</p>
                  <p className="text-sm text-slate-500">Paid listings typically see 3-5x more engagement</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
