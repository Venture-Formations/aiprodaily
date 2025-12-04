import { supabaseAdmin } from './supabase'
import type {
  DirectoryTool,
  DirectoryCategory,
  DirectoryToolWithCategories,
  DirectoryCategoryWithTools
} from '@/types/database'

const PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf' // AI Accounting Daily

/**
 * Get all approved tools with their categories
 */
export async function getApprovedTools(): Promise<DirectoryToolWithCategories[]> {
  const { data: tools, error } = await supabaseAdmin
    .from('tools_directory')
    .select(`
      *,
      directory_categories_tools!inner(
        category:directory_categories(*)
      )
    `)
    .eq('publication_id', PUBLICATION_ID)
    .eq('status', 'approved')
    .order('is_sponsored', { ascending: false })
    .order('is_featured', { ascending: false })
    .order('tool_name', { ascending: true })

  if (error) {
    console.error('[Directory] Error fetching approved tools:', error)
    return []
  }

  // Transform the nested data structure
  return (tools || []).map(tool => ({
    ...tool,
    categories: tool.directory_categories_tools?.map((ct: any) => ct.category).filter(Boolean) || []
  }))
}

/**
 * Get all approved categories with tool counts
 */
export async function getApprovedCategories(): Promise<DirectoryCategoryWithTools[]> {
  const { data: categories, error } = await supabaseAdmin
    .from('directory_categories')
    .select(`
      *,
      directory_categories_tools(
        tool:tools_directory(*)
      )
    `)
    .eq('publication_id', PUBLICATION_ID)
    .eq('status', 'approved')
    .order('display_order', { ascending: true })

  if (error) {
    console.error('[Directory] Error fetching categories:', error)
    return []
  }

  // Transform and add tool counts
  return (categories || []).map(category => ({
    ...category,
    tools: category.directory_categories_tools
      ?.map((ct: any) => ct.tool)
      .filter((tool: any) => tool?.status === 'approved') || [],
    tool_count: category.directory_categories_tools
      ?.filter((ct: any) => ct.tool?.status === 'approved').length || 0
  }))
}

/**
 * Get a single tool by ID with categories
 */
export async function getToolById(toolId: string): Promise<DirectoryToolWithCategories | null> {
  const { data: tool, error } = await supabaseAdmin
    .from('tools_directory')
    .select(`
      *,
      directory_categories_tools(
        category:directory_categories(*)
      )
    `)
    .eq('id', toolId)
    .eq('publication_id', PUBLICATION_ID)
    .single()

  if (error || !tool) {
    console.error('[Directory] Error fetching tool:', error)
    return null
  }

  return {
    ...tool,
    categories: tool.directory_categories_tools?.map((ct: any) => ct.category).filter(Boolean) || []
  }
}

/**
 * Get tools by category slug
 */
export async function getToolsByCategory(categorySlug: string): Promise<{
  category: DirectoryCategory | null
  tools: DirectoryToolWithCategories[]
}> {
  // First get the category
  const { data: category, error: catError } = await supabaseAdmin
    .from('directory_categories')
    .select('*')
    .eq('publication_id', PUBLICATION_ID)
    .eq('slug', categorySlug)
    .eq('status', 'approved')
    .single()

  if (catError || !category) {
    return { category: null, tools: [] }
  }

  // Get tools in this category
  const { data: categoryTools, error: toolsError } = await supabaseAdmin
    .from('directory_categories_tools')
    .select(`
      tool:tools_directory(
        *,
        directory_categories_tools(
          category:directory_categories(*)
        )
      )
    `)
    .eq('category_id', category.id)

  if (toolsError) {
    console.error('[Directory] Error fetching category tools:', toolsError)
    return { category, tools: [] }
  }

  const tools = (categoryTools || [])
    .map((ct: any) => ct.tool)
    .filter((tool: any) => tool?.status === 'approved')
    .map((tool: any) => ({
      ...tool,
      categories: tool.directory_categories_tools?.map((ct: any) => ct.category).filter(Boolean) || []
    }))

  return { category, tools }
}

/**
 * Search tools by name or description
 */
export async function searchTools(query: string): Promise<DirectoryToolWithCategories[]> {
  const { data: tools, error } = await supabaseAdmin
    .from('tools_directory')
    .select(`
      *,
      directory_categories_tools(
        category:directory_categories(*)
      )
    `)
    .eq('publication_id', PUBLICATION_ID)
    .eq('status', 'approved')
    .or(`tool_name.ilike.%${query}%,description.ilike.%${query}%,tagline.ilike.%${query}%`)
    .order('is_sponsored', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[Directory] Error searching tools:', error)
    return []
  }

  return (tools || []).map(tool => ({
    ...tool,
    categories: tool.directory_categories_tools?.map((ct: any) => ct.category).filter(Boolean) || []
  }))
}

/**
 * Get pending tools for admin review
 */
export async function getPendingTools(): Promise<DirectoryToolWithCategories[]> {
  const { data: tools, error } = await supabaseAdmin
    .from('tools_directory')
    .select(`
      *,
      directory_categories_tools(
        category:directory_categories(*)
      )
    `)
    .eq('publication_id', PUBLICATION_ID)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Directory] Error fetching pending tools:', error)
    return []
  }

  return (tools || []).map(tool => ({
    ...tool,
    categories: tool.directory_categories_tools?.map((ct: any) => ct.category).filter(Boolean) || []
  }))
}

/**
 * Increment view count for a tool
 */
export async function incrementToolViews(toolId: string): Promise<void> {
  try {
    const { data: tool } = await supabaseAdmin
      .from('tools_directory')
      .select('view_count')
      .eq('id', toolId)
      .single()

    if (tool) {
      await supabaseAdmin
        .from('tools_directory')
        .update({ view_count: (tool.view_count || 0) + 1 })
        .eq('id', toolId)
    }
  } catch (error) {
    console.error('[Directory] Error incrementing views:', error)
  }
}

/**
 * Increment click count for a tool
 */
export async function incrementToolClicks(toolId: string): Promise<void> {
  const { data: tool } = await supabaseAdmin
    .from('tools_directory')
    .select('click_count')
    .eq('id', toolId)
    .single()

  if (tool) {
    await supabaseAdmin
      .from('tools_directory')
      .update({ click_count: (tool.click_count || 0) + 1 })
      .eq('id', toolId)
  }
}
