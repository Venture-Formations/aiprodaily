import { supabaseAdmin } from './supabase'
import { PUBLICATION_ID } from './config'
import type { AIApplication, AIAppCategory } from '@/types/database'

// Categories derived from AIAppCategory type
const CATEGORIES: { id: string; name: AIAppCategory; slug: string; description: string }[] = [
  { id: 'accounting-bookkeeping', name: 'Accounting & Bookkeeping', slug: 'accounting-bookkeeping', description: 'Discover top AI accounting software and bookkeeping tools that automate journal entries, reconciliations, and financial reporting for accountants and firms.' },
  { id: 'tax-compliance', name: 'Tax & Compliance', slug: 'tax-compliance', description: 'Find the best AI tax preparation and compliance tools to streamline filing, identify deductions, and stay current with regulations.' },
  { id: 'payroll', name: 'Payroll', slug: 'payroll', description: 'Browse top AI payroll solutions that automate wage calculations, tax withholdings, direct deposits, and compliance reporting.' },
  { id: 'finance-analysis', name: 'Finance & Analysis', slug: 'finance-analysis', description: 'Explore the best AI financial planning and analysis tools for forecasting, budgeting, cash flow management, and data-driven decisions.' },
  { id: 'expense-management', name: 'Expense Management', slug: 'expense-management', description: 'Find top AI expense tracking tools that automate receipt capture, categorization, reimbursements, and spend analytics.' },
  { id: 'client-management', name: 'Client Management', slug: 'client-management', description: 'Discover the best AI-powered CRM and client portal solutions for accounting firms to manage relationships and workflows.' },
  { id: 'productivity', name: 'Productivity', slug: 'productivity', description: 'Browse top AI productivity tools that help accountants automate repetitive tasks, manage documents, and work smarter.' },
  { id: 'hr', name: 'HR', slug: 'hr', description: 'Find the best AI human resources tools for recruiting, onboarding, employee management, and HR compliance.' },
  { id: 'banking-payments', name: 'Banking & Payments', slug: 'banking-payments', description: 'Explore top AI banking integrations and payment tools for automated bank feeds, invoicing, and receivables management.' }
]

export interface DirectoryApp extends AIApplication {
  // Alias fields for compatibility with existing UI
  tool_name: string
  website_url: string
  tool_image_url: string | null
  logo_image_url: string | null
  is_sponsored: boolean
  categories: { id: string; name: string; slug: string }[]
}

export interface DirectoryCategory {
  id: string
  name: string
  slug: string
  description?: string
  status?: string
  tool_count?: number
}

/**
 * Transform AIApplication to DirectoryApp format for UI compatibility
 */
export function transformApp(app: AIApplication): DirectoryApp {
  const category = CATEGORIES.find(c => c.name === app.category) || CATEGORIES[4] // Default to Productivity

  return {
    ...app,
    // Alias mappings for UI compatibility
    tool_name: app.app_name,
    website_url: app.app_url,
    tool_image_url: app.screenshot_url,
    logo_image_url: app.logo_url,
    is_sponsored: app.is_paid_placement,
    categories: [{ id: category.id, name: category.name, slug: category.slug }]
  }
}

/**
 * Get all active AI applications that are visible in the directory
 * Only shows apps from modules where show_in_directory = true, or apps with no module assignment
 */
export async function getApprovedTools(): Promise<DirectoryApp[]> {
  // First, get all modules with show_in_directory = true
  const { data: visibleModules } = await supabaseAdmin
    .from('ai_app_modules')
    .select('id')
    .eq('publication_id', PUBLICATION_ID)
    .eq('show_in_directory', true)

  const visibleModuleIds = visibleModules?.map(m => m.id) || []

  // Get apps: either no module (backwards compatible) or in a visible module
  const { data: apps, error } = await supabaseAdmin
    .from('ai_applications')
    .select('*')
    .eq('publication_id', PUBLICATION_ID)
    .eq('is_active', true)
    .or(`ai_app_module_id.is.null,ai_app_module_id.in.(${visibleModuleIds.join(',')})`)
    .order('is_paid_placement', { ascending: false })  // Sponsored first
    .order('is_featured', { ascending: false })        // Then featured
    .order('is_affiliate', { ascending: false })       // Then affiliates
    .order('app_name', { ascending: true })            // Then alphabetically

  if (error) {
    console.error('[Directory] Error fetching AI applications:', error)
    return []
  }

  return (apps || []).map(transformApp)
}

/**
 * Get all categories with tool counts (only counting directory-visible apps)
 */
