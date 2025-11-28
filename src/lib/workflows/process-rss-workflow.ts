import { supabaseAdmin } from '@/lib/supabase'
import { RSSProcessor } from '@/lib/rss-processor'
import { AdScheduler } from '@/lib/ad-scheduler'

/**
 * RSS Processing Workflow (REFACTORED)
 * Each step gets its own 800-second timeout
 *
 * NEW STRUCTURE:
 * Step 1:  Setup (create issue, assign posts)
 * Step 2:  Deduplication (separate step with 180s timeout)
 * Step 3:  Generate 6 primary titles (fast)
 * Step 4:  Generate 3 primary bodies (batch 1)
 * Step 5:  Generate 3 primary bodies (batch 2)
 * Step 6:  Fact-check all 6 primary articles
 * Step 7:  Generate 6 secondary titles (fast)
 * Step 8:  Generate 3 secondary bodies (batch 1)
 * Step 9:  Generate 3 secondary bodies (batch 2)
 * Step 10: Fact-check all 6 secondary articles
 * Step 11: Finalize
 */
export async function processRSSWorkflow(input: {
  trigger: 'cron' | 'manual'
  publication_id: string
}) {
  "use workflow"

  let issueId: string

  console.log(`[Workflow] Starting for newsletter: ${input.publication_id}`)

  // STEP 1: Setup - Create issue, assign posts
  issueId = await setupissue(input.publication_id)

  // STEP 2: Deduplication (separate step with longer timeout)
  await deduplicateissue(issueId)

  // PRIMARY SECTION
  // STEP 3: Generate all 6 primary titles (fast, batched)
  await generatePrimaryTitles(issueId)

  // STEP 4-5: Generate primary bodies in 2 batches (3 articles each)
  await generatePrimaryBodiesBatch1(issueId)
  await generatePrimaryBodiesBatch2(issueId)

  // STEP 6: Fact-check all primary articles
  await factCheckPrimary(issueId)

  // SECONDARY SECTION
  // STEP 7: Generate all 6 secondary titles (fast, batched)
  await generateSecondaryTitles(issueId)

  // STEP 8-9: Generate secondary bodies in 2 batches (3 articles each)
  await generateSecondaryBodiesBatch1(issueId)
  await generateSecondaryBodiesBatch2(issueId)

  // STEP 10: Fact-check all secondary articles
  await factCheckSecondary(issueId)

  // STEP 11: Finalize
  await finalizeIssue(issueId)

  console.log('=== WORKFLOW COMPLETE ===')

  return { issueId, success: true }
}

// Step functions with retry logic
async function setupissue(newsletterId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 1/11] Setting up issue...')

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

      console.log(`[Workflow Step 1/11] Using newsletter: ${newsletter.name} (${newsletter.id})`)

      // Calculate issue date (Central Time + 12 hours)
      const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
      const centralDate = new Date(nowCentral)
      centralDate.setHours(centralDate.getHours() + 12)
      const issueDate = centralDate.toISOString().split('T')[0]

      // Create new issue with publication_id
      const { data: newissue, error: createError } = await supabaseAdmin
        .from('publication_issues')
        .insert([{
          date: issueDate,
          status: 'processing',
          publication_id: newsletter.id
        }])
        .select('id')
        .single()

      if (createError || !newissue) {
        throw new Error('Failed to create issue')
      }

      const id = newissue.id
      console.log(`[Workflow Step 1/11] issue created: ${id} for ${issueDate}`)

      // Select AI apps and prompts
      try {
        const { AppSelector } = await import('@/lib/app-selector')
        const { PromptSelector } = await import('@/lib/prompt-selector')

        console.log('[Workflow Step 1/11] Selecting AI apps...')
        const selectedApps = await AppSelector.selectAppsForissue(id, newsletter.id)
        console.log(`[Workflow Step 1/11] Selected ${selectedApps.length} AI apps`)

        console.log('[Workflow Step 1/11] Selecting prompt...')
        await PromptSelector.selectPromptForissue(id)
        console.log('[Workflow Step 1/11] Prompt selected')
      } catch (error) {
        console.error('[Workflow Step 1/11] AI selection failed:', error)
        console.error('[Workflow Step 1/11] Error details:', error instanceof Error ? error.message : String(error))
        console.error('[Workflow Step 1/11] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
        // Continue workflow even if AI selection fails (non-critical)
      }

      // Assign top 12 posts per section
      const { data: primaryFeeds } = await supabaseAdmin
        .from('rss_feeds')
        .select('id')
        .eq('active', true)
        .eq('use_for_primary_section', true)

      const { data: secondaryFeeds } = await supabaseAdmin
        .from('rss_feeds')
        .select('id')
        .eq('active', true)
        .eq('use_for_secondary_section', true)

      const primaryFeedIds = primaryFeeds?.map(f => f.id) || []
      const secondaryFeedIds = secondaryFeeds?.map(f => f.id) || []

      // Get lookback window
      const { data: lookbackSetting } = await supabaseAdmin
        .from('publication_settings')
        .select('value')
        .eq('publication_id', newsletterId)
        .eq('key', 'primary_article_lookback_hours')
        .single()

      const lookbackHours = lookbackSetting ? parseInt(lookbackSetting.value) : 72
      const lookbackDate = new Date()
      lookbackDate.setHours(lookbackDate.getHours() - lookbackHours)
      const lookbackTimestamp = lookbackDate.toISOString()

      // Get and assign top primary posts
      const { data: allPrimaryPosts } = await supabaseAdmin
        .from('rss_posts')
        .select('id, post_ratings(total_score)')
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

      // Get and assign top secondary posts
      const { data: allSecondaryPosts } = await supabaseAdmin
        .from('rss_posts')
        .select('id, post_ratings(total_score)')
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

      // Assign to issue
      if (topPrimary.length > 0) {
        await supabaseAdmin
          .from('rss_posts')
          .update({ issue_id: id })
          .in('id', topPrimary.map(p => p.id))
      }

      if (topSecondary.length > 0) {
        await supabaseAdmin
          .from('rss_posts')
          .update({ issue_id: id })
          .in('id', topSecondary.map(p => p.id))
      }

      console.log(`[Workflow Step 1/11] Assigned ${topPrimary.length} primary, ${topSecondary.length} secondary posts`)
      console.log('[Workflow Step 1/11] ✓ Setup complete')

      return id

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 1/11] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 1/11] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  throw new Error('Unexpected: Retry loop exited without return')
}

