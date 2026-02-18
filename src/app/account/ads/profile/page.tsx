import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { getCategoriesWithFeaturedTools, getDirectoryPricing } from '@/lib/directory'
import Link from 'next/link'
import Image from 'next/image'
import { Star, Check, TrendingUp, Eye, ArrowRight, Crown, Clock } from 'lucide-react'
import { PUBLICATION_ID } from '@/lib/config'

export const dynamic = 'force-dynamic'

export default async function ToolProfileAdsPage() {
  const user = await currentUser()

  if (!user) {
    redirect('/sign-in')
  }

  // Fetch user's tool listing, pricing, and featured categories in parallel
  const [toolResult, pricing, categoriesWithFeatured] = await Promise.all([
    supabaseAdmin
      .from('ai_applications')
      .select('id, app_name, logo_url, category, is_paid_placement, is_featured, plan, submission_status, view_count, click_count, publication_id')
      .eq('clerk_user_id', user.id)
      .eq('publication_id', PUBLICATION_ID)
      .single(),
    getDirectoryPricing(),
    getCategoriesWithFeaturedTools()
  ])

  const { data: tool, error } = toolResult

  // Debug logging
  console.log('[Account/Ads/Profile] Clerk user ID:', user.id)
  console.log('[Account/Ads/Profile] Publication ID:', PUBLICATION_ID)
  console.log('[Account/Ads/Profile] Tool found:', tool)
  console.log('[Account/Ads/Profile] Error:', error)

  const hasListing = !!tool
  const isFeatured = tool?.is_featured || false
  // Only show billing period if it's monthly or yearly (not 'free' or null)
  const billingPeriod = tool?.plan === 'yearly' ? 'Yearly' : tool?.plan === 'monthly' ? 'Monthly' : null

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
                  {tool.logo_url ? (
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center">
                      <Image
                        src={tool.logo_url}
                        alt={tool.app_name}
                        width={56}
                        height={56}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center">
                      <Crown className="w-7 h-7 text-white" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{tool.app_name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-sm font-medium">
                        <Crown className="w-4 h-4" />
                        Featured
                      </span>
                      {billingPeriod && (
                        <span className="text-sm text-slate-500">
                          {billingPeriod} Billing
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Billing link hidden - kept for future use */}
                {/* {billingPeriod && (
                  <Link
                    href="/account/billing"
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                  >
                    Manage Subscription
                  </Link>
                )} */}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-6 mt-6 pt-6 border-t border-slate-100">
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
      ) : (
        // Free listing - show upgrade options for both tiers
        <div className="space-y-6">
          {/* Current Status */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {tool.logo_url ? (
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
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Star className="w-6 h-6 text-slate-400" />
                  </div>
                )}
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

          {/* Upgrade Section - Coming Soon Overlay */}
          <div className="relative">
            {/* Coming Soon Overlay */}
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-amber-100 to-orange-100 flex items-center justify-center">
                  <Clock className="w-8 h-8 text-amber-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Coming Soon</h2>
                <p className="text-slate-600 mb-4">
                  Premium listing upgrades will be available soon. We&apos;re working on bringing you the best way to boost your tool&apos;s visibility.
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-full text-sm font-medium">
                  <Clock className="w-4 h-4" />
                  Stay tuned for updates
                </div>
              </div>
            </div>

            {/* Grayed out content behind */}
            <div className="opacity-30 pointer-events-none select-none blur-[2px]">
              {/* Upgrade to Featured Option */}
              {!categoryHasFeatured ? (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-8">
                  {/* Urgency Banner */}
                  <div className="bg-amber-500 text-white text-center py-3 px-4 rounded-xl mb-6 shadow-md">
                    <p className="font-bold text-lg">⚡ Only 1 Featured Listing Per Category</p>
                    <p className="text-amber-100 text-sm">This spot is currently available in your category!</p>
                  </div>

                  <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center">
                      <Crown className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Claim the #1 Position</h2>
                    <p className="text-slate-600 max-w-lg mx-auto">
                      Be the featured tool in your category and get maximum visibility
                    </p>
                  </div>

                  {/* Featured Pricing - Monthly Only */}
                  <div className="max-w-md mx-auto">
                    <div className="bg-white rounded-xl border-2 border-amber-500 p-6 relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="px-3 py-1 bg-amber-500 text-white text-xs font-medium rounded-full">
                          Premium
                        </span>
                      </div>
                      <h3 className="font-semibold text-slate-900 mb-1 text-center">Featured Listing</h3>
                      <div className="text-center mb-4">
                        <span className="text-4xl font-bold text-slate-900">${pricing.featuredPrice}</span>
                        <span className="text-slate-500">/month</span>
                      </div>
                      <ul className="space-y-3 mb-6">
                        <li className="flex items-center gap-2 text-sm text-slate-600">
                          <Check className="w-4 h-4 text-amber-500" />
                          #1 position in your category
                        </li>
                        <li className="flex items-center gap-2 text-sm text-slate-600">
                          <Check className="w-4 h-4 text-amber-500" />
                          Featured badge & highlighted card
                        </li>
                        <li className="flex items-center gap-2 text-sm text-slate-600">
                          <Check className="w-4 h-4 text-amber-500" />
                          Maximum visibility
                        </li>
                        <li className="flex items-center gap-2 text-sm text-slate-600">
                          <Check className="w-4 h-4 text-amber-500" />
                          Cancel anytime
                        </li>
                      </ul>
                      <span className="block w-full py-3 bg-amber-500 text-white text-center rounded-full font-medium">
                        Upgrade to Featured
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 text-center">
                  <Crown className="w-8 h-8 text-amber-500 mx-auto mb-3" />
                  <h3 className="font-semibold text-slate-900 mb-2">Featured Slot Unavailable</h3>
                  <p className="text-sm text-slate-600">
                    Another tool is currently the Featured listing in your category.
                    Featured slots are limited to one per category.
                  </p>
                </div>
              )}

              {/* Benefits Comparison */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mt-6">
                <h3 className="font-semibold text-slate-900 mb-4">Why Upgrade to Featured?</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Crown className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">#1 Position</p>
                      <p className="text-sm text-slate-500">First listing in your category, guaranteed</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <Star className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Stand Out</p>
                      <p className="text-sm text-slate-500">Featured badge and highlighted card styling</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                      <Eye className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Maximum Visibility</p>
                      <p className="text-sm text-slate-500">Top placement drives the most traffic</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Better Results</p>
                      <p className="text-sm text-slate-500">Featured listings see 5-10x more engagement</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
