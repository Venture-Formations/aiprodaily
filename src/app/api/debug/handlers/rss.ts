import { NextResponse } from 'next/server'
import type { ApiHandlerContext } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { ArticleExtractor } from '@/lib/article-extractor'
import { callAIWithPrompt } from '@/lib/openai'
import { generateAndUploadTradeImage } from '@/lib/trade-image-generator'

type DebugHandler = (context: ApiHandlerContext) => Promise<NextResponse>

interface CriteriaScore {
  score: number
  reason: string
  weight: number
}

export const handlers: Record<string, { GET?: DebugHandler; POST?: DebugHandler }> = {
  'backfill-full-text': {
    GET: async ({ request, logger }) => {
      const { searchParams } = new URL(request.url)
      const issueId = searchParams.get('issue_id')
      const dryRun = searchParams.get('dry_run') !== 'false' // Default true
      const limit = parseInt(searchParams.get('limit') || '20') // Max posts to process

      if (!issueId) {
        return NextResponse.json({ error: 'issueId required' }, { status: 400 })
      }

      try {
        console.log(`[BACKFILL] ${dryRun ? 'DRY RUN:' : ''} Starting backfill for issue ${issueId}`)

        // Find posts with no full_article_text
        const { data: posts, error } = await supabaseAdmin
          .from('rss_posts')
          .select('id, title, source_url, full_article_text')
          .eq('issue_id', issueId)
          .or('full_article_text.is.null,full_article_text.eq.')
          .limit(limit)

        if (error) {
          console.error('[BACKFILL] Query error:', error)
          throw error
        }

        if (!posts || posts.length === 0) {
          return NextResponse.json({
            status: 'success',
            message: 'No posts need backfilling',
            issue_id: issueId,
            posts_found: 0
          })
        }

        console.log(`[BACKFILL] Found ${posts.length} posts without full_article_text`)

        // Extract using ArticleExtractor (with Jina AI fallback)
        const extractor = new ArticleExtractor()
        const results: Array<{
          id: string
          title: string
          source_url: string
          success: boolean
          method: 'readability' | 'jina' | 'failed'
          full_text_length?: number
          error?: string
        }> = []

        let successCount = 0
        let failedCount = 0

        // Process sequentially to avoid overwhelming Jina API
        for (const post of posts) {
          console.log(`[BACKFILL] Processing: ${post.title.substring(0, 60)}...`)

          try {
            const result = await extractor.extractArticle(post.source_url)

            if (result.success && result.fullText) {
              successCount++

              // Update database (if not dry run)
              if (!dryRun) {
                const { error: updateError } = await supabaseAdmin
                  .from('rss_posts')
                  .update({ full_article_text: result.fullText })
                  .eq('id', post.id)

                if (updateError) {
                  console.error(`[BACKFILL] Failed to update ${post.id}:`, updateError)
                  results.push({
                    id: post.id,
                    title: post.title,
                    source_url: post.source_url,
                    success: false,
                    method: 'failed',
                    error: `Database update failed: ${updateError.message}`
                  })
                  continue
                }

                console.log(`[BACKFILL] Updated ${post.id} with ${result.fullText.length} chars`)
              }

              // Determine which method succeeded by checking logs
              // (Jina logs "[Extract] Jina AI succeeded", Readability logs "[Extract] Readability succeeded")
              const method = result.fullText.includes('Jina') ? 'jina' : 'readability'

              results.push({
                id: post.id,
                title: post.title,
                source_url: post.source_url,
                success: true,
                method,
                full_text_length: result.fullText.length
              })

            } else {
              failedCount++
              results.push({
                id: post.id,
                title: post.title,
                source_url: post.source_url,
                success: false,
                method: 'failed',
                error: result.error || 'Unknown error'
              })
              console.log(`[BACKFILL] Failed: ${result.error}`)
            }

            // Small delay between requests to be polite
            await new Promise(resolve => setTimeout(resolve, 1000))

          } catch (error) {
            failedCount++
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            console.error(`[BACKFILL] Exception for ${post.id}:`, errorMsg)
            results.push({
              id: post.id,
              title: post.title,
              source_url: post.source_url,
              success: false,
              method: 'failed',
              error: errorMsg
            })
          }
        }

        const successRate = Math.round((successCount / posts.length) * 100)

        console.log(`[BACKFILL] Complete: ${successCount} succeeded, ${failedCount} failed (${successRate}% success rate)`)

        return NextResponse.json({
          status: 'success',
          dry_run: dryRun,
          message: dryRun
            ? `DRY RUN: Would backfill ${successCount} posts`
            : `Backfilled ${successCount} posts`,
          issue_id: issueId,
          total_posts: posts.length,
          succeeded: successCount,
          failed: failedCount,
          success_rate: `${successRate}%`,
          results: results.map(r => ({
            title: r.title.substring(0, 80),
            success: r.success,
            method: r.method,
            full_text_length: r.full_text_length,
            error: r.error
          }))
        })

      } catch (error) {
        console.error('[BACKFILL] Error:', error)
        return NextResponse.json({
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  'rescore-posts': {
    GET: async ({ request, logger }) => {
      const { searchParams } = new URL(request.url)
      const since = searchParams.get('since')
      const publicationId = searchParams.get('publication_id')
      const section = (searchParams.get('section') || 'primary') as 'primary' | 'secondary'
      const dryRun = searchParams.get('dry_run') !== 'false' // Default true
      const limit = parseInt(searchParams.get('limit') || '50')
      const offset = parseInt(searchParams.get('offset') || '0')

      if (!since) {
        // Calculate default: 9pm CST yesterday = 3am UTC today
        const now = new Date()
        const yesterday9pmCST = new Date(now)
        yesterday9pmCST.setUTCHours(3, 0, 0, 0) // 3am UTC = 9pm CST
        if (now.getUTCHours() < 3) {
          // If it's before 3am UTC, go back one more day
          yesterday9pmCST.setUTCDate(yesterday9pmCST.getUTCDate() - 1)
        }

        return NextResponse.json({
          error: 'since parameter required',
          hint: 'Use ISO timestamp format, e.g.: since=' + yesterday9pmCST.toISOString(),
          example_for_9pm_cst_yesterday: yesterday9pmCST.toISOString()
        }, { status: 400 })
      }

      if (!publicationId) {
        return NextResponse.json({
          error: 'publication_id parameter required'
        }, { status: 400 })
      }

      try {
        console.log(`[RESCORE] ${dryRun ? 'DRY RUN:' : ''} Rescoring ${section} posts since ${since} for publication ${publicationId}`)

        // Get feeds for this section
        const { data: feeds, error: feedsError } = await supabaseAdmin
          .from('rss_feeds')
          .select('id')
          .eq('active', true)
          .eq('publication_id', publicationId)
          .eq(section === 'primary' ? 'use_for_primary_section' : 'use_for_secondary_section', true)

        if (feedsError) {
          throw new Error(`Failed to fetch feeds: ${feedsError.message}`)
        }

        if (!feeds || feeds.length === 0) {
          return NextResponse.json({
            status: 'success',
            message: `No active ${section} feeds found`,
            posts_found: 0
          })
        }

        const feedIds = feeds.map(f => f.id)
        console.log(`[RESCORE] Found ${feedIds.length} ${section} feeds`)

        // Find posts to rescore
        const { data: posts, error: postsError } = await supabaseAdmin
          .from('rss_posts')
          .select('id, title, description, content, full_article_text, feed_id')
          .in('feed_id', feedIds)
          .gte('processed_at', since)
          .order('processed_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (postsError) {
          throw new Error(`Failed to fetch posts: ${postsError.message}`)
        }

        if (!posts || posts.length === 0) {
          return NextResponse.json({
            status: 'success',
            message: 'No posts found matching criteria',
            since,
            publication_id: publicationId,
            section,
            posts_found: 0
          })
        }

        console.log(`[RESCORE] Found ${posts.length} posts to rescore`)

        // Fetch criteria configuration
        const enabledCountKey = section === 'primary' ? 'primary_criteria_enabled_count' : 'secondary_criteria_enabled_count'
        const criteriaPrefix = section === 'primary' ? 'criteria_' : 'secondary_criteria_'

        const { data: criteriaConfig, error: configError } = await supabaseAdmin
          .from('publication_settings')
          .select('key, value')
          .eq('publication_id', publicationId)
          .or(`key.eq.${enabledCountKey},key.eq.criteria_enabled_count,key.like.${criteriaPrefix}%_name,key.like.${criteriaPrefix}%_weight,key.like.criteria_%_name,key.like.criteria_%_weight`)

        if (configError) {
          throw new Error(`Failed to fetch criteria configuration: ${configError.message}`)
        }

        // Parse criteria configuration
        const enabledCountSetting = criteriaConfig?.find(s => s.key === enabledCountKey) ||
                                     criteriaConfig?.find(s => s.key === 'criteria_enabled_count')
        const enabledCount = enabledCountSetting?.value ? parseInt(enabledCountSetting.value) : 3

        const criteria: Array<{ number: number; name: string; weight: number }> = []
        for (let i = 1; i <= enabledCount; i++) {
          const nameSetting = criteriaConfig?.find(s => s.key === `${criteriaPrefix}${i}_name`) ||
                             criteriaConfig?.find(s => s.key === `criteria_${i}_name`)
          const weightSetting = criteriaConfig?.find(s => s.key === `${criteriaPrefix}${i}_weight`) ||
                               criteriaConfig?.find(s => s.key === `criteria_${i}_weight`)

          criteria.push({
            number: i,
            name: nameSetting?.value || `Criteria ${i}`,
            weight: weightSetting?.value ? parseFloat(weightSetting.value) : 1.0
          })
        }

        console.log(`[RESCORE] Using ${criteria.length} criteria: ${criteria.map(c => c.name).join(', ')}`)

        // Process posts
        let successCount = 0
        let errorCount = 0

        for (const post of posts) {
          console.log(`[RESCORE] Processing: ${post.title.substring(0, 60)}...`)

          try {
            // Evaluate post against each criterion
            const criteriaScores: CriteriaScore[] = []

            for (const criterion of criteria) {
              const fullText = post.full_article_text || post.content || post.description || ''
              const promptKey = `ai_prompt_criteria_${criterion.number}`

              const result = await callAIWithPrompt(promptKey, publicationId, {
                title: post.title,
                description: post.description || '',
                content: fullText
              })

              if (!result || typeof result !== 'object') {
                throw new Error(`Invalid AI response for criterion ${criterion.number}`)
              }

              const score = result.score
              const reason = result.reason || ''

              if (typeof score !== 'number' || score < 0 || score > 10) {
                throw new Error(`Criterion ${criterion.number} score must be between 0-10, got ${score}`)
              }

              criteriaScores.push({
                score,
                reason,
                weight: criterion.weight
              })
            }

            // Calculate weighted total score
            let totalWeightedScore = 0
            criteriaScores.forEach(({ score, weight }) => {
              totalWeightedScore += score * weight
            })

            // Build rating record
            const ratingRecord: Record<string, any> = {
              post_id: post.id,
              interest_level: criteriaScores[0]?.score || 0,
              local_relevance: criteriaScores[1]?.score || 0,
              community_impact: criteriaScores[2]?.score || 0,
              ai_reasoning: criteriaScores.map((c, i) => `${criteria[i]?.name}: ${c.reason}`).join('\n\n'),
              total_score: totalWeightedScore
            }

            // Add individual criteria scores
            for (let k = 0; k < criteriaScores.length && k < 5; k++) {
              const criterionNum = k + 1
              ratingRecord[`criteria_${criterionNum}_score`] = criteriaScores[k].score
              ratingRecord[`criteria_${criterionNum}_reason`] = criteriaScores[k].reason
              ratingRecord[`criteria_${criterionNum}_weight`] = criteriaScores[k].weight
            }

            if (!dryRun) {
              // Delete existing rating
              await supabaseAdmin
                .from('post_ratings')
                .delete()
                .eq('post_id', post.id)

              // Insert new rating
              const { error: insertError } = await supabaseAdmin
                .from('post_ratings')
                .insert([ratingRecord])

              if (insertError) {
                throw new Error(`Failed to insert rating: ${insertError.message}`)
              }
            }

            successCount++
            console.log(`[RESCORE] ${dryRun ? 'Would update' : 'Updated'} ${post.id}`)

            // Small delay between posts
            await new Promise(resolve => setTimeout(resolve, 500))

          } catch (error) {
            errorCount++
            console.error(`[RESCORE] Error for ${post.id}:`, error instanceof Error ? error.message : 'Unknown error')
          }
        }

        console.log(`[RESCORE] Complete: ${successCount} succeeded, ${errorCount} failed`)

        return NextResponse.json({
          status: 'success',
          dry_run: dryRun,
          message: dryRun
            ? `DRY RUN: Would rescore ${successCount} posts`
            : `Rescored ${successCount} posts`,
          since,
          publication_id: publicationId,
          section,
          offset,
          next_offset: posts.length === limit ? offset + limit : null,
          total_posts: posts.length,
          succeeded: successCount,
          failed: errorCount
        })

      } catch (error) {
        console.error('[RESCORE] Error:', error)
        return NextResponse.json({
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  'rescore-module-posts': {
    GET: async ({ request }) => {
      const { searchParams } = new URL(request.url)
      const publicationId = searchParams.get('publication_id')
      const days = parseInt(searchParams.get('days') || '7')
      const minScore = parseFloat(searchParams.get('min_score') || '0')
      const limit = parseInt(searchParams.get('limit') || '20')
      const offset = parseInt(searchParams.get('offset') || '0')
      const dryRun = searchParams.get('dry_run') !== 'false'
      const articleModuleId = searchParams.get('article_module_id')
      const ratedBefore = searchParams.get('rated_before')
      const ratedAfter = searchParams.get('rated_after')

      if (!publicationId) {
        return NextResponse.json({ error: 'publication_id required' }, { status: 400 })
      }

      try {
        const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

        const { data: feeds, error: feedsError } = await supabaseAdmin
          .from('rss_feeds')
          .select('id')
          .eq('publication_id', publicationId)

        if (feedsError) throw new Error(`Failed to fetch feeds: ${feedsError.message}`)

        if (!feeds || feeds.length === 0) {
          return NextResponse.json({
            status: 'success',
            message: 'No feeds found for publication',
            publication_id: publicationId,
            posts_found: 0
          })
        }

        const feedIds = feeds.map(f => f.id)

        let postsQuery = supabaseAdmin
          .from('rss_posts')
          .select('id, title, description, content, full_article_text, article_module_id, feed_id, ticker, transaction_type, publication_date, post_ratings!inner(id, total_score, created_at)')
          .in('feed_id', feedIds)
          .not('article_module_id', 'is', null)
          .gte('publication_date', sinceIso)
          .gte('post_ratings.total_score', minScore)
          .order('publication_date', { ascending: false })
          .range(offset, offset + limit - 1)

        if (articleModuleId) {
          postsQuery = postsQuery.eq('article_module_id', articleModuleId)
        }

        if (ratedBefore) {
          postsQuery = postsQuery.lt('post_ratings.created_at', ratedBefore)
        }

        if (ratedAfter) {
          postsQuery = postsQuery.gte('post_ratings.created_at', ratedAfter)
        }

        const { data: posts, error: postsError } = await postsQuery

        if (postsError) throw new Error(`Failed to fetch posts: ${postsError.message}`)

        if (!posts || posts.length === 0) {
          return NextResponse.json({
            status: 'success',
            message: 'No posts match criteria',
            publication_id: publicationId,
            days,
            min_score: minScore,
            offset,
            posts_found: 0
          })
        }

        console.log(`[RESCORE-MODULE] ${dryRun ? 'DRY RUN: ' : ''}Processing ${posts.length} posts for publication ${publicationId}`)

        const { Scoring } = await import('@/lib/rss-processor/scoring')
        const scoring = new Scoring()

        let successCount = 0
        let errorCount = 0
        const errors: Array<{ post_id: string; error: string }> = []

        for (const post of posts) {
          try {
            const evaluation: any = await scoring.evaluatePost(
              post as any,
              publicationId,
              'primary',
              post.article_module_id
            )

            const ratingRecord: Record<string, any> = {
              post_id: post.id,
              interest_level: evaluation.interest_level || 0,
              local_relevance: evaluation.local_relevance || 0,
              community_impact: evaluation.community_impact || 0,
              ai_reasoning: evaluation.reasoning,
              total_score: evaluation.total_score
            }

            const criteriaScores = evaluation.criteria_scores
            if (criteriaScores && Array.isArray(criteriaScores)) {
              for (let k = 0; k < criteriaScores.length && k < 5; k++) {
                const criterionNum = criteriaScores[k].criteria_number || (k + 1)
                ratingRecord[`criteria_${criterionNum}_score`] = criteriaScores[k].score
                ratingRecord[`criteria_${criterionNum}_reason`] = criteriaScores[k].reason
                ratingRecord[`criteria_${criterionNum}_weight`] = criteriaScores[k].weight
              }
            }

            if (!dryRun) {
              const { error: deleteError } = await supabaseAdmin
                .from('post_ratings')
                .delete()
                .eq('post_id', post.id)

              if (deleteError) throw new Error(`Delete failed: ${deleteError.message}`)

              const { error: insertError } = await supabaseAdmin
                .from('post_ratings')
                .insert([ratingRecord])

              if (insertError) throw new Error(`Insert failed: ${insertError.message}`)
            }

            successCount++
            await new Promise(resolve => setTimeout(resolve, 300))

          } catch (error) {
            errorCount++
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            console.error(`[RESCORE-MODULE] Error for ${post.id}:`, errorMsg)
            errors.push({ post_id: post.id, error: errorMsg })
          }
        }

        console.log(`[RESCORE-MODULE] Complete: ${successCount} succeeded, ${errorCount} failed`)

        return NextResponse.json({
          status: 'success',
          dry_run: dryRun,
          publication_id: publicationId,
          days,
          min_score: minScore,
          article_module_id: articleModuleId,
          rated_before: ratedBefore,
          rated_after: ratedAfter,
          offset,
          next_offset: posts.length === limit ? offset + limit : null,
          posts_processed: posts.length,
          succeeded: successCount,
          failed: errorCount,
          errors: errors.slice(0, 10)
        })

      } catch (error) {
        console.error('[RESCORE-MODULE] Error:', error)
        return NextResponse.json({
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  'rss-images': {
    GET: async ({ logger }) => {
      try {
        console.log('=== RSS IMAGES DEBUG ===')

        // Get recent RSS posts with image URLs
        const { data: posts, error: postsError } = await supabaseAdmin
          .from('rss_posts')
          .select(`
            id,
            title,
            image_url,
            publication_date,
            issueId,
            rss_feed:rss_feeds(name)
          `)
          .order('publication_date', { ascending: false })
          .limit(20)

        console.log('Posts query:', { posts: posts?.length, error: postsError })

        // Get recent articles with their RSS post images
        const { data: articles, error: articlesError } = await supabaseAdmin
          .from('module_articles')
          .select(`
            id,
            headline,
            is_active,
            issue_id,
            rss_post:rss_posts(
              id,
              title,
              image_url
            )
          `)
          .order('created_at', { ascending: false })
          .limit(10)

        console.log('Articles query:', { articles: articles?.length, error: articlesError })

        return NextResponse.json({
          debug: 'RSS Images Analysis',
          posts: {
            total: posts?.length || 0,
            withImages: posts?.filter(p => p.image_url)?.length || 0,
            data: posts || []
          },
          articles: {
            total: articles?.length || 0,
            withImages: articles?.filter((a: any) => a.rss_post?.image_url)?.length || 0,
            data: articles || []
          },
          postsError,
          articlesError
        })

      } catch (error) {
        console.error('Debug endpoint error:', error)
        return NextResponse.json({
          error: error instanceof Error ? error.message : 'Unknown error',
          debug: 'Failed to query database'
        }, { status: 500 })
      }
    }
  },

  'rss-posts-count': {
    GET: async ({ request, logger }) => {
      try {
        const { searchParams } = new URL(request.url)
        const issueId = searchParams.get('issue_id')

        if (!issueId) {
          return NextResponse.json({ error: 'issueId required' }, { status: 400 })
        }

        // Get all posts
        const { data: allPosts, count: totalPosts } = await supabaseAdmin
          .from('rss_posts')
          .select('id, title, post_ratings(total_score)', { count: 'exact' })
          .eq('issue_id', issueId)

        // Get posts with ratings
        const postsWithRatings = allPosts?.filter(p => p.post_ratings && p.post_ratings.length > 0) || []

        // Get duplicates (two-step query for proper filtering)
        const { data: duplicateGroups } = await supabaseAdmin
          .from('duplicate_groups')
          .select('id')
          .eq('issue_id', issueId)

        const groupIds = duplicateGroups?.map(g => g.id) || []

        let duplicateIds = new Set<string>()
        if (groupIds.length > 0) {
          const { data: duplicates } = await supabaseAdmin
            .from('duplicate_posts')
            .select('post_id')
            .in('group_id', groupIds)

          duplicateIds = new Set(duplicates?.map(d => d.post_id) || [])
        }

        // Get articles
        const { data: articles, count: totalArticles } = await supabaseAdmin
          .from('module_articles')
          .select('id', { count: 'exact' })
          .eq('issue_id', issueId)

        return NextResponse.json({
          issue_id: issueId,
          total_rss_posts: totalPosts,
          posts_with_ratings: postsWithRatings.length,
          duplicate_posts: duplicateIds.size,
          non_duplicate_posts_with_ratings: postsWithRatings.filter(p => !duplicateIds.has(p.id)).length,
          total_articles_created: totalArticles,
          all_posts: allPosts?.map(p => ({
            id: p.id,
            title: p.title,
            has_rating: !!(p.post_ratings && p.post_ratings.length > 0),
            score: p.post_ratings?.[0]?.total_score || null,
            is_duplicate: duplicateIds.has(p.id)
          }))
        })

      } catch (error) {
        console.error('Error:', error)
        return NextResponse.json({
          error: 'Failed to get post counts',
          message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  'rss-status': {
    GET: async ({ logger }) => {
      try {
        // Get total post count
        const { count: totalPosts } = await supabaseAdmin
          .from('rss_posts')
          .select('*', { count: 'exact', head: true })

        // Get unassigned posts (issueId IS NULL)
        const { count: unassignedPosts } = await supabaseAdmin
          .from('rss_posts')
          .select('*', { count: 'exact', head: true })
          .is('issue_id', null)

        // Get most recent posts
        const { data: recentPosts } = await supabaseAdmin
          .from('rss_posts')
          .select('title, created_at, processed_at, issue_id, feed:rss_feeds(name)')
          .order('created_at', { ascending: false })
          .limit(10)

        // Get posts from last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { count: last24Hours } = await supabaseAdmin
          .from('rss_posts')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', oneDayAgo)

        // Get posts from last 6 hours (ingest window)
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
        const { count: last6Hours } = await supabaseAdmin
          .from('rss_posts')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', sixHoursAgo)

        // Get active feeds
        const { data: activeFeeds } = await supabaseAdmin
          .from('rss_feeds')
          .select('name, url, active')
          .eq('active', true)

        // Get post count by feed (last 24 hours)
        const { data: feedActivity } = await supabaseAdmin
          .from('rss_posts')
          .select('feed_id, feed:rss_feeds(name)')
          .gte('created_at', oneDayAgo)

        const feedCounts = feedActivity?.reduce((acc: Record<string, number>, post: any) => {
          const feedName = post.feed?.name || 'Unknown'
          acc[feedName] = (acc[feedName] || 0) + 1
          return acc
        }, {})

        return NextResponse.json({
          summary: {
            totalPosts,
            unassignedPosts,
            postsLast24Hours: last24Hours,
            postsLast6Hours: last6Hours,
            activeFeeds: activeFeeds?.length || 0
          },
          feeds: {
            active: activeFeeds,
            activityLast24Hours: feedCounts
          },
          recentPosts: recentPosts?.map((post: any) => ({
            title: post.title,
            feedName: post.feed?.name,
            createdAt: post.created_at,
            processedAt: post.processed_at,
            assigned: post.issue_id !== null
          })),
          timestamp: new Date().toISOString(),
          diagnostics: {
            message: (last6Hours || 0) === 0
              ? 'No posts ingested in last 6 hours - RSS feeds may not have new content or ingestion may be failing'
              : (last6Hours || 0) < 5
              ? `Only ${last6Hours} posts in last 6 hours - RSS feeds may have low activity`
              : `${last6Hours} posts ingested in last 6 hours - ingestion appears to be working`
          }
        })

      } catch (error) {
        console.error('[RSS Status] Error:', error)
        return NextResponse.json({
          error: 'Failed to fetch RSS status',
          message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }
  },

  'trace-rss-processing': {
    GET: async ({ logger }) => {
      try {
        console.log('=== RSS Processing Trace Started ===')

        // 1. Check for latest issue
        const { data: issues, error: issueError } = await supabaseAdmin
          .from('publication_issues')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)

        console.log('Latest issue:', issues)

        if (issueError || !issues || issues.length === 0) {
          return NextResponse.json({
            error: 'No issues found',
            details: issueError
          })
        }

        const issue = issues[0]

        // 2. Check for RSS posts
        const { data: rssPosts, error: postsError } = await supabaseAdmin
          .from('rss_posts')
          .select('*')
          .eq('issue_id', issue.id)

        console.log(`Found ${rssPosts?.length || 0} RSS posts for issue ${issue.id}`)

        if (postsError) {
          return NextResponse.json({
            error: 'Failed to fetch RSS posts',
            details: postsError
          })
        }

        // 3. Check for post ratings
        const postIds = rssPosts?.map(p => p.id) || []
        const { data: ratings, error: ratingsError } = await supabaseAdmin
          .from('post_ratings')
          .select('*')
          .in('post_id', postIds)

        console.log(`Found ${ratings?.length || 0} ratings for ${postIds.length} posts`)

        if (ratingsError) {
          return NextResponse.json({
            error: 'Failed to fetch ratings',
            details: ratingsError
          })
        }

        // 4. Check for articles
        const { data: articles, error: articlesError } = await supabaseAdmin
          .from('module_articles')
          .select('id, post_id, headline, content, rank, is_active, skipped, article_module_id, created_at')
          .eq('issue_id', issue.id)

        console.log(`Found ${articles?.length || 0} articles for issue ${issue.id}`)

        if (articlesError) {
          return NextResponse.json({
            error: 'Failed to fetch articles',
            details: articlesError
          })
        }

        // 5. Detailed post analysis
        const postsWithRatings = rssPosts?.map(post => {
          const rating = ratings?.find(r => r.post_id === post.id)
          return {
            id: post.id,
            title: post.title,
            published_date: post.published_date,
            has_rating: !!rating,
            total_score: rating?.total_score,
            criteria_1_score: rating?.criteria_1_score,
            criteria_2_score: rating?.criteria_2_score,
            criteria_3_score: rating?.criteria_3_score
          }
        })

        return NextResponse.json({
          success: true,
          issue: {
            id: issue.id,
            date: issue.date,
            status: issue.status,
            created_at: issue.created_at
          },
          rss_posts_count: rssPosts?.length || 0,
          ratings_count: ratings?.length || 0,
          articles_count: articles?.length || 0,
          posts_with_ratings: postsWithRatings,
          ratings_summary: ratings?.map(r => ({
            post_id: r.post_id,
            total_score: r.total_score,
            criteria_1_score: r.criteria_1_score,
            criteria_2_score: r.criteria_2_score,
            criteria_3_score: r.criteria_3_score,
            created_at: r.created_at
          }))
        })

      } catch (error) {
        console.error('Trace RSS processing error:', error)
        return NextResponse.json(
          {
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        )
      }
    }
  },

  'trade-image': {
    GET: async ({ request }) => {
      const { searchParams } = new URL(request.url)
      const tradeId = searchParams.get('trade_id')

      // If no trade_id, pick the first trade that has a name
      let trade: any

      if (tradeId) {
        const { data, error } = await supabaseAdmin
          .from('congress_trades')
          .select('id, ticker, company, name, chamber, state, transaction, image_url')
          .eq('id', tradeId)
          .maybeSingle()

        if (error || !data) {
          return NextResponse.json({ error: 'Trade not found', tradeId }, { status: 404 })
        }
        trade = data
      } else {
        // Pick the largest trade with a name for demo
        const { data, error } = await supabaseAdmin
          .from('congress_trades')
          .select('id, ticker, company, name, chamber, state, transaction, image_url, trade_size_parsed')
          .not('name', 'is', null)
          .order('trade_size_parsed', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error || !data) {
          return NextResponse.json({ error: 'No trades found' }, { status: 404 })
        }
        trade = data
      }

      const force = searchParams.get('force') === 'true'

      // Resolve company name from ticker_company_names table
      const { data: nameMapping } = await supabaseAdmin
        .from('ticker_company_names')
        .select('company_name')
        .eq('ticker', trade.ticker.toUpperCase())
        .maybeSingle()

      if (nameMapping?.company_name) {
        trade.company = nameMapping.company_name
      }

      // If force, delete existing image from storage and clear DB field
      if (force && trade.image_url) {
        const objectPath = `st/t/${trade.id}.png`
        await supabaseAdmin.storage.from('img').remove([objectPath])
        await supabaseAdmin
          .from('congress_trades')
          .update({ image_url: null })
          .eq('id', trade.id)
        trade.image_url = null
      }

      // Generate the image (will skip if already exists unless forced)
      const imageUrl = await generateAndUploadTradeImage(trade)

      return NextResponse.json({
        trade: {
          id: trade.id,
          name: trade.name,
          ticker: trade.ticker,
          company: trade.company,
          chamber: trade.chamber,
          state: trade.state,
          transaction: trade.transaction,
        },
        imageUrl,
        regenerated: force,
      })
    }
  },
}
