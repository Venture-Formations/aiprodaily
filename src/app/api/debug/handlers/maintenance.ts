import { NextResponse } from 'next/server'
import type { ApiHandlerContext } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { checkUserAgent } from '@/lib/bot-detection'
import { callOpenAI } from '@/lib/openai'
import { AI_PROMPTS } from '@/lib/openai/prompt-loaders'

type DebugHandler = (context: ApiHandlerContext) => Promise<NextResponse>

// ============================================================
// Helper: cleanup-duplicate-sections analysis (shared by GET and POST)
// ============================================================
async function analyzeNewsletterSections(logger: ApiHandlerContext['logger']) {
  logger.info('Analyzing newsletter sections for duplicates...')

  // Get all sections
  const { data: allSections, error: fetchError } = await supabaseAdmin
    .from('newsletter_sections')
    .select('*')
    .order('display_order', { ascending: true })

  if (fetchError) {
    throw fetchError
  }

  // Group sections by name to find duplicates
  const sectionsByName: Record<string, any[]> = {}
  for (const section of allSections || []) {
    if (!sectionsByName[section.name]) {
      sectionsByName[section.name] = []
    }
    sectionsByName[section.name].push(section)
  }

  // Find duplicates
  const duplicates = Object.entries(sectionsByName)
    .filter(([name, sections]) => sections.length > 1)
    .map(([name, sections]) => ({ name, sections }))

  // Expected sections with their proper display orders
  const expectedSections = {
    'The Local Scoop': 10,
    'Local Events': 20,
    'Local Weather': 30,
    "Yesterday's Wordle": 40,
    'Minnesota Getaways': 50,
    'Dining Deals': 60
  }

  const analysis = {
    totalSections: allSections?.length || 0,
    allSections: allSections || [],
    duplicates,
    sectionsToDelete: [] as any[],
    sectionsToKeep: [] as any[],
    expectedSections
  }

  // For each duplicate, determine which to keep and which to delete
  for (const duplicate of duplicates) {
    const { name, sections } = duplicate
    const expectedOrder = expectedSections[name as keyof typeof expectedSections]

    if (expectedOrder) {
      const correctSection = sections.find(s => s.display_order === expectedOrder)
      const sectionToKeep = correctSection || sections[0]
      const sectionsToDelete = sections.filter(s => s.id !== sectionToKeep.id)

      analysis.sectionsToKeep.push(sectionToKeep)
      analysis.sectionsToDelete.push(...sectionsToDelete)
    } else {
      analysis.sectionsToKeep.push(sections[0])
      analysis.sectionsToDelete.push(...sections.slice(1))
    }
  }

  return analysis
}