// STEP 2: Deduplication (separate step with 180s timeout)
async function deduplicateissue(issueId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 2/11] Running deduplication...')

      const processor = new RSSProcessor()
      const dedupeResult = await processor.handleDuplicatesForissue(issueId)

      console.log(`[Workflow Step 2/11] Deduplication: ${dedupeResult.groups} groups, ${dedupeResult.duplicates} duplicate posts found`)
      console.log('[Workflow Step 2/11] ✓ Deduplication complete')

      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 2/11] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 2/11] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

// PRIMARY SECTION
async function generatePrimaryTitles(issueId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 3/11] Generating 6 primary titles...')
      const processor = new RSSProcessor()
      await processor.generateTitlesOnly(issueId, 'primary', 6)

      const { data: articles } = await supabaseAdmin
        .from('articles')
        .select('id, headline')
        .eq('issue_id', issueId)
        .not('headline', 'is', null)

      console.log(`[Workflow Step 3/11] ✓ Generated ${articles?.length || 0} primary titles`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 3/11] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 3/11] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

async function generatePrimaryBodiesBatch1(issueId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 4/11] Generating 3 primary bodies (batch 1)...')
      const processor = new RSSProcessor()
      await processor.generateBodiesOnly(issueId, 'primary', 0, 3)

      const { data: articles } = await supabaseAdmin
        .from('articles')
        .select('id, content')
        .eq('issue_id', issueId)
        .not('content', 'is', null)

      console.log(`[Workflow Step 4/11] ✓ Total bodies generated: ${articles?.length || 0}`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 4/11] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 4/11] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

async function generatePrimaryBodiesBatch2(issueId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 5/11] Generating 3 more primary bodies (batch 2)...')
      const processor = new RSSProcessor()
      await processor.generateBodiesOnly(issueId, 'primary', 3, 3)

      const { data: articles } = await supabaseAdmin
        .from('articles')
        .select('id, content')
        .eq('issue_id', issueId)
        .not('content', 'is', null)

      console.log(`[Workflow Step 5/11] ✓ Total primary bodies: ${articles?.length || 0}`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 5/11] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 5/11] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

async function factCheckPrimary(issueId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 6/11] Fact-checking all primary articles...')
      const processor = new RSSProcessor()
      await processor.factCheckArticles(issueId, 'primary')

      const { data: articles } = await supabaseAdmin
        .from('articles')
        .select('id, fact_check_score')
        .eq('issue_id', issueId)
        .not('fact_check_score', 'is', null)

      const avgScore = (articles?.reduce((sum, a) => sum + (a.fact_check_score || 0), 0) || 0) / (articles?.length || 1)
      console.log(`[Workflow Step 6/11] ✓ Fact-checked ${articles?.length || 0} articles (avg score: ${avgScore.toFixed(1)}/10)`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 6/11] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 6/11] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

