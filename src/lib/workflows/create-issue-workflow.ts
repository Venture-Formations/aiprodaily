import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'
import { ArticleModuleSelector } from '@/lib/article-modules'

/**
 * Create Issue Workflow - ARTICLE MODULES VERSION
 * Runs after issue setup (AI selection, post assignment)
 *
 * Dynamic steps based on active article modules:
 * Step 1:  Deduplication (global, cross-module)
 *
 * For each active article module (sequentially):
 *   Step N+0: Assign posts and generate titles
 *   Step N+1: Generate bodies batch 1
 *   Step N+2: Generate bodies batch 2
 *   Step N+3: Fact-check articles
 *
 * Final: Select top articles, generate welcome, set draft
 */

export async function createIssueWorkflow(input: {
  issue_id: string
  publication_id: string
}) {
  "use workflow"

  const { issue_id, publication_id } = input

  console.log(`[Create Issue Workflow] Starting for issue: ${issue_id}`)

  // STEP 1: Deduplication
  await deduplicateIssue(issue_id)

  // STEP 2: Get active article modules
  const moduleIds = await getActiveModuleIds(publication_id)

  if (moduleIds.length === 0) {
    console.log('[Create Issue Workflow] No active article modules found')
    return { issue_id, success: true }
  }

  console.log(`[Create Issue Workflow] Found ${moduleIds.length} active article modules`)

  // Process each module sequentially
  for (let i = 0; i < moduleIds.length; i++) {
    const moduleId = moduleIds[i]
    const moduleNum = i + 1
    const totalModules = moduleIds.length
    const stepOffset = 3 + (i * 4) // Start at 3 since we have dedup and getModules

    // Generate titles for this module (also assigns posts)
    await generateModuleTitles(issue_id, moduleId, moduleNum, totalModules, stepOffset)

    // Generate bodies in 2 batches
    await generateModuleBodiesBatch1(issue_id, moduleId, moduleNum, totalModules, stepOffset + 1)
    await generateModuleBodiesBatch2(issue_id, moduleId, moduleNum, totalModules, stepOffset + 2)

    // Fact-check articles for this module
    await factCheckModule(issue_id, moduleId, moduleNum, totalModules, stepOffset + 3)
  }

  // Final step
  const finalStepNum = 3 + (moduleIds.length * 4) + 1
  await finalizeIssue(issue_id, moduleIds, finalStepNum)

  console.log('[Create Issue Workflow] ✓ Complete')

  return { issue_id, success: true }
}

// Step 1: Deduplication
async function deduplicateIssue(issueId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 1] Running deduplication...')

      const processor = new RSSProcessor()
      const dedupeResult = await processor.handleDuplicatesForissue(issueId)

      console.log(`[Workflow Step 1] Deduplication: ${dedupeResult.groups} groups, ${dedupeResult.duplicates} duplicate posts found`)
      console.log('[Workflow Step 1] ✓ Deduplication complete')

      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 1] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 1] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

// Step 2: Get active article module IDs
async function getActiveModuleIds(publicationId: string): Promise<string[]> {
  "use step"

  console.log('[Workflow Step 2] Getting active article modules...')

  const modules = await ArticleModuleSelector.getActiveModules(publicationId)
  const moduleIds = modules.map(m => m.id)

  console.log(`[Workflow Step 2] Found ${moduleIds.length} active article modules`)

  return moduleIds
}

// Module step: Generate titles (and assign posts)
async function generateModuleTitles(
  issueId: string,
  moduleId: string,
  moduleNum: number,
  totalModules: number,
  stepNum: number
) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      const module = await ArticleModuleSelector.getModule(moduleId)
      const moduleName = module?.name || `Module ${moduleNum}`

      console.log(`[Workflow Step ${stepNum}] Generating titles for ${moduleName} (${moduleNum}/${totalModules})...`)

      const processor = new RSSProcessor()

      // Assign posts to this module first
      const assignResult = await processor.assignPostsToModule(issueId, moduleId)
      console.log(`[Workflow Step ${stepNum}] Assigned ${assignResult.assigned} posts to ${moduleName}`)

      // Generate titles
      await processor.generateTitlesForModule(issueId, moduleId)

      const { data: articles } = await supabaseAdmin
        .from('module_articles')
        .select('id, headline')
        .eq('issue_id', issueId)
        .eq('article_module_id', moduleId)
        .not('headline', 'is', null)

      console.log(`[Workflow Step ${stepNum}] ✓ Generated ${articles?.length || 0} titles for ${moduleName}`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step ${stepNum}] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step ${stepNum}] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

