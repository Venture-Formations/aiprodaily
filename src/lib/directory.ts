import { supabaseAdmin } from './supabase'
import type { AIApplication, AIAppCategory } from '@/types/database'

const PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf' // AI Accounting Daily

// Categories derived from AIAppCategory type
const CATEGORIES: { id: string; name: AIAppCategory; slug: string; description: string }[] = [
  { id: 'payroll', name: 'Payroll', slug: 'payroll', description: 'AI tools for payroll processing and management' },
  { id: 'hr', name: 'HR', slug: 'hr', description: 'AI tools for human resources management' },
  { id: 'accounting-system', name: 'Accounting System', slug: 'accounting-system', description: 'AI-powered accounting software and systems' },
  { id: 'finance', name: 'Finance', slug: 'finance', description: 'AI tools for financial analysis and planning' },
  { id: 'productivity', name: 'Productivity', slug: 'productivity', description: 'AI tools to boost productivity' },
  { id: 'client-management', name: 'Client Management', slug: 'client-management', description: 'AI tools for managing client relationships' },
  { id: 'banking', name: 'Banking', slug: 'banking', description: 'AI tools for banking and financial services' }
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
function transformApp(app: AIApplication): DirectoryApp {
  const category = CATEGORIES.find(c => c.name === app.category) || CATEGORIES[4] // Default to Productivity

  return {
    ...app,
    // Alias mappings for UI compatibility
    tool_name: app.app_name,
    website_url: app.app_url,
    tool_image_url: app.screenshot_url,
    logo_image_url: app.logo_url,
    is_sponsored: app.is_paid_placement || app.is_affiliate,
    categories: [{ id: category.id, name: category.name, slug: category.slug }]
  }
}

/**
 * Get all active AI applications
 */
export async function getApprovedTools(): Promise<DirectoryApp[]> {
  const { data: apps, error } = await supabaseAdmin
    .from('ai_applications')
    .select('*')
    .eq('publication_id', PUBLICATION_ID)
    .eq('is_active', true)
    .order('is_paid_placement', { ascending: false })
    .order('is_affiliate', { ascending: false })
    .order('is_featured', { ascending: false })
    .order('app_name', { ascending: true })

  if (error) {
    console.error('[Directory] Error fetching AI applications:', error)
    return []
  }

  return (apps || []).map(transformApp)
}

/**
 * Get all categories with tool counts
 */
export async function getApprovedCategories(): Promise<DirectoryCategory[]> {
  // Get counts per category
  const { data: apps, error } = await supabaseAdmin
    .from('ai_applications')
    .select('category')
    .eq('publication_id', PUBLICATION_ID)
    .eq('is_active', true)

  if (error) {
    console.error('[Directory] Error fetching categories:', error)
    return CATEGORIES.map(c => ({ ...c, status: 'approved', tool_count: 0 }))
  }

  // Count apps per category
  const counts: Record<string, number> = {}
  apps?.forEach(app => {
    if (app.category) {
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
 * Get tools by category slug
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

  // Get tools in this category
  const { data: apps, error } = await supabaseAdmin
    .from('ai_applications')
    .select('*')
    .eq('publication_id', PUBLICATION_ID)
    .eq('is_active', true)
    .eq('category', category.name)
    .order('is_paid_placement', { ascending: false })
    .order('is_affiliate', { ascending: false })
    .order('app_name', { ascending: true })

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
 * Search tools by name or description
 */
export async function searchTools(query: string): Promise<DirectoryApp[]> {
  const { data: apps, error } = await supabaseAdmin
    .from('ai_applications')
    .select('*')
    .eq('publication_id', PUBLICATION_ID)
    .eq('is_active', true)
    .or(`app_name.ilike.%${query}%,description.ilike.%${query}%`)
    .order('is_paid_placement', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[Directory] Error searching tools:', error)
    return []
  }

  return (apps || []).map(transformApp)
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
 * Increment view/usage count for a tool
 */
export async function incrementToolViews(toolId: string): Promise<void> {
  try {
    const { data: app } = await supabaseAdmin
      .from('ai_applications')
      .select('times_used')
      .eq('id', toolId)
      .single()

    if (app) {
      await supabaseAdmin
        .from('ai_applications')
        .update({ times_used: (app.times_used || 0) + 1 })
        .eq('id', toolId)
    }
  } catch (error) {
    console.error('[Directory] Error incrementing views:', error)
  }
}

/**
 * Increment click count for a tool (alias for incrementToolViews)
 */
export async function incrementToolClicks(toolId: string): Promise<void> {
  return incrementToolViews(toolId)
}
