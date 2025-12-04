import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { ProfileCard } from './components/ProfileCard'
import { NoProfileCard } from './components/NoProfileCard'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const user = await currentUser()
  
  if (!user) {
    redirect('/sign-in')
  }

  // Fetch user's tool listing
  const { data: tool, error } = await supabaseAdmin
    .from('tools_directory')
    .select(`
      *,
      directory_categories_tools (
        category:directory_categories (
          id,
          name,
          slug
        )
      )
    `)
    .eq('clerk_user_id', user.id)
    .single()

  // Debug logging
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned, which is fine
    console.log('[Account] Clerk user ID:', user.id)
    console.log('[Account] Query error:', error)
  }

  // Transform categories from join table
  const toolWithCategories = tool ? {
    ...tool,
    categories: tool.directory_categories_tools?.map((tc: any) => tc.category).filter(Boolean) || []
  } : null

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-600 mt-1">
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
