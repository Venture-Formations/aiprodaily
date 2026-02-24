import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'
import { ModuleAdSelector } from '@/lib/ad-modules'
import { PollModuleSelector } from '@/lib/poll-modules'
import { ArticleModuleSelector } from '@/lib/article-modules'

/**
 * RSS Processing Workflow (DYNAMIC ARTICLE MODULES)
 * Each step gets its own 800-second timeout
 *
 * NEW STRUCTURE:
 * Step 1:  Setup (create issue, get article modules, assign posts)
 * Step 2:  Deduplication (global, cross-mod)
 *
 * For each active article mod (sequentially):
 *   Step N+0: Generate titles for mod
 *   Step N+1: Generate bodies batch 1 for mod
 *   Step N+2: Generate bodies batch 2 for mod
 *   Step N+3: Fact-check articles for mod
 *
 * Step FINAL: Finalize (select top articles, generate welcome, ads, polls)
 */
export async function processRSSWorkflow(input: {
  trigger: 'cron' | 'manual'
  publication_id: string
}) {
  "use workflow"

  let issueId: string

  console.log(`[Workflow] Starting for newsletter: ${input.publication_id}`)

  // STEP 1: Setup - Create issue, get modules, assign posts
  const setupResult = await setupIssue(input.publication_id)
  issueId = setupResult.issueId
  const moduleIds = setupResult.moduleIds

  // STEP 2: Deduplication (global, cross-mod)
  await deduplicateIssue(issueId)

  // Process each article mod sequentially
  for (let i = 0; i < moduleIds.length; i++) {
    const moduleId = moduleIds[i]
    const moduleNum = i + 1
    const totalModules = moduleIds.length
    const stepOffset = 3 + (i * 4) // Steps 3, 7, 11, etc.

    // Generate titles for this mod
    await generateModuleTitles(issueId, moduleId, moduleNum, totalModules, stepOffset)

    // Generate bodies in 2 batches
    await generateModuleBodiesBatch1(issueId, moduleId, moduleNum, totalModules, stepOffset + 1)
    await generateModuleBodiesBatch2(issueId, moduleId, moduleNum, totalModules, stepOffset + 2)

    // Fact-check articles for this mod
    await factCheckModule(issueId, moduleId, moduleNum, totalModules, stepOffset + 3)
  }

  // FINAL STEP: Finalize
  const finalStepNum = 3 + (moduleIds.length * 4) + 1
  await finalizeIssue(issueId, moduleIds, finalStepNum)

  console.log('=== WORKFLOW COMPLETE ===')

  return { issueId, success: true }
}

