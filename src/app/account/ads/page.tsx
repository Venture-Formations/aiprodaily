import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { Star, Newspaper, ArrowRight, Check, Crown } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdsOverviewPage() {
  const user = await currentUser()

  if (!user) {
    redirect('/sign-in')
  }

  // Fetch user's tool listing for listing type from ai_applications table
  const { data: tool } = await supabaseAdmin
    .from('ai_applications')
    .select('id, app_name, is_paid_placement, is_featured, listing_type, billing_period, submission_status')
    .eq('clerk_user_id', user.id)
    .single()

  // Fetch user's newsletter ads
  const { data: newsletterAds } = await supabaseAdmin
    .from('advertisements')
    .select('id, title, company_name, status, preferred_start_date')
    .eq('clerk_user_id', user.id)
    .eq('ad_type', 'main_sponsor')
    .order('created_at', { ascending: false })
    .limit(3)

  const hasListing = !!tool
  const listingType = tool?.listing_type || (tool?.is_featured ? 'featured' : tool?.is_paid_placement ? 'paid_placement' : 'free')
  const isPaidListing = listingType !== 'free'
  const isFeatured = listingType === 'featured'
  const newsletterAdCount = newsletterAds?.length || 0

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
                    {tool.billing_period || 'Monthly'}
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
                    {tool.billing_period || 'Monthly'}
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
                  <span>From $30/mo</span>
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

        {/* Newsletter Ads Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <Newspaper className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Newsletter Ads</h2>
                <p className="text-sm text-slate-500">Main Sponsor placements</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {newsletterAdCount === 0 ? (
              <div className="text-center py-4">
                <p className="text-slate-500 mb-4">No newsletter ads yet</p>
                <p className="text-sm text-slate-400">
                  Reach thousands of accounting professionals
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {newsletterAds?.map((ad) => (
                  <div key={ad.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{ad.company_name || ad.title}</p>
                      <p className="text-xs text-slate-500">
                        {ad.preferred_start_date
                          ? new Date(ad.preferred_start_date).toLocaleDateString()
                          : 'Date TBD'}
                      </p>
                    </div>
                    <StatusBadge status={ad.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
            <Link
              href="/account/ads/newsletter"
              className="flex items-center justify-between text-blue-600 font-medium hover:underline"
            >
              <span>{newsletterAdCount > 0 ? 'View All Newsletter Ads' : 'Create Newsletter Ad'}</span>
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
                $30/mo. Your tool appears on Page 1 of the directory.
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
                $60/mo. Get the #1 position in your category with premium styling.
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

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending_review: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
    in_progress: { label: 'In Progress', className: 'bg-purple-100 text-purple-700' },
    awaiting_approval: { label: 'Needs Approval', className: 'bg-cyan-100 text-cyan-700' },
    approved: { label: 'Scheduled', className: 'bg-emerald-100 text-emerald-700' },
    active: { label: 'Running', className: 'bg-green-100 text-green-700' },
    completed: { label: 'Sent', className: 'bg-gray-100 text-gray-700' },
    rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  }

  const { label, className } = config[status] || { label: status, className: 'bg-gray-100 text-gray-700' }

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