// ============================================================
// Handler Registry
// ============================================================
export const handlers: Record<string, { GET?: DebugHandler; POST?: DebugHandler; DELETE?: DebugHandler }> = {

  // ----------------------------------------------------------
  // backfill-bot-detection
  // ----------------------------------------------------------
  'backfill-bot-detection': {
    GET: async ({ request, logger }) => {
      try {
        // Verify cron secret for security
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Count clicks needing UA check
        const { count: uncheckedCount } = await supabaseAdmin
          .from('link_clicks')
          .select('*', { count: 'exact', head: true })
          .is('bot_ua_reason', null)

        // Count already flagged as bot
        const { count: botCount } = await supabaseAdmin
          .from('link_clicks')
          .select('*', { count: 'exact', head: true })
          .eq('is_bot_ua', true)

        // Count IPs with high click counts per issue
        const { data: highClickIps } = await supabaseAdmin
          .from('link_clicks')
          .select('ip_address, issue_id')
          .not('ip_address', 'is', null)
          .not('issue_id', 'is', null)

        // Group and count
        const ipIssueCounts = new Map<string, number>()
        highClickIps?.forEach(click => {
          const key = `${click.ip_address}:${click.issue_id}`
          ipIssueCounts.set(key, (ipIssueCounts.get(key) || 0) + 1)
        })

        const suspiciousIpCount = Array.from(ipIssueCounts.values()).filter(c => c >= 10).length

        // Count already excluded IPs
        const { count: excludedCount } = await supabaseAdmin
          .from('excluded_ips')
          .select('*', { count: 'exact', head: true })

        return NextResponse.json({
          status: 'ready',
          preview: {
            clicksToCheck: uncheckedCount || 0,
            alreadyFlaggedAsBot: botCount || 0,
            suspiciousIpPatterns: suspiciousIpCount,
            currentlyExcludedIps: excludedCount || 0
          },
          instructions: 'POST to this endpoint to run the backfill'
        })

      } catch (error) {
        console.error('[Backfill] Preview error:', error)
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Unknown error' },
          { status: 500 }
        )
      }
    },

    POST: async ({ request, logger }) => {
      try {
        // Verify cron secret for security
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const results = {
          uaBackfill: { processed: 0, flagged: 0, errors: 0 },
          velocityDetection: { ipsChecked: 0, ipsExcluded: 0, errors: 0 }
        }

        // ========== PART 1: Backfill UA Detection ==========
        console.log('[Backfill] Starting UA detection backfill...')

        // Process in batches to avoid memory issues
        const BATCH_SIZE = 1000
        let offset = 0
        let hasMore = true

        while (hasMore) {
          // Fetch clicks that haven't been checked yet (is_bot_ua is null or false and no reason)
          const { data: clicks, error: fetchError } = await supabaseAdmin
            .from('link_clicks')
            .select('id, user_agent')
            .is('bot_ua_reason', null)
            .order('id', { ascending: true })
            .range(offset, offset + BATCH_SIZE - 1)

          if (fetchError) {
            console.error('[Backfill] Error fetching clicks:', fetchError)
            results.uaBackfill.errors++
            break
          }

          if (!clicks || clicks.length === 0) {
            hasMore = false
            break
          }

          // Process each click
          for (const click of clicks) {
            const uaCheck = checkUserAgent(click.user_agent)
            results.uaBackfill.processed++

            if (uaCheck.isBot) {
              // Update the click with bot flag
              const { error: updateError } = await supabaseAdmin
                .from('link_clicks')
                .update({
                  is_bot_ua: true,
                  bot_ua_reason: uaCheck.reason
                })
                .eq('id', click.id)

              if (updateError) {
                console.error('[Backfill] Error updating click:', updateError)
                results.uaBackfill.errors++
              } else {
                results.uaBackfill.flagged++
              }
            } else {
              // Mark as checked (set reason to 'checked' to skip in future runs)
              // Actually, we'll just leave it as-is since is_bot_ua defaults to false
            }
          }

          offset += BATCH_SIZE
          hasMore = clicks.length === BATCH_SIZE

          // Log progress
          if (results.uaBackfill.processed % 5000 === 0) {
            console.log(`[Backfill] UA progress: ${results.uaBackfill.processed} processed, ${results.uaBackfill.flagged} flagged`)
          }
        }

        console.log(`[Backfill] UA detection complete: ${results.uaBackfill.processed} processed, ${results.uaBackfill.flagged} flagged`)

        // ========== PART 2: Historical Velocity Detection ==========
        console.log('[Backfill] Starting velocity detection...')

        // Find IPs with suspicious velocity patterns
        // We'll use a direct query approach to find IPs with high click counts per issue
        console.log('[Backfill] Running velocity detection query...')

        // Get all unique IPs with their click patterns per issue
        const { data: ipClickCounts, error: countError } = await supabaseAdmin
          .from('link_clicks')
          .select('ip_address, issue_id, publication_id')
          .not('ip_address', 'is', null)
          .not('issue_id', 'is', null)
          .not('publication_id', 'is', null)

        if (countError) {
          console.error('[Backfill] Error fetching IP data:', countError)
          results.velocityDetection.errors++
        } else if (ipClickCounts) {
          // Group by IP + issue and count
          const ipIssueGroups = new Map<string, {
            ip: string
            issueId: string
            publicationId: string
            count: number
          }>()

          for (const click of ipClickCounts) {
            const key = `${click.ip_address}:${click.issue_id}`
            const existing = ipIssueGroups.get(key)
            if (existing) {
              existing.count++
            } else {
              ipIssueGroups.set(key, {
                ip: click.ip_address,
                issueId: click.issue_id,
                publicationId: click.publication_id,
                count: 1
              })
            }
          }

          // Find IPs with 10+ clicks on a single issue (likely bots)
          const suspiciousEntries = Array.from(ipIssueGroups.values())
            .filter(entry => entry.count >= 10)

          // Get unique IPs to exclude
          const ipsToExclude = new Map<string, { ip: string, publicationId: string, count: number }>()
          for (const entry of suspiciousEntries) {
            const existing = ipsToExclude.get(`${entry.ip}:${entry.publicationId}`)
            if (!existing || entry.count > existing.count) {
              ipsToExclude.set(`${entry.ip}:${entry.publicationId}`, {
                ip: entry.ip,
                publicationId: entry.publicationId,
                count: entry.count
              })
            }
          }

          results.velocityDetection.ipsChecked = ipsToExclude.size

          // Add suspicious IPs to exclusion list
          for (const entry of Array.from(ipsToExclude.values())) {
            // Check if already excluded
            const { data: existing } = await supabaseAdmin
              .from('excluded_ips')
              .select('id')
              .eq('publication_id', entry.publicationId)
              .eq('ip_address', entry.ip)
              .maybeSingle()

            if (!existing) {
              const { error: insertError } = await supabaseAdmin
                .from('excluded_ips')
                .insert({
                  publication_id: entry.publicationId,
                  ip_address: entry.ip,
                  is_range: false,
                  cidr_prefix: null,
                  reason: `Historical velocity: ${entry.count}+ clicks on single issue`,
                  added_by: 'system:backfill',
                  exclusion_source: 'velocity'
                })

              if (insertError) {
                // Ignore duplicate key errors
                if (!insertError.message?.includes('duplicate')) {
                  console.error('[Backfill] Error excluding IP:', insertError)
                  results.velocityDetection.errors++
                }
              } else {
                results.velocityDetection.ipsExcluded++
                console.log(`[Backfill] Excluded IP ${entry.ip} (${entry.count} clicks)`)
              }
            }
          }
        }

        console.log(`[Backfill] Velocity detection complete: ${results.velocityDetection.ipsChecked} checked, ${results.velocityDetection.ipsExcluded} excluded`)

        return NextResponse.json({
          success: true,
          results,
          message: `Backfill complete. UA: ${results.uaBackfill.flagged}/${results.uaBackfill.processed} flagged. Velocity: ${results.velocityDetection.ipsExcluded} IPs excluded.`
        })

      } catch (error) {
        console.error('[Backfill] Error:', error)
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Unknown error' },
          { status: 500 }
        )
      }
    },

    DELETE: async ({ request, logger }) => {
      try {
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Count velocity exclusions before deletion
        const { count: beforeCount } = await supabaseAdmin
          .from('excluded_ips')
          .select('*', { count: 'exact', head: true })
          .eq('exclusion_source', 'velocity')

        // Delete all velocity-based exclusions
        const { error } = await supabaseAdmin
          .from('excluded_ips')
          .delete()
          .eq('exclusion_source', 'velocity')

        if (error) {
          console.error('[Backfill] Error removing velocity exclusions:', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        console.log(`[Backfill] Removed ${beforeCount || 0} velocity-based IP exclusions`)

        return NextResponse.json({
          success: true,
          removed: beforeCount || 0,
          message: `Removed ${beforeCount || 0} velocity-based IP exclusions. Real-time velocity detection (5 clicks in 10 seconds) will still work for new clicks.`
        })

      } catch (error) {
        console.error('[Backfill] Rollback error:', error)
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Unknown error' },
          { status: 500 }
        )
      }
    },
  },

  // ----------------------------------------------------------
  // cleanup-duplicate-sections
  // ----------------------------------------------------------
  'cleanup-duplicate-sections': {
    GET: async ({ logger }) => {
      const analysis = await analyzeNewsletterSections(logger)

      return NextResponse.json({
        success: true,
        message: 'Newsletter sections analysis completed',
        analysis
      })
    },

    POST: async ({ request, logger }) => {
      logger.info('Cleaning up duplicate newsletter sections...')

      const analysis = await analyzeNewsletterSections(logger)

      const { sectionsToDelete } = analysis

      if (sectionsToDelete.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No duplicate sections found to clean up',
          deletedCount: 0
        })
      }

      // Delete duplicate sections
      let deletedCount = 0
      for (const section of sectionsToDelete) {
        logger.info(`Deleting duplicate section: ${section.name} (ID: ${section.id}, Order: ${section.display_order})`)

        const { error } = await supabaseAdmin
          .from('newsletter_sections')
          .delete()
          .eq('id', section.id)

        if (error) {
          logger.error(`Error deleting section ${section.id}: ${error.message}`)
        } else {
          deletedCount++
        }
      }

      // Get final configuration
      const { data: finalSections, error: selectError } = await supabaseAdmin
        .from('newsletter_sections')
        .select('*')
        .order('display_order', { ascending: true })

      if (selectError) {
        throw selectError
      }

      return NextResponse.json({
        success: true,
        message: `Cleanup completed successfully. Deleted ${deletedCount} duplicate sections.`,
        deletedCount,
        finalSections: finalSections || []
      })
    },
  },

  // ----------------------------------------------------------
  // fix-ad-newsletter
  // ----------------------------------------------------------
  'fix-ad-newsletter': {
    POST: async ({ logger }) => {
      try {
        // Get accounting newsletter UUID
        const { data: newsletter, error: newsletterError } = await supabaseAdmin
          .from('publications')
          .select('id')
          .eq('slug', 'accounting')
          .single()

        if (newsletterError || !newsletter) {
          return NextResponse.json({
            error: 'Newsletter not found',
            details: newsletterError
          }, { status: 404 })
        }

        console.log(`[Fix Ad] Accounting newsletter ID: ${newsletter.id}`)

        // Get all ads with NULL publication_id
        const { data: adsWithoutNewsletter, error: fetchError } = await supabaseAdmin
          .from('advertisements')
          .select('id, title, publication_id')
          .is('publication_id', null)

        if (fetchError) {
          return NextResponse.json({
            error: 'Failed to fetch ads',
            details: fetchError
          }, { status: 500 })
        }

        console.log(`[Fix Ad] Found ${adsWithoutNewsletter?.length || 0} ads without publication_id`)

        if (!adsWithoutNewsletter || adsWithoutNewsletter.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No ads need updating',
            updated_count: 0
          })
        }

        // Update all ads to have the accounting publication_id
        const { data: updatedAds, error: updateError } = await supabaseAdmin
          .from('advertisements')
          .update({ publication_id: newsletter.id })
          .is('publication_id', null)
          .select('id, title')

        if (updateError) {
          return NextResponse.json({
            error: 'Failed to update ads',
            details: updateError
          }, { status: 500 })
        }

        console.log(`[Fix Ad] Updated ${updatedAds?.length || 0} ads`)

        return NextResponse.json({
          success: true,
          message: 'Advertisements updated successfully',
          publication_id: newsletter.id,
          newsletter_slug: 'accounting',
          updated_count: updatedAds?.length || 0,
          updated_ads: updatedAds
        })

      } catch (error) {
        console.error('[Fix Ad] Error:', error)
        return NextResponse.json({
          success: false,
          error: 'Update failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    },
  },

  // ----------------------------------------------------------
  // fix-all-prompts
  // ----------------------------------------------------------
  'fix-all-prompts': {
    POST: async ({ logger }) => {
      try {
        console.log('Deleting outdated AI prompts from database...')

        // Delete contentEvaluator - has wrong scale (1-10 instead of 1-20)
        const { error: evalError } = await supabaseAdmin
          .from('app_settings')
          .delete()
          .eq('key', 'ai_prompt_content_evaluator')

        if (evalError) {
          console.error('Error deleting contentEvaluator:', evalError)
        } else {
          console.log('✓ Deleted ai_prompt_content_evaluator')
        }

        // Delete newsletterWriter - already deleted but check again
        const { error: writerError } = await supabaseAdmin
          .from('app_settings')
          .delete()
          .eq('key', 'ai_prompt_newsletter_writer')

        if (writerError) {
          console.error('Error deleting newsletterWriter:', writerError)
        } else {
          console.log('✓ Deleted ai_prompt_newsletter_writer (if existed)')
        }

        return NextResponse.json({
          success: true,
          message: 'Deleted outdated prompts - system will now use correct code fallbacks with 1-20 interest scale and proper JSON formats'
        })

      } catch (error) {
        console.error('Fix prompts error:', error)
        return NextResponse.json({
          error: 'Failed to fix prompts',
          message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    },
  },

  // ----------------------------------------------------------
  // fix-tomorrow-campaign
  // ----------------------------------------------------------
  'fix-tomorrow-campaign': {
    POST: async ({ request, logger }) => {
      try {
        console.log('=== FIXING TOMORROW\'S issue ===')

        // Get tomorrow's issue
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const issueDate = tomorrow.toISOString().split('T')[0]

        console.log('Fixing issue for date:', issueDate)

        const { data: issue, error: issueError } = await supabaseAdmin
          .from('publication_issues')
          .select(`
            *,
            articles:articles(
              headline,
              content,
              is_active,
              rss_post:rss_posts(
                post_rating:post_ratings(total_score)
              )
            )
          `)
          .eq('date', issueDate)
          .single()

        if (issueError || !issue) {
          return NextResponse.json({
            success: false,
            error: 'issue not found for tomorrow',
            issueDate
          }, { status: 404 })
        }

        console.log('Found issue:', issue.id, 'Status:', issue.status)

        const fixes = []

        // Fix 1: Reset status to draft
        if (issue.status !== 'draft') {
          await supabaseAdmin
            .from('publication_issues')
            .update({
              status: 'draft',
              review_sent_at: null // Clear previous review timestamp
            })
            .eq('id', issue.id)

          fixes.push(`Status changed from '${issue.status}' to 'draft'`)
          console.log('Reset issue status to draft')
        }

        // Fix 2: Generate subject line if missing
        let generatedSubject = issue.subject_line
        if (!issue.subject_line || (typeof issue.subject_line === 'string' && issue.subject_line.trim() === '')) {
          console.log('Generating missing subject line...')

          // Get active articles sorted by AI score
          const activeArticles = issue.articles
            ?.filter((article: any) => article.is_active)
            ?.sort((a: any, b: any) => {
              const scoreA = a.rss_post?.post_rating?.[0]?.total_score || 0
              const scoreB = b.rss_post?.post_rating?.[0]?.total_score || 0
              return scoreB - scoreA
            }) || []

          if (activeArticles.length > 0) {
            // Use the highest scored article for subject line generation
            const topArticle = activeArticles[0] as any
            console.log('Using top article:', topArticle.headline)

            // Generate subject line using AI
            const timestamp = new Date().toISOString()
            const subjectPrompt = await AI_PROMPTS.subjectLineGenerator(topArticle) + `\n\nTimestamp: ${timestamp}`

            const aiResponse = await callOpenAI(subjectPrompt, 100, 0.8)

            if (aiResponse && aiResponse.trim()) {
              generatedSubject = aiResponse.trim()
              console.log('Generated subject line:', generatedSubject)

              // Update issue with generated subject line
              await supabaseAdmin
                .from('publication_issues')
                .update({
                  subject_line: generatedSubject,
                  updated_at: new Date().toISOString()
                })
                .eq('id', issue.id)

              fixes.push(`Generated subject line: "${generatedSubject}"`)
            } else {
              fixes.push('Failed to generate subject line - AI returned empty response')
            }
          } else {
            fixes.push('Cannot generate subject line - no active articles found')
          }
        }

        return NextResponse.json({
          success: true,
          message: 'issue fixes applied',
          issueId: issue.id,
          issueDate,
          originalStatus: issue.status,
          originalSubjectLine: issue.subject_line,
          newSubjectLine: generatedSubject,
          fixesApplied: fixes,
          nextStep: 'issue should now be ready for MailerLite creation',
          timestamp: new Date().toISOString()
        })

      } catch (error) {
        console.error('Fix issue error:', error)
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }, { status: 500 })
      }
    },
  },

  // ----------------------------------------------------------
  // reset-app-usage
  // ----------------------------------------------------------
  'reset-app-usage': {
    POST: async ({ request, logger }) => {
      try {
        const body = await request.json()
        const { mode = 'all', appIds = [], clearSelections = false } = body

        // Get newsletter
        const { data: newsletter } = await supabaseAdmin
          .from('publications')
          .select('id')
          .eq('slug', 'accounting')
          .single()

        if (!newsletter) {
          return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 })
        }

        let resetCount = 0

        // Reset based on mode
        switch (mode) {
          case 'all':
            // Reset all apps
            const { data: allApps } = await supabaseAdmin
              .from('ai_applications')
              .update({
                last_used_date: null,
                times_used: 0
              })
              .eq('publication_id', newsletter.id)
              .select('id')

            resetCount = allApps?.length || 0
            break

          case 'affiliates':
            // Reset only affiliate apps
            const { data: affiliateApps } = await supabaseAdmin
              .from('ai_applications')
              .update({
                last_used_date: null,
                times_used: 0
              })
              .eq('publication_id', newsletter.id)
              .eq('is_affiliate', true)
              .select('id')

            resetCount = affiliateApps?.length || 0
            break

          case 'non-affiliates':
            // Reset only non-affiliate apps
            const { data: nonAffiliateApps } = await supabaseAdmin
              .from('ai_applications')
              .update({
                last_used_date: null,
                times_used: 0
              })
              .eq('publication_id', newsletter.id)
              .eq('is_affiliate', false)
              .select('id')

            resetCount = nonAffiliateApps?.length || 0
            break

          case 'specific':
            // Reset specific apps by ID
            if (!appIds || appIds.length === 0) {
              return NextResponse.json(
                { error: 'appIds array required when mode=specific' },
                { status: 400 }
              )
            }

            const { data: specificApps } = await supabaseAdmin
              .from('ai_applications')
              .update({
                last_used_date: null,
                times_used: 0
              })
              .in('id', appIds)
              .eq('publication_id', newsletter.id)
              .select('id')

            resetCount = specificApps?.length || 0
            break

          default:
            return NextResponse.json(
              { error: 'Invalid mode. Use: all, affiliates, non-affiliates, or specific' },
              { status: 400 }
            )
        }

        // Clear issue selections if requested
        let selectionsCleared = 0
        if (clearSelections) {
          const { data: issues } = await supabaseAdmin
            .from('publication_issues')
            .select('id')
            .eq('publication_id', newsletter.id)

          if (issues && issues.length > 0) {
            const issueIds = issues.map(c => c.id)

            const { data: deleted } = await supabaseAdmin
              .from('issue_ai_app_selections')
              .delete()
              .in('issue_id', issueIds)
              .select('id')

            selectionsCleared = deleted?.length || 0
          }
        }

        return NextResponse.json({
          success: true,
          mode,
          apps_reset: resetCount,
          selections_cleared: selectionsCleared,
          message: `Reset ${resetCount} app(s)${clearSelections ? ` and cleared ${selectionsCleared} selection(s)` : ''}`
        })

      } catch (error: any) {
        console.error('Reset error:', error)
        return NextResponse.json(
          { error: 'Reset failed', details: error.message },
          { status: 500 }
        )
      }
    },
  },

  // ----------------------------------------------------------
  // reset-daily-flags
  // ----------------------------------------------------------
  'reset-daily-flags': {
    POST: async ({ request, logger }) => {
      try {
        const today = new Date().toISOString().split('T')[0]

        // Reset all daily run flags to allow re-running today
        const resetKeys = [
          'last_rss_processing_run',
          'last_issue_creation_run',
          'last_subject_generation_run',
          'last_final_send_run'
        ]

        const resetPromises = resetKeys.map(key =>
          supabaseAdmin
            .from('app_settings')
            .upsert({
              key: key,
              value: '1900-01-01' // Set to old date to allow running
            }, {
              onConflict: 'key'
            })
        )

        await Promise.all(resetPromises)

        return NextResponse.json({
          success: true,
          message: 'Daily run flags reset - processes can run again today',
          resetKeys,
          today,
          note: 'RSS processing and issue creation should now be able to run when scheduled'
        })

      } catch (error) {
        console.error('Reset daily flags error:', error)
        return NextResponse.json({
          error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    },
  },

  // ----------------------------------------------------------
  // reset-pending-submission
  // ----------------------------------------------------------
  'reset-pending-submission': {
    GET: async ({ request, logger }) => {
      const { searchParams } = new URL(request.url)
      const sessionId = searchParams.get('session_id')

      if (!sessionId) {
        return NextResponse.json({
          error: 'Please provide ?session_id=cs_test_...'
        }, { status: 400 })
      }

      try {
        // Reset the pending submission to unprocessed
        const { data, error } = await supabaseAdmin
          .from('pending_event_submissions')
          .update({
            processed: false,
            processed_at: null
          })
          .eq('stripe_session_id', sessionId)
          .select()

        if (error) {
          return NextResponse.json({
            error: 'Failed to reset submission',
            details: error.message
          }, { status: 500 })
        }

        if (!data || data.length === 0) {
          return NextResponse.json({
            error: 'No pending submission found for this session ID'
          }, { status: 404 })
        }

        return NextResponse.json({
          success: true,
          message: 'Pending submission reset to unprocessed',
          session_id: sessionId,
          next_step: `Now visit: /api/debug/process-webhook-manually?session_id=${sessionId}`
        })

      } catch (error) {
        console.error('Reset pending submission error:', error)
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    },
  },

  // ----------------------------------------------------------
  // update-image-urls
  // ----------------------------------------------------------
  'update-image-urls': {
    GET: async ({ logger }) => {
      return NextResponse.json({
        success: false,
        message: 'This endpoint is deprecated. Image URLs are now managed via Supabase Storage and publication_business_settings.',
      })
    },
  },

  // ----------------------------------------------------------
  // update-newsletter-names
  // ----------------------------------------------------------
  'update-newsletter-names': {
    GET: async ({ logger }) => {
      try {
        // Get current newsletters
        const { data: newsletters, error: fetchError } = await supabaseAdmin
          .from('publications')
          .select('id, name, slug')
          .order('created_at')

        if (fetchError) {
          return NextResponse.json({ error: fetchError.message }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          newsletters,
          message: 'Current newsletter names'
        })
      } catch (error) {
        console.error('Error:', error)
        return NextResponse.json({
          error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    },

    POST: async ({ request, logger }) => {
      try {
        const body = await request.json()
        const { slug, name } = body

        if (!slug || !name) {
          return NextResponse.json({ error: 'slug and name are required' }, { status: 400 })
        }

        // Update newsletter name by slug
        const { error: updateError } = await supabaseAdmin
          .from('publications')
          .update({ name })
          .eq('slug', slug)

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        // Get updated newsletters
        const { data: newsletters, error: fetchError } = await supabaseAdmin
          .from('publications')
          .select('id, name, slug')
          .order('created_at')

        if (fetchError) {
          return NextResponse.json({ error: fetchError.message }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          newsletters,
          message: `Newsletter "${slug}" renamed to "${name}" successfully`
        })
      } catch (error) {
        console.error('Error:', error)
        return NextResponse.json({
          error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    },
  },

  // ----------------------------------------------------------
  // update-section
  // ----------------------------------------------------------
  'update-section': {
    POST: async ({ request, logger }) => {
      try {
        const { display_order, name, is_active } = await request.json()

        if (!display_order) {
          return NextResponse.json({
            success: false,
            error: 'display_order parameter required'
          }, { status: 400 })
        }

        // Get the section
        const { data: section, error: fetchError } = await supabaseAdmin
          .from('newsletter_sections')
          .select('*')
          .eq('display_order', display_order)
          .single()

        if (fetchError || !section) {
          return NextResponse.json({
            success: false,
            error: 'Section not found',
            details: fetchError?.message
          }, { status: 404 })
        }

        // Build update object
        const updates: any = {}
        if (name !== undefined) updates.name = name
        if (is_active !== undefined) updates.is_active = is_active

        // Update it
        const { error: updateError } = await supabaseAdmin
          .from('newsletter_sections')
          .update(updates)
          .eq('id', section.id)

        if (updateError) {
          return NextResponse.json({
            success: false,
            error: updateError.message
          }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: `Updated section at display_order ${display_order}`,
          before: {
            name: section.name,
            is_active: section.is_active
          },
          after: {
            name: name !== undefined ? name : section.name,
            is_active: is_active !== undefined ? is_active : section.is_active
          }
        })

      } catch (error) {
        console.error('Error updating section:', error)
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    },
  },
}
