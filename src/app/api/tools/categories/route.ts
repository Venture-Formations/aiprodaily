import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { currentUser } from '@clerk/nextjs/server'

const PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

// Categories from directory.ts - single source of truth
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

export async function GET(request: NextRequest) {
  try {
    console.log('[Categories] API called')
    const user = await currentUser()
    console.log('[Categories] User:', user?.id || 'not logged in')

    // Get categories that have featured tools
    const { data: featuredTools, error: featuredError } = await supabaseAdmin
      .from('ai_applications')
      .select('category, clerk_user_id')
      .eq('publication_id', PUBLICATION_ID)
      .eq('is_active', true)
      .eq('is_featured', true)

    if (featuredError) {
      console.error('[Categories] Failed to fetch featured tools:', featuredError)
    }

    // Build a map of categories with featured tools and their owner
    const featuredByCategory: Record<string, string | null> = {}
    featuredTools?.forEach(tool => {
      if (tool.category) {
        featuredByCategory[tool.category] = tool.clerk_user_id
      }
    })

    // Get user's current tool to determine their listing type and current category
    let userListingType: string | null = null
    let userCurrentCategory: string | null = null

    if (user) {
      const { data: userTool } = await supabaseAdmin
        .from('ai_applications')
        .select('listing_type, is_featured, is_paid_placement, category')
        .eq('clerk_user_id', user.id)
        .eq('publication_id', PUBLICATION_ID)
        .single()

      if (userTool) {
        userListingType = userTool.listing_type ||
          (userTool.is_featured ? 'featured' : userTool.is_paid_placement ? 'paid_placement' : 'free')
        userCurrentCategory = userTool.category
      }
    }

    // Add featured status to each category
    const categoriesWithStatus = CATEGORIES.map(category => {
      const featuredOwner = featuredByCategory[category.name]
      const hasFeatured = !!featuredOwner
      // Category is disabled if:
      // 1. It has a featured tool AND
      // 2. The current user is featured AND
      // 3. The featured tool in that category is NOT owned by the current user
      const isDisabled = hasFeatured &&
        userListingType === 'featured' &&
        featuredOwner !== user?.id &&
        category.name !== userCurrentCategory // Allow keeping current category

      return {
        ...category,
        hasFeatured,
        isDisabled,
        disabledReason: isDisabled ? 'This category already has a featured tool' : null
      }
    })

    return NextResponse.json({ categories: categoriesWithStatus })
  } catch (err) {
    console.error('[Categories] Error:', err)
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to fetch categories', details: errorMessage }, { status: 500 })
  }
}
