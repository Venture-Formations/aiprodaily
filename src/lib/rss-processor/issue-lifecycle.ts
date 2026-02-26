import { supabaseAdmin } from '../supabase'
import { getArticleSettings } from '../publication-settings'
import type { RSSProcessorContext } from './shared-context'
import { getNewsletterIdFromIssue } from './shared-context'
import type { Deduplication } from './deduplication'
import type { ArticleGenerator } from './article-generator'
import type { ArticleSelector } from './article-selector'

/**
 * Issue lifecycle orchestration module.
 * Handles creating issues, assigning posts, and the hybrid workflow.
 */
export class IssueLifecycle {
  private ctx: RSSProcessorContext
  private deduplication: Deduplication
  private articleGenerator: ArticleGenerator
  private articleSelector: ArticleSelector

  constructor(
    ctx: RSSProcessorContext,
    deduplication: Deduplication,
    articleGenerator: ArticleGenerator,
    articleSelector: ArticleSelector
  ) {
    this.ctx = ctx
    this.deduplication = deduplication
    this.articleGenerator = articleGenerator
    this.articleSelector = articleSelector
  }

  async processAllFeeds() {
    try {
      await this.processAllFeedsHybrid()
    } catch (error) {
      await this.ctx.errorHandler.handleError(error, {
        source: 'rss_processor',
        operation: 'processAllFeeds'
      })
      await this.ctx.slack.sendRSSProcessingAlert(false, undefined, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  /**
   * HYBRID WORKFLOW: Process issue using pre-scored posts from ingestion
   */
  async processAllFeedsHybrid() {
    console.log('=== HYBRID RSS PROCESSING START ===')

    let issueId = ''

    try {
      // STEP 1: Create NEW issue
      console.log('[Step 1/10] Creating new issue...')

      const nowCentral = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })
      const centralDate = new Date(nowCentral)
      centralDate.setHours(centralDate.getHours() + 12)
      const issueDate = centralDate.toISOString().split('T')[0]

      const { data: newissue, error: createError } = await supabaseAdmin
        .from('publication_issues')
        .insert([{ date: issueDate, status: 'processing' }])
        .select('id')
        .single()

      if (createError || !newissue) {
        throw new Error('Failed to create issue')
      }

      issueId = newissue.id
      console.log(`[Step 1/10] ✓ issue created: ${issueId} for ${issueDate}`)

      // STEP 2: Select AI applications and prompts
      console.log('[Step 2/10] Selecting AI apps and prompts...')

      try {
        const { AppModuleSelector } = await import('../ai-app-modules')
        const { PromptSelector } = await import('../prompt-selector')
        const { data: newsletter } = await supabaseAdmin
          .from('publications')
          .select('id, name, slug')
          .eq('is_active', true)
          .limit(1)
          .single()

        if (newsletter) {
          await AppModuleSelector.selectAppsForIssue(issueId, newsletter.id, new Date())
          await PromptSelector.selectPromptForissue(issueId)
        }
      } catch (error) {
        console.log('[Step 2/10] ⚠️ AI selection failed (non-critical):', error)
      }

      console.log('[Step 2/10] ✓ AI apps and prompts selected')

      // STEP 3: Assign top 12 rated posts from pool for each section
      console.log('[Step 3/10] Assigning top 12 posts per section from pool...')
      const assignResult = await this.assignTopPostsToIssue(issueId)
      console.log(`[Step 3/10] ✓ Assigned ${assignResult.primary} primary, ${assignResult.secondary} secondary posts`)

      // STEP 4: Run deduplication
      console.log('[Step 4/10] Deduplicating posts...')
      await this.deduplication.handleDuplicatesForIssue(issueId)
      const { data: duplicateGroups } = await supabaseAdmin
        .from('duplicate_groups')
        .select('id')
        .eq('issue_id', issueId)
      const groupsCount = duplicateGroups ? duplicateGroups.length : 0
      console.log(`[Step 4/10] ✓ Deduplicated: ${groupsCount} duplicate groups`)

      // STEP 5: Generate articles from top 6 remaining posts per section
      console.log('[Step 5/10] Generating articles from top 6 posts per section...')
      await this.articleGenerator.generateArticlesForSection(issueId, 'primary', 6)
      await this.articleGenerator.generateArticlesForSection(issueId, 'secondary', 6)
      const { data: generatedPrimary } = await supabaseAdmin
        .from('articles')
        .select('id')
        .eq('issue_id', issueId)
      const { data: generatedSecondary } = await supabaseAdmin
        .from('secondary_articles')
        .select('id')
        .eq('issue_id', issueId)
      console.log(`[Step 5/10] ✓ Generated ${generatedPrimary?.length || 0} primary, ${generatedSecondary?.length || 0} secondary`)

      // STEP 6: Auto-select top 3 articles per section
      console.log('[Step 6/10] Auto-selecting top 3 articles per section...')
      await this.articleSelector.selectTopArticlesForIssue(issueId)
      const { data: activeArticles } = await supabaseAdmin
        .from('articles')
        .select('id')
        .eq('issue_id', issueId)
        .eq('is_active', true)
      const { data: activeSecondary } = await supabaseAdmin
        .from('secondary_articles')
        .select('id')
        .eq('issue_id', issueId)
        .eq('is_active', true)
      console.log(`[Step 6/10] ✓ Selected ${activeArticles?.length || 0} primary, ${activeSecondary?.length || 0} secondary`)

      // STEP 7: Initialize and generate text box modules
      console.log('[Step 7/10] Generating text box modules...')
      try {
        const publicationId = await getNewsletterIdFromIssue(issueId)
        const { TextBoxModuleSelector, TextBoxGenerator } = await import('@/lib/text-box-modules')
        await TextBoxModuleSelector.initializeForIssue(issueId, publicationId)
        await TextBoxGenerator.generateBlocksWithTiming(issueId, 'after_articles')
        console.log('[Step 7/10] ✓ Text box modules generated')
      } catch (textBoxError) {
        console.log('[Step 7/10] ✓ Text box generation skipped:', textBoxError)
      }

      // STEP 8: Subject line
      const { data: issue } = await supabaseAdmin
        .from('publication_issues')
        .select('subject_line')
        .eq('id', issueId)
        .single()
      console.log(`[Step 8/10] ✓ Subject line: "${issue?.subject_line?.substring(0, 50) || 'Not found'}..."`)

      // STEP 9: Set issue status to draft
      console.log('[Step 9/10] Setting issue status to draft...')
      await supabaseAdmin
        .from('publication_issues')
        .update({ status: 'draft' })
        .eq('id', issueId)
      console.log('[Step 9/10] ✓ Status: draft')

      // STEP 10: Stage 1 Unassignment
      console.log('[Step 10/10] Stage 1 unassignment for unused posts...')
      const unassignResult = await this.unassignUnusedPosts(issueId)
      console.log(`[Step 10/10] ✓ Unassigned ${unassignResult.unassigned} posts back to pool`)

      console.log('=== HYBRID RSS PROCESSING COMPLETE ===')

    } catch (error) {
      console.error('=== HYBRID RSS PROCESSING FAILED ===')
      console.error('Error:', error)

      if (issueId) {
        await supabaseAdmin
          .from('publication_issues')
          .update({ status: 'failed' })
          .eq('id', issueId)
      }

      throw error
    }
  }

  /**
   * Get or create today's issue
   */
  async getOrCreateTodaysIssue(): Promise<string> {
    const nowCentral = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })
    const centralDate = new Date(nowCentral)
    centralDate.setHours(centralDate.getHours() + 12)
    const issueDate = centralDate.toISOString().split('T')[0]

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('publication_issues')
      .select('id, status')
      .eq('date', issueDate)
      .in('status', ['draft', 'processing'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (existingError) {
      const errorMsg = existingError instanceof Error
        ? existingError.message
        : typeof existingError === 'object' && existingError !== null
          ? JSON.stringify(existingError, null, 2)
          : String(existingError)
      console.error('Error checking for existing issue:', errorMsg)
    }

    let issueId: string

    if (existing) {
      issueId = existing.id
      console.log(`Using existing issue ${issueId} (status: ${existing.status})`)
    } else {
      const { data: newissue, error } = await supabaseAdmin
        .from('publication_issues')
        .insert([{ date: issueDate, status: 'processing' }])
        .select('id')
        .single()

      if (error || !newissue) {
        throw new Error('Failed to create issue')
      }

      issueId = newissue.id
      console.log(`Created new issue ${issueId} for date ${issueDate}`)
    }

    // Initialize AI Applications and Prompt Ideas if not already done
    try {
      const { AppModuleSelector } = await import('../ai-app-modules')
      const { PromptSelector } = await import('../prompt-selector')

      const { data: existingApps } = await supabaseAdmin
        .from('issue_ai_app_modules')
        .select('id')
        .eq('issue_id', issueId)
        .limit(1)

      const { data: existingPrompt } = await supabaseAdmin
        .from('issue_prompt_selections')
        .select('id')
        .eq('issue_id', issueId)
        .limit(1)

      const needsApps = !existingApps || existingApps.length === 0
      const needsPrompt = !existingPrompt || existingPrompt.length === 0

      if (needsApps || needsPrompt) {
        const { data: newsletter } = await supabaseAdmin
          .from('publications')
          .select('id, name, slug')
          .eq('is_active', true)
          .limit(1)
          .single()

        if (newsletter) {
          if (needsApps) {
            await AppModuleSelector.selectAppsForIssue(issueId, newsletter.id, new Date())
          }
          if (needsPrompt) {
            await PromptSelector.selectPromptForissue(issueId)
          }
        }
      }
    } catch (initError) {
      const errorMsg = initError instanceof Error
        ? initError.message
        : typeof initError === 'object' && initError !== null
          ? JSON.stringify(initError, null, 2)
          : String(initError)
      console.error('Error initializing issue content:', errorMsg)
    }

    return issueId
  }

  /**
   * Assign top-scoring posts from pool to issue
   */
  async assignTopPostsToIssue(issueId: string): Promise<{ primary: number; secondary: number }> {
    const newsletterId = await getNewsletterIdFromIssue(issueId)

    const articleSettings = await getArticleSettings(newsletterId)
    const lookbackHours = articleSettings.primary_lookback_hours
    const lookbackDate = new Date()
    lookbackDate.setHours(lookbackDate.getHours() - lookbackHours)
    const lookbackTimestamp = lookbackDate.toISOString()

    const { data: primaryFeeds } = await supabaseAdmin
      .from('rss_feeds')
      .select('id')
      .eq('active', true)
      .eq('use_for_primary_section', true)

    const primaryFeedIds = primaryFeeds?.map(f => f.id) || []

    const { data: secondaryFeeds } = await supabaseAdmin
      .from('rss_feeds')
      .select('id')
      .eq('active', true)
      .eq('use_for_secondary_section', true)

    const secondaryFeedIds = secondaryFeeds?.map(f => f.id) || []

    const { data: allPrimaryPosts } = await supabaseAdmin
      .from('rss_posts')
      .select(`
        id,
        post_ratings(total_score)
      `)
      .in('feed_id', primaryFeedIds)
      .is('issue_id', null)
      .gte('processed_at', lookbackTimestamp)
      .not('post_ratings', 'is', null)

    const topPrimary = allPrimaryPosts
      ?.sort((a: any, b: any) => {
        const scoreA = a.post_ratings?.[0]?.total_score || 0
        const scoreB = b.post_ratings?.[0]?.total_score || 0
        return scoreB - scoreA
      })
      .slice(0, 12) || []

    const { data: allSecondaryPosts } = await supabaseAdmin
      .from('rss_posts')
      .select(`
        id,
        post_ratings(total_score)
      `)
      .in('feed_id', secondaryFeedIds)
      .is('issue_id', null)
      .gte('processed_at', lookbackTimestamp)
      .not('post_ratings', 'is', null)

    const topSecondary = allSecondaryPosts
      ?.sort((a: any, b: any) => {
        const scoreA = a.post_ratings?.[0]?.total_score || 0
        const scoreB = b.post_ratings?.[0]?.total_score || 0
        return scoreB - scoreA
      })
      .slice(0, 12) || []

    const primaryIds = topPrimary?.map(p => p.id) || []
    const secondaryIds = topSecondary?.map(p => p.id) || []

    if (primaryIds.length > 0) {
      await supabaseAdmin
        .from('rss_posts')
        .update({ issue_id: issueId })
        .in('id', primaryIds)
    }

    if (secondaryIds.length > 0) {
      await supabaseAdmin
        .from('rss_posts')
        .update({ issue_id: issueId })
        .in('id', secondaryIds)
    }

    return { primary: primaryIds.length, secondary: secondaryIds.length }
  }

  /**
   * Stage 1 Unassignment: Unassign posts that were assigned but no articles generated
   */
  async unassignUnusedPosts(issueId: string): Promise<{ unassigned: number }> {
    const { data: assignedPosts } = await supabaseAdmin
      .from('rss_posts')
      .select('id')
      .eq('issue_id', issueId)

    const assignedPostIds = assignedPosts?.map(p => p.id) || []

    if (assignedPostIds.length === 0) {
      return { unassigned: 0 }
    }

    const { data: primaryArticles } = await supabaseAdmin
      .from('articles')
      .select('post_id')
      .eq('issue_id', issueId)

    const { data: secondaryArticles } = await supabaseAdmin
      .from('secondary_articles')
      .select('post_id')
      .eq('issue_id', issueId)

    const usedPostIds = [
      ...(primaryArticles?.map(a => a.post_id) || []),
      ...(secondaryArticles?.map(a => a.post_id) || [])
    ]

    const unusedPostIds = assignedPostIds.filter(id => !usedPostIds.includes(id))

    if (unusedPostIds.length === 0) {
      return { unassigned: 0 }
    }

    await supabaseAdmin
      .from('rss_posts')
      .update({ issue_id: null })
      .in('id', unusedPostIds)

    return { unassigned: unusedPostIds.length }
  }
}
