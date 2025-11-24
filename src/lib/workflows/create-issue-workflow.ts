import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Create issue Workflow - Article Generation Steps
 * Runs after issue setup (AI selection, post assignment)
 *
 * Steps:
 * 1. Deduplication (with extended timeout)
 * 2. Generate 6 primary titles
 * 3. Generate 3 primary bodies (batch 1)
 * 4. Generate 3 primary bodies (batch 2)
 * 5. Fact-check primary articles
 * 6. Generate 6 secondary titles
 * 7. Generate 3 secondary bodies (batch 1)
 * 8. Generate 3 secondary bodies (batch 2)
 * 9. Fact-check secondary articles
 * 10. Finalize (select top 3, generate welcome, set draft)
 *
 * Note: Each step includes OIDC error handling and idempotency checks
 * to gracefully handle Vercel workflow token refresh failures
 */

/**
 * Helper to detect if an error is an OIDC token error
 */
function isOidcError(error: any): boolean {
  const errorMsg = error?.message || String(error)
  return errorMsg.includes('VercelOidcTokenError') ||
         errorMsg.includes('Failed to refresh OIDC token') ||
         errorMsg.includes('Unable to find root directory')
}
export async function createIssueWorkflow(input: {
  issue_id: string
  publication_id: string
}) {
  "use workflow"

  const { issue_id } = input

  console.log(`[Create issue Workflow] Starting for issue: ${issue_id}`)

  // STEP 1: Deduplication
  await deduplicateissue(issue_id)

  // PRIMARY SECTION
  await generatePrimaryTitles(issue_id)
  await generatePrimaryBodiesBatch1(issue_id)
  await generatePrimaryBodiesBatch2(issue_id)
  await factCheckPrimary(issue_id)

  // SECONDARY SECTION
  await generateSecondaryTitles(issue_id)
  await generateSecondaryBodiesBatch1(issue_id)
  await generateSecondaryBodiesBatch2(issue_id)
  await factCheckSecondary(issue_id)

  // FINALIZE
  await finalizeIssue(issue_id)

  console.log('[Create issue Workflow] ✓ Complete')

  return { issue_id, success: true }
}

// Step 1: Deduplication (with extended timeout for AI semantic analysis)
async function deduplicateissue(issueId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 1/10] Running deduplication...')

      const processor = new RSSProcessor()
      const dedupeResult = await processor.handleDuplicatesForissue(issueId)

      console.log(`[Workflow Step 1/10] Deduplication: ${dedupeResult.groups} groups, ${dedupeResult.duplicates} duplicate posts found`)
      console.log('[Workflow Step 1/10] ✓ Deduplication complete')

      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 1/10] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 1/10] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

// Step 1: Generate Primary Titles
async function generatePrimaryTitles(issueId: string) {
  "use step"

  let workCompleted = false

  try {
    // Idempotency check: skip if already done
    const { data: existing } = await supabaseAdmin
      .from('articles')
      .select('id')
      .eq('issue_id', issueId)
      .not('headline', 'is', null)

    if (existing && existing.length >= 6) {
      console.log(`[Workflow Step 2/10] ✓ Already have ${existing.length} primary titles (skip)`)
      return
    }

    console.log('[Workflow Step 2/10] Generating 6 primary titles...')
    const processor = new RSSProcessor()
    await processor.generateTitlesOnly(issueId, 'primary', 6)

    // Mark work as complete before querying results
    workCompleted = true

    const { data: articles } = await supabaseAdmin
      .from('articles')
      .select('id, headline')
      .eq('issue_id', issueId)
      .not('headline', 'is', null)

    console.log(`[Workflow Step 2/10] ✓ Generated ${articles?.length || 0} primary titles`)
  } catch (error: any) {
    // If OIDC error but work completed, log and continue
    if (workCompleted && isOidcError(error)) {
      console.log('[Workflow Step 2/10] ⚠️ OIDC token error after completion - continuing')
      return
    }
    // Otherwise, this is a real error - rethrow
    throw error
  }
}

