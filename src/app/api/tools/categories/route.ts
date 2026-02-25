import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'

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

// Simple endpoint that returns static categories
// Featured tool restrictions are handled by the profile API when saving
export const GET = withApiHandler(
  { authTier: 'public', logContext: 'tools-categories' },
  async ({ request, logger }) => {
    // Return all categories - the profile API will validate featured restrictions on save
    const categoriesWithStatus = CATEGORIES.map(category => ({
      ...category,
      hasFeatured: false,
      isDisabled: false,
      disabledReason: null
    }))

    return NextResponse.json({ categories: categoriesWithStatus })
  }
)
