import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'
import { ArticleModuleSelector } from '@/lib/article-modules'

/**
 * Reprocess Articles Workflow (ARTICLE MODULES VERSION)
 * Regenerates all articles for an existing issue using the new module system
 *
 * Steps:
 * 1. Cleanup (delete module_articles, unassign posts, set processing status)
 * 2. Deduplication (global, cross-module)
 * 3. Get active article modules
 *
 * For each active article module (sequentially):
 *   Step N+0: Assign posts and generate titles
 *   Step N+1: Generate bodies batch 1
 *   Step N+2: Generate bodies batch 2
 *   Step N+3: Fact-check articles
 *
 * Final: Select top articles, regenerate welcome, set draft
 */

export async function reprocessArticlesWorkflow(input: {
  issue_id: string
  publication_id: string
}) {
  "use workflow"

  const { issue_id, publication_id } = input

  console.log(`[Reprocess Workflow] Starting for issue: ${issue_id}`)

  // STEP 1: Cleanup
  await cleanupIssue(issue_id)

  // STEP 2: Deduplication
  await deduplicateIssue(issue_id)

  // STEP 3: Get active article modules (must be in a step to use supabaseAdmin)
  const moduleIds = await getActiveModuleIds(publication_id)

  if (moduleIds.length === 0) {
    console.log('[Reprocess Workflow] No active article modules found')
    return { issue_id, success: true }
  }

  console.log(`[Reprocess Workflow] Found ${moduleIds.length} active article modules`)

  // Process each module sequentially
  for (let i = 0; i < moduleIds.length; i++) {
    const moduleId = moduleIds[i]
    const moduleNum = i + 1
    const totalModules = moduleIds.length
    const stepOffset = 4 + (i * 4) // Start at 4 since we added a step

    // Generate titles for this module
    await generateModuleTitles(issue_id, moduleId, moduleNum, totalModules, stepOffset)

    // Generate bodies in 2 batches
    await generateModuleBodiesBatch1(issue_id, moduleId, moduleNum, totalModules, stepOffset + 1)
    await generateModuleBodiesBatch2(issue_id, moduleId, moduleNum, totalModules, stepOffset + 2)

    // Fact-check articles for this module
    await factCheckModule(issue_id, moduleId, moduleNum, totalModules, stepOffset + 3)
  }

  // Final step
  const finalStepNum = 4 + (moduleIds.length * 4) + 1
  await finalizeIssue(issue_id, moduleIds, finalStepNum)

  console.log('[Reprocess Workflow] Complete')

  return { issue_id, success: true }
}

// Step 3: Get active article module IDs
async function getActiveModuleIds(publicationId: string): Promise<string[]> {
  "use step"

  console.log('[Reprocess Step 3] Getting active article modules...')

  const modules = await ArticleModuleSelector.getActiveModules(publicationId)
  const moduleIds = modules.map(m => m.id)

  console.log(`[Reprocess Step 3] Found ${moduleIds.length} active article modules`)

  return moduleIds
}

// Step 1: Cleanup
async function cleanupIssue(issueId: string) {
  "use step"

  console.log('[Reprocess Step 1] Cleaning up issue...')

  // Delete all module_articles for this issue
  const { error: deleteModuleArticlesError } = await supabaseAdmin
    .from('module_articles')
    .delete()
    .eq('issue_id', issueId)

  if (deleteModuleArticlesError) {
    console.error('[Reprocess Step 1] Error deleting module_articles:', deleteModuleArticlesError)
  }

  // Reset issue_article_modules selections
  const { error: resetSelectionsError } = await supabaseAdmin
    .from('issue_article_modules')
    .update({ article_ids: [], used_at: null })
    .eq('issue_id', issueId)

  if (resetSelectionsError) {
    console.error('[Reprocess Step 1] Error resetting selections:', resetSelectionsError)
  }

  // Unassign all posts (set issue_id to null)
  const { error: nullPostsError } = await supabaseAdmin
    .from('rss_posts')
    .update({ issue_id: null })
    .eq('issue_id', issueId)

  if (nullPostsError) {
    console.error('[Reprocess Step 1] Error nulling posts:', nullPostsError)
  }

  // Set issue status to processing
  const { error: updateStatusError } = await supabaseAdmin
    .from('publication_issues')
    .update({ status: 'processing' })
    .eq('id', issueId)

  if (updateStatusError) {
    console.error('[Reprocess Step 1] Error updating status:', updateStatusError)
  }

  console.log('[Reprocess Step 1] Cleanup complete')
}

// Step 2: Deduplication
async function deduplicateIssue(issueId: string) {
  "use step"

  console.log('[Reprocess Step 2] Running deduplication...')

  const processor = new RSSProcessor()
  const dedupeResult = await processor.handleDuplicatesForissue(issueId)

  console.log(`[Reprocess Step 2] Deduplication: ${dedupeResult.groups} groups, ${dedupeResult.duplicates} duplicates found`)
}

// Module processing steps
async function generateModuleTitles(
  issueId: string,
  moduleId: string,
  moduleNum: number,
  totalModules: number,
  stepNum: number
) {
  "use step"

  const module = await ArticleModuleSelector.getModule(moduleId)
  const moduleName = module?.name || `Module ${moduleNum}`

  console.log(`[Reprocess Step ${stepNum}] Generating titles for ${moduleName} (${moduleNum}/${totalModules})...`)

  const processor = new RSSProcessor()

  // Assign posts to this module first
  const assignResult = await processor.assignPostsToModule(issueId, moduleId)
  console.log(`[Reprocess Step ${stepNum}] Assigned ${assignResult.assigned} posts to ${moduleName}`)

  // Generate titles
  await processor.generateTitlesForModule(issueId, moduleId)

  const { data: articles } = await supabaseAdmin
    .from('module_articles')
    .select('id, headline')
    .eq('issue_id', issueId)
    .eq('article_module_id', moduleId)
    .not('headline', 'is', null)

  console.log(`[Reprocess Step ${stepNum}] Generated ${articles?.length || 0} titles for ${moduleName}`)
}