export async function getApprovedCategories(): Promise<DirectoryCategory[]> {
  // First, get all modules with show_in_directory = true
  const { data: visibleModules } = await supabaseAdmin
    .from('ai_app_modules')
    .select('id')
    .eq('publication_id', PUBLICATION_ID)
    .eq('show_in_directory', true)

  const visibleModuleIds = visibleModules?.map(m => m.id) || []

  // Get counts per category (only from visible modules or unassigned apps)
  const { data: apps, error } = await supabaseAdmin
    .from('ai_applications')
    .select('category, ai_app_module_id')
    .eq('publication_id', PUBLICATION_ID)
    .eq('is_active', true)

  if (error) {
    console.error('[Directory] Error fetching categories:', error)
    return CATEGORIES.map(c => ({ ...c, status: 'approved', tool_count: 0 }))
  }

  // Count apps per category (filtered by directory visibility)
  const counts: Record<string, number> = {}
  apps?.forEach(app => {
    // Only count if: no module assignment OR module is visible in directory
    const isVisible = !app.ai_app_module_id || visibleModuleIds.includes(app.ai_app_module_id)
    if (app.category && isVisible) {
      counts[app.category] = (counts[app.category] || 0) + 1
    }
  })

  return CATEGORIES.map(c => ({
    ...c,
    status: 'approved',
    tool_count: counts[c.name] || 0
  }))
}

/**
 * Get a single tool by ID
 */
export async function getToolById(toolId: string): Promise<DirectoryApp | null> {
  const { data: app, error } = await supabaseAdmin
    .from('ai_applications')
    .select('*')
    .eq('id', toolId)
    .eq('publication_id', PUBLICATION_ID)
    .single()

  if (error || !app) {
    console.error('[Directory] Error fetching tool:', error)
    return null
  }

  return transformApp(app)
}

/**
 * Get tools by category slug (only directory-visible apps)
 */
export async function getToolsByCategory(categorySlug: string): Promise<{
  category: DirectoryCategory | null
  tools: DirectoryApp[]
}> {
  // Find the category
  const category = CATEGORIES.find(c => c.slug === categorySlug)

  if (!category) {
    return { category: null, tools: [] }
  }

  // First, get all modules with show_in_directory = true
  const { data: visibleModules } = await supabaseAdmin
    .from('ai_app_modules')
    .select('id')
    .eq('publication_id', PUBLICATION_ID)
    .eq('show_in_directory', true)

  const visibleModuleIds = visibleModules?.map(m => m.id) || []

  // Get tools in this category (filtered by directory visibility)
  const { data: apps, error } = await supabaseAdmin
    .from('ai_applications')
    .select('*')
    .eq('publication_id', PUBLICATION_ID)
    .eq('is_active', true)
    .eq('category', category.name)
    .or(`ai_app_module_id.is.null,ai_app_module_id.in.(${visibleModuleIds.join(',')})`)
    .order('is_paid_placement', { ascending: false })  // Sponsored first
    .order('is_featured', { ascending: false })        // Then featured
    .order('is_affiliate', { ascending: false })       // Then affiliates
    .order('app_name', { ascending: true })            // Then alphabetically

  if (error) {
    console.error('[Directory] Error fetching category tools:', error)
    return { category: { ...category, status: 'approved', tool_count: 0 }, tools: [] }
  }

  return {
    category: { ...category, status: 'approved', tool_count: apps?.length || 0 },
    tools: (apps || []).map(transformApp)
  }
}

/**
 * Search tools by name or description (only directory-visible apps)
 */
export async function searchTools(query: string): Promise<DirectoryApp[]> {
  // First, get all modules with show_in_directory = true
  const { data: visibleModules } = await supabaseAdmin
    .from('ai_app_modules')
    .select('id')
    .eq('publication_id', PUBLICATION_ID)
    .eq('show_in_directory', true)

  const visibleModuleIds = new Set(visibleModules?.map(m => m.id) || [])

  // Search by name or description
  const { data: apps, error } = await supabaseAdmin
    .from('ai_applications')
    .select('*')
    .eq('publication_id', PUBLICATION_ID)
    .eq('is_active', true)
    .or(`app_name.ilike.%${query}%,description.ilike.%${query}%`)
    .order('is_paid_placement', { ascending: false })  // Sponsored first
    .order('is_featured', { ascending: false })        // Then featured
    .order('is_affiliate', { ascending: false })       // Then affiliates
    .order('app_name', { ascending: true })            // Then alphabetically
    .limit(100)  // Fetch more to account for filtering

  if (error) {
    console.error('[Directory] Error searching tools:', error)
    return []
  }

  // Filter to only show apps from visible modules or unassigned apps
  const filteredApps = (apps || []).filter(app =>
    !app.ai_app_module_id || visibleModuleIds.has(app.ai_app_module_id)
  ).slice(0, 50)

  return filteredApps.map(transformApp)
}

