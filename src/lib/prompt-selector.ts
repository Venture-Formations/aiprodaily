import { supabaseAdmin } from './supabase'

export class PromptSelector {
  /**
   * Select one random prompt for an issue
   * Ensures all prompts are used before cycling through again
   */
  static async selectPromptForissue(issueId: string): Promise<any | null> {
    try {
      // Check if prompt already selected for this issue
      const { data: existing } = await supabaseAdmin
        .from('issue_prompt_selections')
        .select('*, prompt:prompt_ideas(*)')
        .eq('issue_id', issueId)
        .single()

      if (existing) {
        console.log('Prompt already selected for issue:', issueId)
        return existing.prompt
      }

      // Get all active prompts
      const { data: allPrompts } = await supabaseAdmin
        .from('prompt_ideas')
        .select('id')
        .eq('is_active', true)

      if (!allPrompts || allPrompts.length === 0) {
        console.log('No active prompts available')
        return null
      }

      // Get prompts that have been used recently (in issue_prompt_selections)
      const { data: usedPrompts } = await supabaseAdmin
        .from('issue_prompt_selections')
        .select('prompt_id, created_at')
        .order('created_at', { ascending: false })
        .limit(allPrompts.length)

      const usedPromptIds = new Set(usedPrompts?.map(p => p.prompt_id) || [])

      // Find unused prompts
      const unusedPromptIds = allPrompts
        .filter(p => !usedPromptIds.has(p.id))
        .map(p => p.id)

      let selectedPromptId: string

      if (unusedPromptIds.length > 0) {
        // Select random unused prompt
        selectedPromptId = unusedPromptIds[Math.floor(Math.random() * unusedPromptIds.length)]
        console.log('Selected unused prompt:', selectedPromptId)
      } else {
        // All prompts have been used, start over with random selection
        selectedPromptId = allPrompts[Math.floor(Math.random() * allPrompts.length)].id
        console.log('All prompts used, cycling through again. Selected:', selectedPromptId)
      }

      // Get full prompt details
      const { data: selectedPrompt } = await supabaseAdmin
        .from('prompt_ideas')
        .select('*')
        .eq('id', selectedPromptId)
        .single()

      if (!selectedPrompt) {
        console.log('Failed to fetch selected prompt details')
        return null
      }

      // Record selection
      await supabaseAdmin
        .from('issue_prompt_selections')
        .insert({
          issue_id: issueId,
          prompt_id: selectedPromptId,
          selection_order: 1,
          is_featured: false
        })

      console.log('Prompt selected and recorded for issue:', issueId)
      return selectedPrompt

    } catch (error) {
      console.error('Error selecting prompt for issue:', error)
      return null
    }
  }

  /**
   * Get the selected prompt for an issue
   */
  static async getPromptForissue(issueId: string): Promise<any | null> {
    try {
      const { data } = await supabaseAdmin
        .from('issue_prompt_selections')
        .select('*, prompt:prompt_ideas(*)')
        .eq('issue_id', issueId)
        .single()

      return data?.prompt || null
    } catch (error) {
      console.error('Error getting prompt for issue:', error)
      return null
    }
  }
}