async function generateModuleBodiesBatch1(
  issueId: string,
  moduleId: string,
  moduleNum: number,
  totalModules: number,
  stepNum: number
) {
  "use step"

  const module = await ArticleModuleSelector.getModule(moduleId)
  const moduleName = module?.name || `Module ${moduleNum}`

  console.log(`[Reprocess Step ${stepNum}] Generating bodies batch 1 for ${moduleName}...`)

  const processor = new RSSProcessor()
  await processor.generateBodiesForModule(issueId, moduleId, 0, 3)

  const { data: articles } = await supabaseAdmin
    .from('module_articles')
    .select('id')
    .eq('issue_id', issueId)
    .eq('article_module_id', moduleId)
    .not('content', 'is', null)

  console.log(`[Reprocess Step ${stepNum}] ${moduleName} has ${articles?.length || 0} articles with bodies`)
}

async function generateModuleBodiesBatch2(
  issueId: string,
  moduleId: string,
  moduleNum: number,
  totalModules: number,
  stepNum: number
) {
  "use step"

  const module = await ArticleModuleSelector.getModule(moduleId)
  const moduleName = module?.name || `Module ${moduleNum}`

  console.log(`[Reprocess Step ${stepNum}] Generating bodies batch 2 for ${moduleName}...`)

  const processor = new RSSProcessor()
  await processor.generateBodiesForModule(issueId, moduleId, 3, 3)

  const { data: articles } = await supabaseAdmin
    .from('module_articles')
    .select('id')
    .eq('issue_id', issueId)
    .eq('article_module_id', moduleId)
    .not('content', 'is', null)

  console.log(`[Reprocess Step ${stepNum}] ${moduleName} total bodies: ${articles?.length || 0}`)
}

async function factCheckModule(
  issueId: string,
  moduleId: string,
  moduleNum: number,
  totalModules: number,
  stepNum: number
) {
  "use step"

  const module = await ArticleModuleSelector.getModule(moduleId)
  const moduleName = module?.name || `Module ${moduleNum}`

  console.log(`[Reprocess Step ${stepNum}] Fact-checking ${moduleName}...`)

  const processor = new RSSProcessor()
  await processor.factCheckArticlesForModule(issueId, moduleId)

  const { data: articles } = await supabaseAdmin
    .from('module_articles')
    .select('id, fact_check_score')
    .eq('issue_id', issueId)
    .eq('article_module_id', moduleId)
    .not('fact_check_score', 'is', null)

  const avgScore = articles && articles.length > 0
    ? articles.reduce((sum, a) => sum + (a.fact_check_score || 0), 0) / articles.length
    : 0

  console.log(`[Reprocess Step ${stepNum}] Fact-checked ${articles?.length || 0} articles (avg: ${avgScore.toFixed(1)}/10)`)
}

// Final step
async function finalizeIssue(issueId: string, moduleIds: string[], stepNum: number) {
  "use step"

  console.log(`[Reprocess Step ${stepNum}] Finalizing issue...`)

  const processor = new RSSProcessor()

  // Select top articles for each module and update issue_article_modules
  for (const moduleId of moduleIds) {
    const module = await ArticleModuleSelector.getModule(moduleId)
    const articlesCount = module?.articles_count || 3

    // Get top articles by score
    const { data: topArticles } = await supabaseAdmin
      .from('module_articles')
      .select('id, post_id, rss_post:rss_posts(post_ratings(total_score))')
      .eq('issue_id', issueId)
      .eq('article_module_id', moduleId)
      .not('content', 'is', null)
      .not('headline', 'is', null)

    // Sort by score and take top N
    const sorted = (topArticles || [])
      .sort((a: any, b: any) => {
        const scoreA = a.rss_post?.post_ratings?.[0]?.total_score || 0
        const scoreB = b.rss_post?.post_ratings?.[0]?.total_score || 0
        return scoreB - scoreA
      })
      .slice(0, articlesCount)

    // Mark selected articles as active
    const selectedIds = sorted.map(a => a.id)

    if (selectedIds.length > 0) {
      // Set is_active and rank
      for (let i = 0; i < selectedIds.length; i++) {
        await supabaseAdmin
          .from('module_articles')
          .update({ is_active: true, rank: i + 1 })
          .eq('id', selectedIds[i])
      }

      // Update issue_article_modules
      await supabaseAdmin
        .from('issue_article_modules')
        .update({ article_ids: selectedIds })
        .eq('issue_id', issueId)
        .eq('article_module_id', moduleId)
    }

    console.log(`[Reprocess Step ${stepNum}] Selected ${selectedIds.length} articles for ${module?.name}`)
  }

  // Generate welcome section
  await processor.generateWelcomeSection(issueId)

  // Set status to draft
  await supabaseAdmin
    .from('publication_issues')
    .update({ status: 'draft' })
    .eq('id', issueId)

  // Unassign unused posts
  const unassignResult = await processor.unassignUnusedPosts(issueId)
  console.log(`[Reprocess Step ${stepNum}] Finalized. Unassigned ${unassignResult.unassigned} unused posts`)
}
