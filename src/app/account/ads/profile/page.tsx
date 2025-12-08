import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { Star, Check, Zap, TrendingUp, Eye, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ToolProfileAdsPage() {
  const user = await currentUser()

  if (!user) {
    redirect('/sign-in')
  }

  // Fetch user's tool listing from ai_applications table
  const { data: tool } = await supabaseAdmin
    .from('ai_applications')
    .select('id, app_name, is_paid_placement, submission_status, plan, view_count, click_count')
    .eq('clerk_user_id', user.id)
    .single()

  const hasListing = !!tool
  const isSponsored = tool?.is_paid_placement || false

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Tool Profile Advertising</h1>
        <p className="text-slate-600 mt-1">
          Boost your tool's visibility with a Sponsored listing
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
            You need to submit a tool to the directory before you can upgrade to a Sponsored listing.
          </p>
          <Link
            href="/tools/submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-500 transition-colors"
          >
            Submit Your Tool
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : isSponsored ? (
        // Already sponsored
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
                        Sponsored
                      </span>
                      <span className="text-sm text-slate-500">
                        {tool.plan === 'yearly' ? 'Yearly Plan' : 'Monthly Plan'}
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
                  <p className="text-2xl font-bold text-emerald-600">Top</p>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits Reminder */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Your Sponsored Benefits</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 text-sm">Priority Placement</p>
                  <p className="text-xs text-slate-500">Appear at the top of search results</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 text-sm">Sponsored Badge</p>
                  <p className="text-xs text-slate-500">Stand out with a highlighted listing</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 text-sm">Enhanced Visibility</p>
                  <p className="text-xs text-slate-500">Blue border highlights your listing</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 text-sm">Category Priority</p>
                  <p className="text-xs text-slate-500">Featured in category pages</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Not sponsored - show upgrade options
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

          {/* Upgrade CTA */}
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border border-blue-200 p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 flex items-center justify-center">
                <Star className="w-8 h-8 text-white fill-current" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Upgrade to Sponsored</h2>
              <p className="text-slate-600 max-w-lg mx-auto">
                Get more visibility and stand out from the crowd with a Sponsored listing
              </p>
            </div>

            {/* Pricing Cards */}
            <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
              {/* Monthly */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-1">Monthly</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-slate-900">$30</span>
                  <span className="text-slate-500">/month</span>
                </div>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500" />
                    Priority placement
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500" />
                    Sponsored badge
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500" />
                    Cancel anytime
                  </li>
                </ul>
                <Link
                  href={`/account/ads/upgrade?plan=monthly&tool=${tool.id}`}
                  className="block w-full py-2.5 bg-slate-900 text-white text-center rounded-full font-medium hover:bg-slate-700 transition-colors"
                >
                  Choose Monthly
                </Link>
              </div>

              {/* Yearly */}
              <div className="bg-white rounded-xl border-2 border-blue-600 p-6 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                    Save 30%
                  </span>
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Yearly</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-slate-900">$250</span>
                  <span className="text-slate-500">/year</span>
                </div>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500" />
                    All monthly benefits
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500" />
                    2 months free
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500" />
                    Locked-in pricing
                  </li>
                </ul>
                <Link
                  href={`/account/ads/upgrade?plan=yearly&tool=${tool.id}`}
                  className="block w-full py-2.5 bg-blue-600 text-white text-center rounded-full font-medium hover:bg-blue-500 transition-colors"
                >
                  Choose Yearly
                </Link>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">What You Get with Sponsored</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Priority Placement</p>
                  <p className="text-sm text-slate-500">Your tool appears at the top of search results and category pages</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center flex-shrink-0">
                  <Star className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Sponsored Badge</p>
                  <p className="text-sm text-slate-500">Stand out with a prominent "Sponsored" label on your listing</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                  <Eye className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Enhanced Visibility</p>
                  <p className="text-sm text-slate-500">Blue highlighted border makes your listing pop</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">More Clicks</p>
                  <p className="text-sm text-slate-500">Sponsored listings typically see 3-5x more engagement</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