// SECONDARY SECTION
async function generateSecondaryTitles(issueId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 7/11] Generating 6 secondary titles...')
      const processor = new RSSProcessor()
      await processor.generateTitlesOnly(issueId, 'secondary', 6)

      const { data: articles } = await supabaseAdmin
        .from('secondary_articles')
        .select('id, headline')
        .eq('issue_id', issueId)
        .not('headline', 'is', null)

      console.log(`[Workflow Step 7/11] ✓ Generated ${articles?.length || 0} secondary titles`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 7/11] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 7/11] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

async function generateSecondaryBodiesBatch1(issueId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 8/11] Generating 3 secondary bodies (batch 1)...')
      const processor = new RSSProcessor()
      await processor.generateBodiesOnly(issueId, 'secondary', 0, 3)

      const { data: articles } = await supabaseAdmin
        .from('secondary_articles')
        .select('id, content')
        .eq('issue_id', issueId)
        .not('content', 'is', null)

      console.log(`[Workflow Step 8/11] ✓ Total bodies generated: ${articles?.length || 0}`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 8/11] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 8/11] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

async function generateSecondaryBodiesBatch2(issueId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 9/11] Generating 3 more secondary bodies (batch 2)...')
      const processor = new RSSProcessor()
      await processor.generateBodiesOnly(issueId, 'secondary', 3, 3)

      const { data: articles } = await supabaseAdmin
        .from('secondary_articles')
        .select('id, content')
        .eq('issue_id', issueId)
        .not('content', 'is', null)

      console.log(`[Workflow Step 9/11] ✓ Total secondary bodies: ${articles?.length || 0}`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 9/11] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 9/11] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

async function factCheckSecondary(issueId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 10/11] Fact-checking all secondary articles...')
      const processor = new RSSProcessor()
      await processor.factCheckArticles(issueId, 'secondary')

      const { data: articles } = await supabaseAdmin
        .from('secondary_articles')
        .select('id, fact_check_score')
        .eq('issue_id', issueId)
        .not('fact_check_score', 'is', null)

      const avgScore = (articles?.reduce((sum, a) => sum + (a.fact_check_score || 0), 0) || 0) / (articles?.length || 1)
      console.log(`[Workflow Step 10/11] ✓ Fact-checked ${articles?.length || 0} articles (avg score: ${avgScore.toFixed(1)}/10)`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 10/11] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 10/11] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

// FINALIZE
async function finalizeIssue(issueId: string) {
  "use step"

  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      console.log('[Workflow Step 11/11] Finalizing issue...')
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

      // Select and assign advertisement for this issue
      try {
        const { data: issueData } = await supabaseAdmin
          .from('publication_issues')
          .select('date, publication_id')
          .eq('id', issueId)
          .single()

        if (issueData) {
          const selectedAd = await AdScheduler.selectAdForissue({
            issueId: issueId,
            issueDate: issueData.date,
            newsletterId: issueData.publication_id
          })

          if (selectedAd) {
            // Check if ad already assigned to prevent duplicates
            const { data: existingAssignment } = await supabaseAdmin
              .from('issue_advertisements')
              .select('id')
              .eq('issue_id', issueId)
              .maybeSingle()

            if (!existingAssignment) {
              // Store the selected ad (usage will be recorded at send-final via AdScheduler.recordAdUsage)
              await supabaseAdmin
                .from('issue_advertisements')
                .insert({
                  issue_id: issueId,
                  advertisement_id: selectedAd.id,
                  issue_date: issueData.date
                  // Note: used_at is NOT set here - it will be set at send-final time
                })

              console.log(`[Workflow Step 11/11] Selected ad: ${selectedAd.title}`)
            } else {
              console.log('[Workflow Step 11/11] Ad already assigned')
            }
          } else {
            console.log('[Workflow Step 11/11] No active ads available')
          }
        }
      } catch (adError) {
        console.log('[Workflow Step 11/11] Ad selection failed (non-critical):', adError)
        // Don't fail the entire step if ad selection fails
      }

      // Set status to draft
      await supabaseAdmin
        .from('publication_issues')
        .update({ status: 'draft' })
        .eq('id', issueId)

      // Stage 1 unassignment
      const unassignResult = await processor.unassignUnusedPosts(issueId)
      console.log(`[Workflow Step 11/11] ✓ Finalized. Unassigned ${unassignResult.unassigned} unused posts`)
      return

    } catch (error) {
      retryCount++
      if (retryCount > maxRetries) {
        console.error(`[Workflow Step 11/11] Failed after ${maxRetries} retries`)
        throw error
      }
      console.log(`[Workflow Step 11/11] Error occurred, retrying (${retryCount}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}
