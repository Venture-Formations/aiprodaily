import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { getCategoriesWithFeaturedTools } from '@/lib/directory'
import { UpgradeForm } from './UpgradeForm'

const PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

export const dynamic = 'force-dynamic'

interface UpgradePageProps {
  searchParams: Promise<{
    listing_type?: string
    billing_period?: string
    tool?: string
  }>
}

export default async function UpgradePage({ searchParams }: UpgradePageProps) {
  const user = await currentUser()
  const params = await searchParams

  if (!user) {
    redirect('/sign-in')
  }

  // Get listing type and billing period from query params
  const listingType = params.listing_type as 'paid_placement' | 'featured' | undefined
  const billingPeriod = params.billing_period as 'monthly' | 'yearly' | undefined

  // Fetch user's tool
  const { data: tool, error } = await supabaseAdmin
    .from('ai_applications')
    .select('id, app_name, category, is_featured, is_paid_placement, listing_type, billing_period, submission_status')
    .eq('clerk_user_id', user.id)
    .eq('publication_id', PUBLICATION_ID)
    .single()

  if (error || !tool) {
    redirect('/account')
  }

  // Check if tool is approved - must be approved to upgrade
  if (tool.submission_status !== 'approved' && tool.submission_status !== 'edited') {
    redirect('/account')
  }

  // Get categories with featured tools to check availability
  const categoriesWithFeatured = await getCategoriesWithFeaturedTools()
  const categoryHasFeatured = tool.category ? categoriesWithFeatured.has(tool.category) && !tool.is_featured : false

  // Determine current listing type
  const currentListingType = tool.listing_type ||
    (tool.is_featured ? 'featured' : tool.is_paid_placement ? 'paid_placement' : 'free')

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Upgrade Your Listing</h1>
        <p className="text-slate-600 mt-1">
          Boost visibility for <span className="font-semibold">{tool.app_name}</span>
        </p>
      </div>

      <UpgradeForm
        tool={{
          id: tool.id,
          name: tool.app_name,
          category: tool.category,
          currentListingType: currentListingType as 'free' | 'paid_placement' | 'featured',
          currentBillingPeriod: tool.billing_period as 'monthly' | 'yearly' | null
        }}
        initialListingType={listingType}
        initialBillingPeriod={billingPeriod}
        categoryHasFeatured={categoryHasFeatured}
      />
    </div>
  )
}