// Step 2: Generate Primary Bodies Batch 1
async function generatePrimaryBodiesBatch1(issueId: string) {
  "use step"

  let workCompleted = false

  try {
    // Idempotency check: count existing bodies for first 3 articles
    const { data: existing, count } = await supabaseAdmin
      .from('articles')
      .select('id, content', { count: 'exact' })
      .eq('issue_id', issueId)
      .not('content', 'is', null)
      .range(0, 2) // First 3 articles (0-indexed)

    if (count && count >= 3) {
      console.log('[Workflow Step 3/10] ✓ First 3 primary bodies already generated (skip)')
      return
    }

    console.log('[Workflow Step 3/10] Generating 3 primary bodies (batch 1)...')
    const processor = new RSSProcessor()
    await processor.generateBodiesOnly(issueId, 'primary', 0, 3)

    // Mark work as complete
    workCompleted = true

    const { data: articles } = await supabaseAdmin
      .from('articles')
      .select('id, content')
      .eq('issue_id', issueId)
      .not('content', 'is', null)

    console.log(`[Workflow Step 3/10] ✓ Total bodies generated: ${articles?.length || 0}`)
  } catch (error: any) {
    // If OIDC error but work completed, log and continue
    if (workCompleted && isOidcError(error)) {
      console.log('[Workflow Step 3/10] ⚠️ OIDC token error after completion - continuing')
      return
    }
    throw error
  }
}

// Step 3: Generate Primary Bodies Batch 2
async function generatePrimaryBodiesBatch2(issueId: string) {
  "use step"

  let workCompleted = false

  try {
    // Idempotency check: count total bodies
    const { count } = await supabaseAdmin
      .from('articles')
      .select('id', { count: 'exact' })
      .eq('issue_id', issueId)
      .not('content', 'is', null)

    if (count && count >= 6) {
      console.log('[Workflow Step 4/10] ✓ All 6 primary bodies already generated (skip)')
      return
    }

    console.log('[Workflow Step 4/10] Generating 3 more primary bodies (batch 2)...')
    const processor = new RSSProcessor()
    await processor.generateBodiesOnly(issueId, 'primary', 3, 3)

    // Mark work as complete
    workCompleted = true

    const { data: articles } = await supabaseAdmin
      .from('articles')
      .select('id, content')
      .eq('issue_id', issueId)
      .not('content', 'is', null)

    console.log(`[Workflow Step 4/10] ✓ Total primary bodies: ${articles?.length || 0}`)
  } catch (error: any) {
    if (workCompleted && isOidcError(error)) {
      console.log('[Workflow Step 4/10] ⚠️ OIDC token error after completion - continuing')
      return
    }
    throw error
  }
}

// Step 4: Fact-check Primary Articles
async function factCheckPrimary(issueId: string) {
  "use step"

  console.log('[Workflow Step 5/10] Fact-checking all primary articles...')
  const processor = new RSSProcessor()
  await processor.factCheckArticles(issueId, 'primary')

  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('id, fact_check_score')
    .eq('issue_id', issueId)
    .not('fact_check_score', 'is', null)

  const avgScore = (articles?.reduce((sum, a) => sum + (a.fact_check_score || 0), 0) || 0) / (articles?.length || 1)
  console.log(`[Workflow Step 5/10] ✓ Fact-checked ${articles?.length || 0} articles (avg score: ${avgScore.toFixed(1)}/10)`)
}

// Step 5: Generate Secondary Titles
async function generateSecondaryTitles(issueId: string) {
  "use step"

  let workCompleted = false

  try {
    // Idempotency check: skip if already done
    const { data: existing } = await supabaseAdmin
      .from('secondary_articles')
      .select('id')
      .eq('issue_id', issueId)
      .not('headline', 'is', null)

    if (existing && existing.length >= 6) {
      console.log(`[Workflow Step 6/10] ✓ Already have ${existing.length} secondary titles (skip)`)
      return
    }

    console.log('[Workflow Step 6/10] Generating 6 secondary titles...')
    const processor = new RSSProcessor()
    await processor.generateTitlesOnly(issueId, 'secondary', 6)

    // Mark work as complete
    workCompleted = true

    const { data: articles } = await supabaseAdmin
      .from('secondary_articles')
      .select('id, headline')
      .eq('issue_id', issueId)
      .not('headline', 'is', null)

    console.log(`[Workflow Step 6/10] ✓ Generated ${articles?.length || 0} secondary titles`)
  } catch (error: any) {
    if (workCompleted && isOidcError(error)) {
      console.log('[Workflow Step 6/10] ⚠️ OIDC token error after completion - continuing')
      return
    }
    throw error
  }
}

