import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { ProfileCard } from './components/ProfileCard'
import { NoProfileCard } from './components/NoProfileCard'
import { PUBLICATION_ID } from '@/lib/config'

// Categories mapping for ai_applications - matches directory.ts
const CATEGORIES = [
  { id: 'accounting-bookkeeping', name: 'Accounting & Bookkeeping', slug: 'accounting-bookkeeping' },
  { id: 'tax-compliance', name: 'Tax & Compliance', slug: 'tax-compliance' },
  { id: 'payroll', name: 'Payroll', slug: 'payroll' },
  { id: 'finance-analysis', name: 'Finance & Analysis', slug: 'finance-analysis' },
  { id: 'expense-management', name: 'Expense Management', slug: 'expense-management' },
  { id: 'client-management', name: 'Client Management', slug: 'client-management' },
  { id: 'productivity', name: 'Productivity', slug: 'productivity' },
  { id: 'hr', name: 'HR', slug: 'hr' },
  { id: 'banking-payments', name: 'Banking & Payments', slug: 'banking-payments' }
]

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const user = await currentUser()

  if (!user) {
    redirect('/sign-in')
  }

  // Fetch user's tool listing from ai_applications table
  const { data: app, error } = await supabaseAdmin
    .from('ai_applications')
    .select('*')
    .eq('clerk_user_id', user.id)
    .eq('publication_id', PUBLICATION_ID)
    .single()

  // Debug logging
  console.log('[Account] Clerk user ID:', user.id)
  console.log('[Account] Publication ID:', PUBLICATION_ID)
  console.log('[Account] App found:', app ? { id: app.id, app_name: app.app_name } : null)
  console.log('[Account] Error:', error)

  // Transform ai_applications data to match DirectoryTool format for ProfileCard
  const toolWithCategories = app ? {
    id: app.id,
    tool_name: app.app_name,
    description: app.description,
    website_url: app.app_url,
    tool_image_url: app.screenshot_url,
    logo_image_url: app.logo_url,
    is_sponsored: app.is_paid_placement,
    is_featured: app.is_featured || false,
    listing_type: app.listing_type || (app.is_featured ? 'featured' : app.is_paid_placement ? 'paid_placement' : 'free'),
    billing_period: app.billing_period || null,
    status: app.submission_status || 'pending',
    rejection_reason: app.rejection_reason,
    view_count: app.view_count || 0,
    click_count: app.click_count || 0,
    clerk_user_id: app.clerk_user_id,
    categories: app.category
      ? [CATEGORIES.find(c => c.name === app.category) || CATEGORIES[6]] // Default to Productivity
      : []
  } : null

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">My Profile</h1>
        <p className="text-slate-600 mt-1">
          Manage your AI tool listing in the directory
        </p>
      </div>

      {toolWithCategories ? (
        <ProfileCard tool={toolWithCategories} />
      ) : (
        <NoProfileCard />
      )}
    </div>
  )
}