// Step functions with retry logic
async function setupIssue(newsletterId: string): Promise<{ issueId: string; moduleIds: string[] }> {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 1] Setting up issue...')

      const processor = new RSSProcessor()

      // Get the newsletter
      const { data: newsletter, error: newsletterError } = await supabaseAdmin
        .from('publications')
        .select('id, name, slug')
        .eq('id', newsletterId)
        .single()

      if (newsletterError || !newsletter) {
        throw new Error(`Newsletter not found: ${newsletterId}`)
      }

      console.log(`[Workflow Step 1] Using newsletter: ${newsletter.name} (${newsletter.id})`)

      // Calculate issue date (Central Time + 12 hours)
      const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
      const centralDate = new Date(nowCentral)
      centralDate.setHours(centralDate.getHours() + 12)
      const issueDate = centralDate.toISOString().split('T')[0]

      // Create new issue via DAL (dynamic import: pino uses Node.js modules not available in workflow context)
      const { createIssue } = await import('@/lib/dal')
      const newIssue = await createIssue(newsletter.id, issueDate, 'processing')

      if (!newIssue) {
        throw new Error('Failed to create issue')
      }

      const issueId = newIssue.id
      console.log(`[Workflow Step 1] Issue created: ${issueId} for ${issueDate}`)

      // Select AI apps and prompts (non-article modules)
      try {
        const { AppModuleSelector } = await import('@/lib/ai-app-modules')
        const { PromptModuleSelector } = await import('@/lib/prompt-modules')

        console.log('[Workflow Step 1] Selecting AI apps...')

        const issueDateTime = new Date(issueDate)
        const moduleResults = await AppModuleSelector.selectAppsForIssue(issueId, newsletter.id, issueDateTime)

        const totalApps = moduleResults.reduce((sum, r) => sum + r.result.apps.length, 0)
        console.log(`[Workflow Step 1] Selected ${totalApps} AI apps via ${moduleResults.length} modules`)

        console.log('[Workflow Step 1] Selecting prompts via modules...')
        const promptResults = await PromptModuleSelector.selectPromptsForIssue(issueId, newsletter.id)
        const promptsSelected = promptResults.filter(r => r.result.prompt !== null).length
        console.log(`[Workflow Step 1] Selected ${promptsSelected} prompts via ${promptResults.length} modules`)
      } catch (error) {
        console.error('[Workflow Step 1] AI selection failed:', error)
        console.error('[Workflow Step 1] Error details:', error instanceof Error ? error.message : String(error))
        // Continue workflow even if AI selection fails (non-critical)
      }

      // Select SparkLoop recommendations for newsletter modules
      try {
        const { SparkLoopRecModuleSelector } = await import('@/lib/sparkloop-rec-modules')
        const slRecResults = await SparkLoopRecModuleSelector.selectRecsForIssue(issueId, newsletter.id)
        const modulesWithRecs = slRecResults.filter(s => s.refCodes.length > 0).length
        console.log(`[Workflow Step 1] SparkLoop rec modules: ${modulesWithRecs} mod(s) with selections`)
      } catch (slError) {
        console.log('[Workflow Step 1] SparkLoop rec mod selection failed (non-critical):', slError)
      }

      // Get active article modules
      const articleModules = await ArticleModuleSelector.getActiveModules(newsletter.id)
      const moduleIds = articleModules.map(m => m.id)

      console.log(`[Workflow Step 1] Found ${articleModules.length} active article modules`)

      // Initialize article mod selections
      await ArticleModuleSelector.initializeSelectionsForIssue(issueId, newsletter.id)

      // Initialize text box modules and generate "before_articles" timing blocks
      try {
        const { TextBoxModuleSelector, TextBoxGenerator } = await import('@/lib/text-box-modules')

        const textBoxResult = await TextBoxModuleSelector.initializeForIssue(issueId, newsletter.id)
        if (textBoxResult.modulesInitialized > 0) {
          console.log(`[Workflow Step 1] Initialized ${textBoxResult.modulesInitialized} text box modules`)

          // Generate "before_articles" timing blocks (only basic metadata available)
          const earlyGenResult = await TextBoxGenerator.generateBlocksWithTiming(issueId, 'before_articles')
          if (earlyGenResult.generated > 0) {
            console.log(`[Workflow Step 1] Generated ${earlyGenResult.generated} early text box blocks`)
          }
        }
      } catch (textBoxError) {
        console.log('[Workflow Step 1] Text box mod initialization failed (non-critical):', textBoxError)
        // Don't fail workflow if text box mod initialization fails
      }

      // Ensure feedback module exists
      try {
        const { FeedbackModuleSelector } = await import('@/lib/feedback-modules')
        await FeedbackModuleSelector.ensureFeedbackModule(newsletter.id)
        console.log('[Workflow Step 1] Feedback module ensured')
      } catch (feedbackError) {
        console.log('[Workflow Step 1] Feedback module init failed (non-critical):', feedbackError)
      }

      // Assign posts to each article mod
      let totalPostsAssigned = 0
      for (const mod of articleModules) {
        const result = await processor.assignPostsToModule(issueId, mod.id)
        totalPostsAssigned += result.assigned
        console.log(`[Workflow Step 1] Module "${mod.name}": ${result.assigned} posts assigned`)
      }

      console.log(`[Workflow Step 1] ✓ Setup complete. Total posts assigned: ${totalPostsAssigned}`)

      return { issueId, moduleIds }

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

  throw new Error('Unexpected: Retry loop exited without return')
}