// Module step: Generate bodies batch 1
async function generateModuleBodiesBatch1(
  issueId: string,
  moduleId: string,
  moduleNum: number,
  totalModules: number,
  stepNum: number
) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      const module = await ArticleModuleSelector.getModule(moduleId)
      const moduleName = module?.name || `Module ${moduleNum}`

      console.log(`[Workflow Step ${stepNum}] Generating bodies batch 1 for ${moduleName}...`)

      const processor = new RSSProcessor()
      await processor.generateBodiesForModule(issueId, moduleId, 0, 3)

      const { data: articles } = await supabaseAdmin
        .from('module_articles')
        .select('id')
        .eq('issue_id', issueId)
        .eq('article_module_id', moduleId)
        .not('content', 'is', null)
        .neq('content', '')

      console.log(`[Workflow Step ${stepNum}] ✓ ${moduleName} has ${articles?.length || 0} articles with bodies`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step ${stepNum}] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step ${stepNum}] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

// Module step: Generate bodies batch 2
async function generateModuleBodiesBatch2(
  issueId: string,
  moduleId: string,
  moduleNum: number,
  totalModules: number,
  stepNum: number
) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      const module = await ArticleModuleSelector.getModule(moduleId)
      const moduleName = module?.name || `Module ${moduleNum}`

      console.log(`[Workflow Step ${stepNum}] Generating bodies batch 2 for ${moduleName}...`)

      const processor = new RSSProcessor()
      await processor.generateBodiesForModule(issueId, moduleId, 3, 3)

      const { data: articles } = await supabaseAdmin
        .from('module_articles')
        .select('id')
        .eq('issue_id', issueId)
        .eq('article_module_id', moduleId)
        .not('content', 'is', null)
        .neq('content', '')

      console.log(`[Workflow Step ${stepNum}] ✓ ${moduleName} total bodies: ${articles?.length || 0}`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step ${stepNum}] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step ${stepNum}] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

// Module step: Fact-check articles
async function factCheckModule(
  issueId: string,
  moduleId: string,
  moduleNum: number,
  totalModules: number,
  stepNum: number
) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      const module = await ArticleModuleSelector.getModule(moduleId)
      const moduleName = module?.name || `Module ${moduleNum}`

      console.log(`[Workflow Step ${stepNum}] Fact-checking ${moduleName}...`)

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

      console.log(`[Workflow Step ${stepNum}] ✓ Fact-checked ${articles?.length || 0} articles (avg: ${avgScore.toFixed(1)}/10)`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step ${stepNum}] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step ${stepNum}] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

// Final step: Select top articles, generate welcome, set draft
async function finalizeIssue(issueId: string, moduleIds: string[], stepNum: number) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log(`[Workflow Step ${stepNum}] Finalizing issue...`)

      const processor = new RSSProcessor()

      // Select top articles for each module and update issue_article_modules
      let totalSelected = 0
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

          totalSelected += selectedIds.length
        }

        console.log(`[Workflow Step ${stepNum}] Selected ${selectedIds.length} articles for ${module?.name}`)
      }

      // Generate welcome section
      await processor.generateWelcomeSection(issueId)

      // Generate subject line
      if (moduleIds.length > 0) {
        const { data: topArticles } = await supabaseAdmin
          .from('module_articles')
          .select('headline')
          .eq('issue_id', issueId)
          .eq('article_module_id', moduleIds[0])
          .eq('is_active', true)
          .order('rank', { ascending: true })
          .limit(3)

        if (topArticles && topArticles.length > 0) {
          const { generateSubjectLine } = await import('@/lib/subject-line-generator')
          const result = await generateSubjectLine(issueId)

          if (result.success && result.subject_line) {
            console.log(`[Workflow Step ${stepNum}] Subject line generated`)
          }
        }
      }

      const { data: issue } = await supabaseAdmin
        .from('publication_issues')
        .select('subject_line')
        .eq('id', issueId)
        .single()

      console.log(`[Workflow Step ${stepNum}] Subject line: "${issue?.subject_line?.substring(0, 50) || 'Not found'}..."`)

      // Set status to draft
      await supabaseAdmin
        .from('publication_issues')
        .update({ status: 'draft' })
        .eq('id', issueId)

      // Unassign unused posts
      const unassignResult = await processor.unassignUnusedPosts(issueId)
      console.log(`[Workflow Step ${stepNum}] ✓ Finalized. Unassigned ${unassignResult.unassigned} unused posts`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step ${stepNum}] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step ${stepNum}] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}
