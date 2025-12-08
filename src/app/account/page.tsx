import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { ProfileCard } from './components/ProfileCard'
import { NoProfileCard } from './components/NoProfileCard'

// Categories mapping for ai_applications
const CATEGORIES = [
  { id: 'payroll', name: 'Payroll', slug: 'payroll' },
  { id: 'hr', name: 'HR', slug: 'hr' },
  { id: 'accounting-system', name: 'Accounting System', slug: 'accounting-system' },
  { id: 'finance', name: 'Finance', slug: 'finance' },
  { id: 'productivity', name: 'Productivity', slug: 'productivity' },
  { id: 'client-management', name: 'Client Management', slug: 'client-management' },
  { id: 'banking', name: 'Banking', slug: 'banking' }
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
    .single()

  // Debug logging
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned, which is fine
    console.log('[Account] Clerk user ID:', user.id)
    console.log('[Account] Query error:', error)
  }

  // Transform ai_applications data to match DirectoryTool format for ProfileCard
  const toolWithCategories = app ? {
    id: app.id,
    tool_name: app.app_name,
    tagline: null, // ai_applications doesn't have tagline
    description: app.description,
    website_url: app.app_url,
    tool_image_url: app.screenshot_url,
    logo_image_url: app.logo_url,
    is_sponsored: app.is_paid_placement,
    status: app.submission_status || 'pending',
    rejection_reason: app.rejection_reason,
    view_count: app.view_count || 0,
    click_count: app.click_count || 0,
    clerk_user_id: app.clerk_user_id,
    categories: app.category
      ? [CATEGORIES.find(c => c.name === app.category) || CATEGORIES[4]]
      : []
  } : null

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
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