// STEP 2: Deduplication (separate step with 180s timeout)
async function deduplicateIssue(issueId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 2] Running deduplication...')

      const processor = new RSSProcessor()
      const dedupeResult = await processor.handleDuplicatesForissue(issueId)

      console.log(`[Workflow Step 2] Deduplication: ${dedupeResult.groups} groups, ${dedupeResult.duplicates} duplicate posts found`)
      console.log('[Workflow Step 2] ✓ Deduplication complete')

      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 2] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 2] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

// MODULE STEPS: Generate titles for a mod
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
      const mod = await ArticleModuleSelector.getModule(moduleId)
      const moduleName = mod?.name || `Module ${moduleNum}`

      console.log(`[Workflow Step ${stepNum}] Generating titles for ${moduleName} (${moduleNum}/${totalModules})...`)

      const processor = new RSSProcessor()
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

// MODULE STEPS: Generate bodies batch 1 for a mod
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
      const mod = await ArticleModuleSelector.getModule(moduleId)
      const moduleName = mod?.name || `Module ${moduleNum}`

      console.log(`[Workflow Step ${stepNum}] Generating bodies batch 1 for ${moduleName}...`)

      const processor = new RSSProcessor()
      await processor.generateBodiesForModule(issueId, moduleId, 0, 3)

      const { data: articles } = await supabaseAdmin
        .from('module_articles')
        .select('id, content')
        .eq('issue_id', issueId)
        .eq('article_module_id', moduleId)
        .not('content', 'is', null)
        .neq('content', '')

      console.log(`[Workflow Step ${stepNum}] ✓ Total bodies generated: ${articles?.length || 0}`)
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

// MODULE STEPS: Generate bodies batch 2 for a mod
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
      const mod = await ArticleModuleSelector.getModule(moduleId)
      const moduleName = mod?.name || `Module ${moduleNum}`

      console.log(`[Workflow Step ${stepNum}] Generating bodies batch 2 for ${moduleName}...`)

      const processor = new RSSProcessor()
      await processor.generateBodiesForModule(issueId, moduleId, 3, 3)

      const { data: articles } = await supabaseAdmin
        .from('module_articles')
        .select('id, content')
        .eq('issue_id', issueId)
        .eq('article_module_id', moduleId)
        .not('content', 'is', null)
        .neq('content', '')

      console.log(`[Workflow Step ${stepNum}] ✓ Total bodies: ${articles?.length || 0}`)
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

// MODULE STEPS: Fact-check articles for a mod
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
      const mod = await ArticleModuleSelector.getModule(moduleId)
      const moduleName = mod?.name || `Module ${moduleNum}`

      console.log(`[Workflow Step ${stepNum}] Fact-checking articles for ${moduleName}...`)

      const processor = new RSSProcessor()
      await processor.factCheckArticlesForModule(issueId, moduleId)

      const { data: articles } = await supabaseAdmin
        .from('module_articles')
        .select('id, fact_check_score')
        .eq('issue_id', issueId)
        .eq('article_module_id', moduleId)
        .not('fact_check_score', 'is', null)

      const avgScore = (articles?.reduce((sum, a) => sum + (a.fact_check_score || 0), 0) || 0) / (articles?.length || 1)
      console.log(`[Workflow Step ${stepNum}] ✓ Fact-checked ${articles?.length || 0} articles (avg score: ${avgScore.toFixed(1)}/10)`)
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