// Step 6: Generate Secondary Bodies Batch 1
async function generateSecondaryBodiesBatch1(issueId: string) {
  "use step"

  let workCompleted = false

  try {
    // Idempotency check: count existing secondary bodies for first 3 articles
    const { count } = await supabaseAdmin
      .from('secondary_articles')
      .select('id', { count: 'exact' })
      .eq('issue_id', issueId)
      .not('content', 'is', null)
      .range(0, 2) // First 3 articles

    if (count && count >= 3) {
      console.log('[Workflow Step 7/10] ✓ First 3 secondary bodies already generated (skip)')
      return
    }

    console.log('[Workflow Step 7/10] Generating 3 secondary bodies (batch 1)...')
    const processor = new RSSProcessor()
    await processor.generateBodiesOnly(issueId, 'secondary', 0, 3)

    // Mark work as complete
    workCompleted = true

    const { data: articles } = await supabaseAdmin
      .from('secondary_articles')
      .select('id, content')
      .eq('issue_id', issueId)
      .not('content', 'is', null)

    console.log(`[Workflow Step 7/10] ✓ Total bodies generated: ${articles?.length || 0}`)
  } catch (error: any) {
    if (workCompleted && isOidcError(error)) {
      console.log('[Workflow Step 7/10] ⚠️ OIDC token error after completion - continuing')
      return
    }
    throw error
  }
}

// Step 7: Generate Secondary Bodies Batch 2
async function generateSecondaryBodiesBatch2(issueId: string) {
  "use step"

  let workCompleted = false

  try {
    // Idempotency check: count total secondary bodies
    const { count } = await supabaseAdmin
      .from('secondary_articles')
      .select('id', { count: 'exact' })
      .eq('issue_id', issueId)
      .not('content', 'is', null)

    if (count && count >= 6) {
      console.log('[Workflow Step 8/10] ✓ All 6 secondary bodies already generated (skip)')
      return
    }

    console.log('[Workflow Step 8/10] Generating 3 more secondary bodies (batch 2)...')
    const processor = new RSSProcessor()
    await processor.generateBodiesOnly(issueId, 'secondary', 3, 3)

    // Mark work as complete
    workCompleted = true

    const { data: articles } = await supabaseAdmin
      .from('secondary_articles')
      .select('id, content')
      .eq('issue_id', issueId)
      .not('content', 'is', null)

    console.log(`[Workflow Step 8/10] ✓ Total secondary bodies: ${articles?.length || 0}`)
  } catch (error: any) {
    if (workCompleted && isOidcError(error)) {
      console.log('[Workflow Step 8/10] ⚠️ OIDC token error after completion - continuing')
      return
    }
    throw error
  }
}

// Step 8: Fact-check Secondary Articles
async function factCheckSecondary(issueId: string) {
  "use step"

  console.log('[Workflow Step 9/10] Fact-checking all secondary articles...')
  const processor = new RSSProcessor()
  await processor.factCheckArticles(issueId, 'secondary')

  const { data: articles } = await supabaseAdmin
    .from('secondary_articles')
    .select('id, fact_check_score')
    .eq('issue_id', issueId)
    .not('fact_check_score', 'is', null)

  const avgScore = (articles?.reduce((sum, a) => sum + (a.fact_check_score || 0), 0) || 0) / (articles?.length || 1)
  console.log(`[Workflow Step 9/10] ✓ Fact-checked ${articles?.length || 0} articles (avg score: ${avgScore.toFixed(1)}/10)`)
}

// Step 9: Finalize Issue
async function finalizeIssue(issueId: string) {
  "use step"

  console.log('[Workflow Step 10/10] Finalizing issue...')
  const processor = new RSSProcessor()

  // Auto-select top 3 per section
  await processor.selectTopArticlesForissue(issueId)

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

  console.log(`Selected ${activeArticles?.length || 0} primary, ${activeSecondary?.length || 0} secondary`)

  // Generate welcome section
  await processor.generateWelcomeSection(issueId)

  // Subject line (generated in selectTopArticlesForissue)
  const { data: issue } = await supabaseAdmin
    .from('publication_issues')
    .select('subject_line')
    .eq('id', issueId)
    .single()

  console.log(`Subject line: "${issue?.subject_line?.substring(0, 50) || 'Not found'}..."`)

  // Set status to draft
  await supabaseAdmin
    .from('publication_issues')
    .update({ status: 'draft' })
    .eq('id', issueId)

  // Stage 1 unassignment
  const unassignResult = await processor.unassignUnusedPosts(issueId)
  console.log(`[Workflow Step 10/10] ✓ Finalized. Unassigned ${unassignResult.unassigned} unused posts`)
}
