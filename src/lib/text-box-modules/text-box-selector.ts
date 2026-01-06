/**
 * Text Box Module Selector
 *
 * Handles initialization and selection of text box modules for issues.
 * Creates per-issue tracking records for modules and blocks.
 */

import { supabaseAdmin } from '../supabase'
import type {
  TextBoxModule,
  TextBoxBlock,
  IssueTextBoxModule,
  IssueTextBoxBlock,
  TextBoxModuleWithBlocks
} from '@/types/database'

export class TextBoxModuleSelector {
  /**
   * Get all active text box modules for a publication
   */
  static async getActiveModules(publicationId: string): Promise<TextBoxModuleWithBlocks[]> {
    const { data, error } = await supabaseAdmin
      .from('text_box_modules')
      .select(`
        *,
        blocks:text_box_blocks(*)
      `)
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('[TextBoxSelector] Error fetching modules:', error)
      return []
    }

    // Sort blocks by display_order within each module
    return (data || []).map(module => ({
      ...module,
      blocks: (module.blocks || []).sort((a: TextBoxBlock, b: TextBoxBlock) =>
        a.display_order - b.display_order
      )
    })) as TextBoxModuleWithBlocks[]
  }

  /**
   * Get a single module with its blocks
   */
  static async getModule(moduleId: string): Promise<TextBoxModuleWithBlocks | null> {
    const { data, error } = await supabaseAdmin
      .from('text_box_modules')
      .select(`
        *,
        blocks:text_box_blocks(*)
      `)
      .eq('id', moduleId)
      .single()

    if (error || !data) {
      console.error('[TextBoxSelector] Error fetching module:', error)
      return null
    }

    return {
      ...data,
      blocks: (data.blocks || []).sort((a: TextBoxBlock, b: TextBoxBlock) =>
        a.display_order - b.display_order
      )
    } as TextBoxModuleWithBlocks
  }

  /**
   * Initialize text box modules for a new issue
   * Creates issue_text_box_modules and issue_text_box_blocks records
   */
  static async initializeForIssue(
    issueId: string,
    publicationId: string
  ): Promise<{ success: boolean; modulesInitialized: number; blocksInitialized: number }> {
    try {
      // Check if modules already initialized for this issue
      const { data: existing } = await supabaseAdmin
        .from('issue_text_box_modules')
        .select('id')
        .eq('issue_id', issueId)

      if (existing && existing.length > 0) {
        console.log('[TextBoxSelector] Modules already initialized for issue:', issueId)
        return { success: true, modulesInitialized: 0, blocksInitialized: 0 }
      }

      // Get all active modules with their blocks
      const modules = await this.getActiveModules(publicationId)

      if (modules.length === 0) {
        console.log('[TextBoxSelector] No active text box modules found')
        return { success: true, modulesInitialized: 0, blocksInitialized: 0 }
      }

      let blocksInitialized = 0

      // Create issue module and block records
      for (const module of modules) {
        // Create issue module record
        await supabaseAdmin
          .from('issue_text_box_modules')
          .insert({
            issue_id: issueId,
            text_box_module_id: module.id
          })

        // Create issue block records for each block
        for (const block of module.blocks) {
          // Determine initial status based on block type
          // - static_text: completed (content is fixed)
          // - image with static type: completed (URL is fixed)
          // - ai_prompt: pending (needs AI generation)
          // - image with ai_generated type: pending (needs AI generation)
          const isStaticContent =
            block.block_type === 'static_text' ||
            (block.block_type === 'image' && block.image_type === 'static')
          const initialStatus = isStaticContent ? 'completed' : 'pending'

          await supabaseAdmin
            .from('issue_text_box_blocks')
            .insert({
              issue_id: issueId,
              text_box_block_id: block.id,
              generation_status: initialStatus,
              // Static text blocks get their content immediately
              generated_content: block.block_type === 'static_text' ? block.static_content : null,
              // Static image blocks get their URL immediately
              generated_image_url: block.block_type === 'image' && block.image_type === 'static' ? block.static_image_url : null
            })

          blocksInitialized++
        }
      }

      console.log(`[TextBoxSelector] Initialized ${modules.length} modules and ${blocksInitialized} blocks for issue ${issueId}`)
      return { success: true, modulesInitialized: modules.length, blocksInitialized }

    } catch (error) {
      console.error('[TextBoxSelector] Error initializing modules:', error)
      return { success: false, modulesInitialized: 0, blocksInitialized: 0 }
    }
  }

  /**
   * Get issue text box module selections with full details
   */
  static async getIssueSelections(issueId: string): Promise<{
    module: TextBoxModule
    blocks: TextBoxBlock[]
    issueBlocks: IssueTextBoxBlock[]
  }[]> {
    const { data: issueModules, error } = await supabaseAdmin
      .from('issue_text_box_modules')
      .select(`
        *,
        text_box_module:text_box_modules(
          *,
          blocks:text_box_blocks(*)
        )
      `)
      .eq('issue_id', issueId)

    if (error || !issueModules) {
      console.error('[TextBoxSelector] Error fetching issue selections:', error)
      return []
    }

    // Get issue blocks for all modules
    const { data: issueBlocks } = await supabaseAdmin
      .from('issue_text_box_blocks')
      .select('*')
      .eq('issue_id', issueId)

    const issueBlocksMap = new Map<string, IssueTextBoxBlock>()
    for (const ib of issueBlocks || []) {
      issueBlocksMap.set(ib.text_box_block_id, ib as IssueTextBoxBlock)
    }

    return issueModules.map(im => {
      const module = im.text_box_module as any
      const blocks = (module?.blocks || []).sort((a: TextBoxBlock, b: TextBoxBlock) =>
        a.display_order - b.display_order
      )

      return {
        module: module as TextBoxModule,
        blocks: blocks as TextBoxBlock[],
        issueBlocks: blocks.map((b: TextBoxBlock) =>
          issueBlocksMap.get(b.id) || null
        ).filter(Boolean) as IssueTextBoxBlock[]
      }
    }).filter(item => item.module)
  }

  /**
   * Get blocks that need generation at a specific timing
   */
  static async getBlocksForTiming(
    issueId: string,
    timing: 'before_articles' | 'after_articles'
  ): Promise<{
    block: TextBoxBlock
    issueBlock: IssueTextBoxBlock
  }[]> {
    // Get all AI prompt blocks with the specified timing that haven't been generated
    const { data: issueBlocks, error } = await supabaseAdmin
      .from('issue_text_box_blocks')
      .select(`
        *,
        text_box_block:text_box_blocks(*)
      `)
      .eq('issue_id', issueId)
      .eq('generation_status', 'pending')

    if (error || !issueBlocks) {
      console.error('[TextBoxSelector] Error fetching blocks for timing:', error)
      return []
    }

    // Filter to AI prompt blocks with matching timing
    return issueBlocks
      .filter(ib => {
        const block = ib.text_box_block as any
        return block?.block_type === 'ai_prompt' && block?.generation_timing === timing
      })
      .map(ib => ({
        block: ib.text_box_block as TextBoxBlock,
        issueBlock: {
          ...ib,
          text_box_block: undefined
        } as IssueTextBoxBlock
      }))
  }

  /**
   * Get image blocks that need generation
   */
  static async getImageBlocksForGeneration(issueId: string): Promise<{
    block: TextBoxBlock
    issueBlock: IssueTextBoxBlock
  }[]> {
    const { data: issueBlocks, error } = await supabaseAdmin
      .from('issue_text_box_blocks')
      .select(`
        *,
        text_box_block:text_box_blocks(*)
      `)
      .eq('issue_id', issueId)
      .eq('generation_status', 'pending')

    if (error || !issueBlocks) {
      console.error('[TextBoxSelector] Error fetching image blocks:', error)
      return []
    }

    // Filter to AI-generated image blocks
    return issueBlocks
      .filter(ib => {
        const block = ib.text_box_block as any
        return block?.block_type === 'image' && block?.image_type === 'ai_generated'
      })
      .map(ib => ({
        block: ib.text_box_block as TextBoxBlock,
        issueBlock: {
          ...ib,
          text_box_block: undefined
        } as IssueTextBoxBlock
      }))
  }

  /**
   * Update issue block with generated content
   */
  static async updateIssueBlock(
    issueBlockId: string,
    updates: {
      generated_content?: string | null
      generated_image_url?: string | null
      generation_status: 'completed' | 'failed' | 'manual'
      generation_error?: string | null
    }
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
      .from('issue_text_box_blocks')
      .update({
        ...updates,
        generated_at: updates.generation_status === 'completed' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', issueBlockId)

    if (error) {
      console.error('[TextBoxSelector] Error updating issue block:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  }

  /**
   * Set manual override content for a block
   */
  static async setOverrideContent(
    issueId: string,
    blockId: string,
    overrideContent: string | null,
    overrideImageUrl?: string | null
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
      .from('issue_text_box_blocks')
      .update({
        override_content: overrideContent,
        override_image_url: overrideImageUrl,
        generation_status: overrideContent ? 'manual' : 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('issue_id', issueId)
      .eq('text_box_block_id', blockId)

    if (error) {
      console.error('[TextBoxSelector] Error setting override:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  }

  /**
   * Record usage when newsletter is sent
   */
  static async recordUsage(issueId: string): Promise<{ success: boolean; recorded: number }> {
    const now = new Date().toISOString()

    // Mark issue modules as used
    const { data: modules, error: modulesError } = await supabaseAdmin
      .from('issue_text_box_modules')
      .update({ used_at: now })
      .eq('issue_id', issueId)
      .is('used_at', null)
      .select('id')

    if (modulesError) {
      console.error('[TextBoxSelector] Error recording usage:', modulesError)
      return { success: false, recorded: 0 }
    }

    console.log(`[TextBoxSelector] Recorded usage for ${modules?.length || 0} text box modules`)
    return { success: true, recorded: modules?.length || 0 }
  }

  /**
   * Clear all text box module data for an issue (for re-initialization)
   */
  static async clearIssueData(issueId: string): Promise<{ success: boolean }> {
    // Delete issue blocks first (due to no FK, but good practice)
    await supabaseAdmin
      .from('issue_text_box_blocks')
      .delete()
      .eq('issue_id', issueId)

    // Delete issue modules
    await supabaseAdmin
      .from('issue_text_box_modules')
      .delete()
      .eq('issue_id', issueId)

    console.log(`[TextBoxSelector] Cleared text box data for issue ${issueId}`)
    return { success: true }
  }
}
