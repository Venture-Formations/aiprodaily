/**
 * Text Box Module Generator
 *
 * Handles AI content generation for text box blocks.
 * Supports placeholder injection and different generation timings.
 */

import { supabaseAdmin } from '../supabase'
import { callAI, openai } from '../openai'
import { TextBoxModuleSelector } from './text-box-selector'
import type {
  TextBoxBlock,
  TextBoxPlaceholderData,
  GenerationTiming
} from '@/types/database'

export class TextBoxGenerator {
  /**
   * Build placeholder data for AI content generation
   * Data available depends on timing (before_articles vs after_articles)
   */
  static async buildPlaceholderData(
    issueId: string,
    timing: GenerationTiming
  ): Promise<TextBoxPlaceholderData> {
    // Get issue basic info
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        id,
        date,
        publication:publications(name)
      `)
      .eq('id', issueId)
      .single()

    if (issueError || !issue) {
      console.error('[TextBoxGenerator] Error fetching issue:', issueError)
      return {
        issue_date: new Date().toISOString().split('T')[0],
        publication_name: 'Newsletter',
        subscriber_name: '{$name}'
      }
    }

    const publication = issue.publication as any

    // Basic data available at both timings
    const data: TextBoxPlaceholderData = {
      issue_date: issue.date || new Date().toISOString().split('T')[0],
      publication_name: publication?.name || 'Newsletter',
      subscriber_name: '{$name}' // MailerLite merge field - stays as template
    }

    // Early timing: only basic metadata
    if (timing === 'before_articles') {
      return data
    }

    // After articles timing: fetch full newsletter context
    // Get active module articles
    const { data: moduleArticles } = await supabaseAdmin
      .from('module_articles')
      .select('headline, content, rank')
      .eq('issue_id', issueId)
      .eq('is_active', true)
      .order('rank', { ascending: true })

    if (moduleArticles && moduleArticles.length > 0) {
      data.articles = moduleArticles.map(a => ({
        headline: a.headline || '',
        content: a.content || '',
        rank: a.rank || 0
      }))
    }

    // Get selected AI apps
    const { data: aiAppSelections } = await supabaseAdmin
      .from('issue_ai_app_modules')
      .select(`
        app_ids,
        ai_app_module:ai_app_modules(name)
      `)
      .eq('issue_id', issueId)

    if (aiAppSelections && aiAppSelections.length > 0) {
      const allAppIds = aiAppSelections.flatMap(s => s.app_ids || [])
      if (allAppIds.length > 0) {
        const { data: apps } = await supabaseAdmin
          .from('ai_applications')
          .select('app_name, tagline, description')
          .in('id', allAppIds)

        if (apps) {
          data.ai_apps = apps.map(a => ({
            name: a.app_name,
            tagline: a.tagline,
            description: a.description
          }))
        }
      }
    }

    // Get active poll
    const { data: pollSelection } = await supabaseAdmin
      .from('issue_poll_modules')
      .select(`
        poll_snapshot,
        poll:polls(question, options)
      `)
      .eq('issue_id', issueId)
      .single()

    if (pollSelection) {
      const snapshot = pollSelection.poll_snapshot as any
      const poll = pollSelection.poll as any
      const pollData = snapshot || poll
      if (pollData) {
        data.poll = {
          question: pollData.question || '',
          options: pollData.options || []
        }
      }
    }

    // Get selected ads
    const { data: adSelections } = await supabaseAdmin
      .from('issue_module_ads')
      .select(`
        advertisement:advertisements(title, body)
      `)
      .eq('issue_id', issueId)

    if (adSelections && adSelections.length > 0) {
      data.ads = adSelections
        .filter(s => s.advertisement)
        .map(s => {
          const ad = s.advertisement as any
          return {
            title: ad?.title || null,
            body: ad?.body || null
          }
        })
    }

    return data
  }

  /**
   * Inject placeholders into prompt text
   */
  static injectPlaceholders(promptText: string, data: TextBoxPlaceholderData): string {
    let result = promptText

    // Basic placeholders
    result = result.replace(/\{\{issue_date\}\}/g, data.issue_date)
    result = result.replace(/\{\{publication_name\}\}/g, data.publication_name)
    result = result.replace(/\{\{subscriber_name\}\}/g, data.subscriber_name)

    // Article placeholders ({{article_1_headline}}, {{article_1_content}}, etc.)
    if (data.articles) {
      for (let i = 0; i < data.articles.length; i++) {
        const num = i + 1
        result = result.replace(new RegExp(`\\{\\{article_${num}_headline\\}\\}`, 'g'), data.articles[i].headline)
        result = result.replace(new RegExp(`\\{\\{article_${num}_content\\}\\}`, 'g'), data.articles[i].content)
      }
    }

    // AI app placeholders
    if (data.ai_apps) {
      for (let i = 0; i < data.ai_apps.length; i++) {
        const num = i + 1
        result = result.replace(new RegExp(`\\{\\{ai_app_${num}_name\\}\\}`, 'g'), data.ai_apps[i].name)
        result = result.replace(new RegExp(`\\{\\{ai_app_${num}_tagline\\}\\}`, 'g'), data.ai_apps[i].tagline || '')
        result = result.replace(new RegExp(`\\{\\{ai_app_${num}_description\\}\\}`, 'g'), data.ai_apps[i].description)
      }
    }

    // Poll placeholders
    if (data.poll) {
      result = result.replace(/\{\{poll_question\}\}/g, data.poll.question)
      result = result.replace(/\{\{poll_options\}\}/g, data.poll.options.join(', '))
    }

    // Ad placeholders
    if (data.ads) {
      for (let i = 0; i < data.ads.length; i++) {
        const num = i + 1
        result = result.replace(new RegExp(`\\{\\{ad_${num}_title\\}\\}`, 'g'), data.ads[i].title || '')
        result = result.replace(new RegExp(`\\{\\{ad_${num}_body\\}\\}`, 'g'), data.ads[i].body || '')
      }
    }

    // Clear any remaining unmatched placeholders
    result = result.replace(/\{\{[^}]+\}\}/g, '')

    return result
  }

  /**
   * Generate content for a single AI prompt block
   */
  static async generateBlockContent(
    block: TextBoxBlock,
    issueId: string,
    data: TextBoxPlaceholderData
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    if (block.block_type !== 'ai_prompt' || !block.ai_prompt_json) {
      return { success: false, error: 'Not an AI prompt block' }
    }

    try {
      const promptConfig = block.ai_prompt_json as {
        prompt?: string
        model?: string
        provider?: string
        temperature?: number
        max_tokens?: number
        system_prompt?: string
      }

      if (!promptConfig.prompt) {
        return { success: false, error: 'No prompt text configured' }
      }

      // Inject placeholders into the prompt
      const injectedPrompt = this.injectPlaceholders(promptConfig.prompt, data)

      // Build full prompt with system prompt if provided
      const fullPrompt = promptConfig.system_prompt
        ? `${promptConfig.system_prompt}\n\n${injectedPrompt}`
        : injectedPrompt

      // Determine provider (default to openai)
      const provider = promptConfig.provider === 'anthropic' || promptConfig.provider === 'claude'
        ? 'claude'
        : 'openai'

      // Call AI with the prompt using existing callAI function
      const result = await callAI(
        fullPrompt,
        promptConfig.max_tokens || 500,
        promptConfig.temperature || 0.7,
        provider
      )

      // Extract content from result
      let content = ''
      if (typeof result === 'string') {
        content = result.trim()
      } else if (result && typeof result === 'object') {
        content = result.content || result.text || result.raw || JSON.stringify(result)
      }

      if (!content) {
        return { success: false, error: 'Empty response from AI' }
      }

      return { success: true, content }

    } catch (error) {
      console.error('[TextBoxGenerator] Error generating content:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Generate AI image for a block
   */
  static async generateBlockImage(
    block: TextBoxBlock,
    data: TextBoxPlaceholderData
  ): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
    if (block.block_type !== 'image' || block.image_type !== 'ai_generated') {
      return { success: false, error: 'Not an AI image block' }
    }

    if (!block.ai_image_prompt) {
      return { success: false, error: 'No image prompt configured' }
    }

    try {
      // Inject placeholders into image prompt
      const injectedPrompt = this.injectPlaceholders(block.ai_image_prompt, data)

      // Generate image using OpenAI DALL-E 3
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: injectedPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard'
      })

      const imageUrl = response.data?.[0]?.url

      if (!imageUrl) {
        return { success: false, error: 'No image URL in response' }
      }

      return { success: true, imageUrl }

    } catch (error) {
      console.error('[TextBoxGenerator] Error generating image:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Generate content for all blocks with a specific timing
   */
  static async generateBlocksWithTiming(
    issueId: string,
    timing: GenerationTiming
  ): Promise<{ success: boolean; generated: number; failed: number }> {
    console.log(`[TextBoxGenerator] Generating blocks with timing: ${timing} for issue: ${issueId}`)

    // Build placeholder data for this timing
    const placeholderData = await this.buildPlaceholderData(issueId, timing)

    // Get blocks that need generation
    const blocksToGenerate = await TextBoxModuleSelector.getBlocksForTiming(issueId, timing)

    let generated = 0
    let failed = 0

    for (const { block, issueBlock } of blocksToGenerate) {
      // Mark as generating
      await TextBoxModuleSelector.updateIssueBlock(issueBlock.id, {
        generation_status: 'generating' as any
      })

      // Generate content
      const result = await this.generateBlockContent(block, issueId, placeholderData)

      if (result.success && result.content) {
        await TextBoxModuleSelector.updateIssueBlock(issueBlock.id, {
          generated_content: result.content,
          generation_status: 'completed'
        })
        generated++
        console.log(`[TextBoxGenerator] Generated content for block ${block.id}`)
      } else {
        await TextBoxModuleSelector.updateIssueBlock(issueBlock.id, {
          generation_status: 'failed',
          generation_error: result.error || 'Unknown error'
        })
        failed++
        console.error(`[TextBoxGenerator] Failed to generate block ${block.id}: ${result.error}`)
      }
    }

    // Also handle AI image blocks (typically after_articles timing)
    if (timing === 'after_articles') {
      const imageBlocks = await TextBoxModuleSelector.getImageBlocksForGeneration(issueId)

      for (const { block, issueBlock } of imageBlocks) {
        await TextBoxModuleSelector.updateIssueBlock(issueBlock.id, {
          generation_status: 'generating' as any
        })

        const result = await this.generateBlockImage(block, placeholderData)

        if (result.success && result.imageUrl) {
          await TextBoxModuleSelector.updateIssueBlock(issueBlock.id, {
            generated_image_url: result.imageUrl,
            generation_status: 'completed'
          })
          generated++
          console.log(`[TextBoxGenerator] Generated image for block ${block.id}`)
        } else {
          await TextBoxModuleSelector.updateIssueBlock(issueBlock.id, {
            generation_status: 'failed',
            generation_error: result.error || 'Unknown error'
          })
          failed++
          console.error(`[TextBoxGenerator] Failed to generate image ${block.id}: ${result.error}`)
        }
      }
    }

    console.log(`[TextBoxGenerator] Completed: ${generated} generated, ${failed} failed`)
    return { success: failed === 0, generated, failed }
  }

  /**
   * Regenerate a single block's content
   */
  static async regenerateBlock(
    issueId: string,
    blockId: string
  ): Promise<{ success: boolean; content?: string; imageUrl?: string; error?: string }> {
    // Get block and issue block info
    const { data: block } = await supabaseAdmin
      .from('text_box_blocks')
      .select('*')
      .eq('id', blockId)
      .single()

    if (!block) {
      return { success: false, error: 'Block not found' }
    }

    const { data: issueBlock } = await supabaseAdmin
      .from('issue_text_box_blocks')
      .select('id')
      .eq('issue_id', issueId)
      .eq('text_box_block_id', blockId)
      .single()

    if (!issueBlock) {
      return { success: false, error: 'Issue block not found' }
    }

    // Build placeholder data based on block timing
    const timing = (block as TextBoxBlock).generation_timing || 'after_articles'
    const placeholderData = await this.buildPlaceholderData(issueId, timing)

    if (block.block_type === 'ai_prompt') {
      const result = await this.generateBlockContent(block as TextBoxBlock, issueId, placeholderData)

      if (result.success) {
        await TextBoxModuleSelector.updateIssueBlock(issueBlock.id, {
          generated_content: result.content || null,
          generation_status: 'completed',
          generation_error: null
        })
      }

      return result
    }

    if (block.block_type === 'image' && block.image_type === 'ai_generated') {
      const result = await this.generateBlockImage(block as TextBoxBlock, placeholderData)

      if (result.success) {
        await TextBoxModuleSelector.updateIssueBlock(issueBlock.id, {
          generated_image_url: result.imageUrl || null,
          generation_status: 'completed',
          generation_error: null
        })
      }

      return result
    }

    return { success: false, error: 'Block type does not support regeneration' }
  }

  /**
   * Test a prompt with placeholder injection using last sent issue data
   */
  static async testPrompt(
    publicationId: string,
    promptText: string,
    timing: GenerationTiming = 'after_articles'
  ): Promise<{ success: boolean; result?: string; injectedPrompt?: string; error?: string }> {
    try {
      // Get last sent issue for testing
      const { data: lastIssue } = await supabaseAdmin
        .from('publication_issues')
        .select('id')
        .eq('publication_id', publicationId)
        .eq('status', 'sent')
        .order('final_sent_at', { ascending: false })
        .limit(1)
        .single()

      if (!lastIssue) {
        return { success: false, error: 'No sent issues found for testing' }
      }

      // Build placeholder data from last issue
      const placeholderData = await this.buildPlaceholderData(lastIssue.id, timing)

      // Inject placeholders
      const injectedPrompt = this.injectPlaceholders(promptText, placeholderData)

      // Call AI with injected prompt
      const result = await callAI(
        injectedPrompt,
        500,
        0.7,
        'openai'
      )

      let content = ''
      if (typeof result === 'string') {
        content = result
      } else if (result && typeof result === 'object') {
        content = result.content || result.text || result.raw || JSON.stringify(result)
      }

      return {
        success: true,
        result: content,
        injectedPrompt
      }

    } catch (error) {
      console.error('[TextBoxGenerator] Error testing prompt:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}