/**
 * Get pending tools for admin review (tools with is_active = false)
 */
export async function getPendingTools(): Promise<DirectoryApp[]> {
  const { data: apps, error } = await supabaseAdmin
    .from('ai_applications')
    .select('*')
    .eq('publication_id', PUBLICATION_ID)
    .eq('is_active', false)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Directory] Error fetching pending tools:', error)
    return []
  }

  return (apps || []).map(transformApp)
}

/**
 * Increment view count for a tool (when profile page is viewed)
 */
export async function incrementToolViews(toolId: string): Promise<void> {
  try {
    const { data: app } = await supabaseAdmin
      .from('ai_applications')
      .select('view_count')
      .eq('id', toolId)
      .single()

    if (app) {
      await supabaseAdmin
        .from('ai_applications')
        .update({ view_count: (app.view_count || 0) + 1 })
        .eq('id', toolId)
    }
  } catch (error) {
    console.error('[Directory] Error incrementing view_count:', error)
  }
}

/**
 * Increment click count for a tool (when Visit Website is clicked)
 */
export async function incrementToolClicks(toolId: string): Promise<void> {
  try {
    const { data: app } = await supabaseAdmin
      .from('ai_applications')
      .select('click_count')
      .eq('id', toolId)
      .single()

    if (app) {
      await supabaseAdmin
        .from('ai_applications')
        .update({ click_count: (app.click_count || 0) + 1 })
        .eq('id', toolId)
    }
  } catch (error) {
    console.error('[Directory] Error incrementing click_count:', error)
  }
}

// Default pricing values
const DEFAULT_PRICING = {
  paidPlacementPrice: 30,
  featuredPrice: 60,
  yearlyDiscountMonths: 2
}

export interface DirectoryPricing {
  paidPlacementPrice: number
  featuredPrice: number
  yearlyDiscountMonths: number
  // Computed values
  paidPlacementYearlyPrice: number
  featuredYearlyPrice: number
}

/**
 * Get directory pricing from publication_settings
 * Falls back to defaults if settings are not configured
 */
export async function getDirectoryPricing(): Promise<DirectoryPricing> {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from('publication_settings')
      .select('key, value')
      .eq('publication_id', PUBLICATION_ID)
      .in('key', ['directory_paid_placement_price', 'directory_featured_price', 'directory_yearly_discount_months'])

    if (error) {
      console.error('[Directory] Error fetching pricing settings:', error)
      return computePricing(DEFAULT_PRICING)
    }

    // Build settings map from database
    const settingsMap: Record<string, string> = {}
    settings?.forEach(s => {
      if (s.value !== null) {
        settingsMap[s.key] = s.value
      }
    })

    const pricing = {
      paidPlacementPrice: settingsMap.directory_paid_placement_price
        ? parseFloat(settingsMap.directory_paid_placement_price)
        : DEFAULT_PRICING.paidPlacementPrice,
      featuredPrice: settingsMap.directory_featured_price
        ? parseFloat(settingsMap.directory_featured_price)
        : DEFAULT_PRICING.featuredPrice,
      yearlyDiscountMonths: settingsMap.directory_yearly_discount_months
        ? parseInt(settingsMap.directory_yearly_discount_months)
        : DEFAULT_PRICING.yearlyDiscountMonths
    }

    return computePricing(pricing)
  } catch (error) {
    console.error('[Directory] Unexpected error fetching pricing:', error)
    return computePricing(DEFAULT_PRICING)
  }
}

/**
 * Compute yearly prices based on monthly price and discount months
 */
function computePricing(base: { paidPlacementPrice: number; featuredPrice: number; yearlyDiscountMonths: number }): DirectoryPricing {
  return {
    ...base,
    paidPlacementYearlyPrice: base.paidPlacementPrice * (12 - base.yearlyDiscountMonths),
    featuredYearlyPrice: base.featuredPrice * (12 - base.yearlyDiscountMonths)
  }
}

/**
 * Get categories that already have a featured tool
 * Returns a Set of category names that have featured tools
 */
export async function getCategoriesWithFeaturedTools(): Promise<Set<string>> {
  const { data: featuredTools, error } = await supabaseAdmin
    .from('ai_applications')
    .select('category')
    .eq('publication_id', PUBLICATION_ID)
    .eq('is_active', true)
    .eq('is_featured', true)

  if (error) {
    console.error('[Directory] Error fetching featured tools:', error)
    return new Set()
  }

  const categoriesWithFeatured = new Set<string>()
  featuredTools?.forEach(tool => {
    if (tool.category) {
      categoriesWithFeatured.add(tool.category)
    }
  })

  return categoriesWithFeatured
}