// FINALIZE
async function finalizeIssue(issueId: string, moduleIds: string[], stepNum: number) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log(`[Workflow Step ${stepNum}] Finalizing issue...`)
      const processor = new RSSProcessor()

      // Auto-select top articles for each mod
      let totalSelected = 0
      for (const moduleId of moduleIds) {
        const result = await processor.selectTopArticlesForModule(issueId, moduleId)
        totalSelected += result.selected
      }
      console.log(`[Workflow Step ${stepNum}] Selected ${totalSelected} total articles across ${moduleIds.length} modules`)

      // Get active article counts per mod for logging
      const moduleCounts: string[] = []
      for (const moduleId of moduleIds) {
        const { data: activeArticles } = await supabaseAdmin
          .from('module_articles')
          .select('id')
          .eq('issue_id', issueId)
          .eq('article_module_id', moduleId)
          .eq('is_active', true)

        const mod = await ArticleModuleSelector.getModule(moduleId)
        moduleCounts.push(`${mod?.name || 'Unknown'}: ${activeArticles?.length || 0}`)
      }
      console.log(`[Workflow Step ${stepNum}] Active articles: ${moduleCounts.join(', ')}`)

      // Generate text box mod blocks with "after_articles" timing (full newsletter context)
      // This replaces the legacy welcome section - text box modules now handle welcome content
      try {
        const { TextBoxGenerator } = await import('@/lib/text-box-modules')

        const textBoxGenResult = await TextBoxGenerator.generateBlocksWithTiming(issueId, 'after_articles')
        if (textBoxGenResult.generated > 0) {
          console.log(`[Workflow Step ${stepNum}] Generated ${textBoxGenResult.generated} text box blocks (after_articles timing)`)
        }
        if (textBoxGenResult.failed > 0) {
          console.log(`[Workflow Step ${stepNum}] ${textBoxGenResult.failed} text box blocks failed to generate`)
        }
      } catch (textBoxError) {
        console.log(`[Workflow Step ${stepNum}] Text box generation failed (non-critical):`, textBoxError)
        // Don't fail workflow if text box generation fails
      }

      // Generate subject line based on top articles from first mod
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
          // Generate subject line using the existing function that works with issue ID
          const { generateSubjectLine } = await import('@/lib/subject-line-generator')
          const result = await generateSubjectLine(issueId)

          if (result.success && result.subject_line) {
            // Subject line is already saved by the generateSubjectLine function
            console.log(`[Workflow Step ${stepNum}] Subject line generated based on top article`)
          }
        }
      }

      const { data: issue } = await supabaseAdmin
        .from('publication_issues')
        .select('subject_line')
        .eq('id', issueId)
        .single()

      console.log(`[Workflow Step ${stepNum}] Subject line: "${issue?.subject_line?.substring(0, 50) || 'Not found'}..."`)

      // Select ads for all ad modules (includes "Presented By")
      try {
        const { data: issueData } = await supabaseAdmin
          .from('publication_issues')
          .select('date, publication_id')
          .eq('id', issueId)
          .single()

        if (issueData) {
          const issueDate = new Date(issueData.date)
          const moduleSelections = await ModuleAdSelector.selectAdsForIssue(
            issueId,
            issueData.publication_id,
            issueDate
          )

          const selectedCount = moduleSelections.filter(s => s.result.ad !== null).length
          const manualCount = moduleSelections.filter(s => s.result.reason === 'Manual selection required').length

          if (moduleSelections.length > 0) {
            console.log(`[Workflow Step ${stepNum}] Ad modules: ${selectedCount} selected, ${manualCount} manual pending`)
          }
        }
      } catch (moduleAdError) {
        console.log(`[Workflow Step ${stepNum}] Ad mod selection failed (non-critical):`, moduleAdError)
        // Don't fail workflow if ad mod selection fails
      }

      // Initialize poll mod selections (empty - for manual picking)
      try {
        const { data: issueData } = await supabaseAdmin
          .from('publication_issues')
          .select('publication_id')
          .eq('id', issueId)
          .single()

        if (issueData) {
          await PollModuleSelector.initializeSelectionsForIssue(issueId, issueData.publication_id)
          console.log(`[Workflow Step ${stepNum}] Poll mod selections initialized (manual selection required)`)
        }
      } catch (pollModuleError) {
        console.log(`[Workflow Step ${stepNum}] Poll mod initialization failed (non-critical):`, pollModuleError)
        // Don't fail workflow if poll mod initialization fails
      }

      // Set status to draft via DAL (dynamic import: pino uses Node.js modules)
      const { updateIssueStatus } = await import('@/lib/dal')
      await updateIssueStatus(issueId, 'draft')

      // Stage 1 unassignment - unassign posts that didn't get articles
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
