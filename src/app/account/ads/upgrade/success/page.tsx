import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { CheckCircle, Star, Crown, ArrowRight } from 'lucide-react'
import { PUBLICATION_ID } from '@/lib/config'

export const dynamic = 'force-dynamic'

interface SuccessPageProps {
  searchParams: Promise<{
    tool_id?: string
    listing_type?: string
    billing_period?: string
  }>
}

export default async function UpgradeSuccessPage({ searchParams }: SuccessPageProps) {
  const user = await currentUser()
  const params = await searchParams

  if (!user) {
    redirect('/sign-in')
  }

  const toolId = params.tool_id
  const listingType = params.listing_type as 'paid_placement' | 'featured' | undefined
  const billingPeriod = params.billing_period as 'monthly' | 'yearly' | undefined

  if (!toolId) {
    redirect('/account')
  }

  // Fetch the tool to verify ownership and get updated status
  const { data: tool } = await supabaseAdmin
    .from('ai_applications')
    .select('id, app_name, is_featured, is_paid_placement, listing_type, billing_period')
    .eq('id', toolId)
    .eq('clerk_user_id', user.id)
    .eq('publication_id', PUBLICATION_ID)
    .single()

  if (!tool) {
    redirect('/account')
  }

  // If webhook hasn't processed yet, do a fallback update
  const expectedListingType = listingType || 'paid_placement'
  const expectedBillingPeriod = billingPeriod || 'monthly'
  const currentToolListingType = tool.listing_type ||
    (tool.is_featured ? 'featured' : tool.is_paid_placement ? 'paid_placement' : 'free')

  // Check if we need to update (webhook might not have processed yet)
  if (currentToolListingType !== expectedListingType) {
    // Calculate sponsor dates
    const sponsorStartDate = new Date()
    const sponsorEndDate = new Date(sponsorStartDate)
    if (expectedBillingPeriod === 'yearly') {
      sponsorEndDate.setFullYear(sponsorEndDate.getFullYear() + 1)
    } else {
      sponsorEndDate.setMonth(sponsorEndDate.getMonth() + 1)
    }

    // Fallback update
    await supabaseAdmin
      .from('ai_applications')
      .update({
        is_paid_placement: expectedListingType === 'paid_placement',
        is_featured: expectedListingType === 'featured',
        listing_type: expectedListingType,
        billing_period: expectedBillingPeriod,
        sponsor_start_date: sponsorStartDate.toISOString(),
        sponsor_end_date: sponsorEndDate.toISOString()
      })
      .eq('id', toolId)
  }

  const isFeatured = expectedListingType === 'featured'

  return (
    <div className="max-w-lg mx-auto text-center py-12">
      {/* Success Icon */}
      <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${
        isFeatured
          ? 'bg-gradient-to-r from-amber-500 to-orange-500'
          : 'bg-gradient-to-r from-blue-600 to-cyan-500'
      }`}>
        <CheckCircle className="w-10 h-10 text-white" />
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold text-slate-900 mb-3">
        Upgrade Successful!
      </h1>

      {/* Subtitle */}
      <p className="text-lg text-slate-600 mb-8">
        Your listing for <span className="font-semibold">{tool.app_name}</span> has been upgraded to{' '}
        <span className={`font-semibold ${isFeatured ? 'text-amber-600' : 'text-blue-600'}`}>
          {isFeatured ? 'Featured' : 'Paid Placement'}
        </span>
      </p>

      {/* Plan Details Card */}
      <div className={`rounded-2xl p-6 mb-8 ${
        isFeatured
          ? 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200'
          : 'bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200'
      }`}>
        <div className="flex items-center justify-center gap-3 mb-4">
          {isFeatured ? (
            <Crown className="w-8 h-8 text-amber-500" />
          ) : (
            <Star className="w-8 h-8 text-blue-500 fill-current" />
          )}
          <span className="text-xl font-bold text-slate-900">
            {isFeatured ? 'Featured' : 'Paid Placement'} Plan
          </span>
        </div>

        <p className="text-slate-600 text-sm">
          {expectedBillingPeriod === 'yearly' ? 'Annual' : 'Monthly'} subscription active
        </p>
      </div>

      {/* Benefits Reminder */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8 text-left">
        <h3 className="font-semibold text-slate-900 mb-4">Your New Benefits</h3>
        <ul className="space-y-3">
          {isFeatured ? (
            <>
              <li className="flex items-center gap-3 text-sm text-slate-600">
                <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                #1 position in your category
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-600">
                <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                Featured badge on your listing
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-600">
                <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                Highlighted card design
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-600">
                <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                Maximum visibility across the directory
              </li>
            </>
          ) : (
            <>
              <li className="flex items-center gap-3 text-sm text-slate-600">
                <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                Page 1 placement
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-600">
                <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                Priority in search results
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-600">
                <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                Enhanced visibility
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-600">
                <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                3-5x more engagement
              </li>
            </>
          )}
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href={`/tools/${toolId}`}
          className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-white transition-colors ${
            isFeatured
              ? 'bg-amber-500 hover:bg-amber-400'
              : 'bg-blue-600 hover:bg-blue-500'
          }`}
        >
          View Your Listing
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/account"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
        >
          Back to Account
        </Link>
      </div>
    </div>
  )
}
