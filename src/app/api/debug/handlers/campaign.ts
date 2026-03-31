import { NextResponse } from 'next/server'
import type { ApiHandlerContext } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { newsletterArchiver } from '@/lib/newsletter-archiver'
import { ArticleArchiveService } from '@/lib/article-archive'
import { callOpenAI } from '@/lib/openai'
import { AI_PROMPTS } from '@/lib/openai/prompt-loaders'
import { MailerLiteService } from '@/lib/mailerlite'

type DebugHandler = (context: ApiHandlerContext) => Promise<NextResponse>

export const handlers: Record<string, { GET?: DebugHandler; POST?: DebugHandler }> = {
  'activate-articles': {
    POST: async ({ request, logger }) => {
      console.log('=== ACTIVATING TOP ARTICLES ===')

      // Get latest issue or specified issue ID
      const body = await request.json().catch(() => ({}))
      let issueId = body.issueId

      if (!issueId) {
        const { data: issue, error } = await supabaseAdmin
          .from('publication_issues')
          .select('id, date, status')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (error || !issue) {
          return NextResponse.json({
            success: false,
            error: 'No issue found'
          }, { status: 404 })
        }

        issueId = issue.id
        console.log('Using latest issue:', issueId)
      }

      // Get all articles for this issue with ratings
      const { data: articles, error: articlesError } = await supabaseAdmin
        .from('module_articles')
        .select(`
          id,
          headline,
          is_active,
          rss_post:rss_posts(
            post_rating:post_ratings(total_score)
          )
        `)
        .eq('issue_id', issueId)

      if (articlesError || !articles) {
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch articles',
          details: articlesError?.message
        }, { status: 500 })
      }

      console.log(`Found ${articles.length} articles for issue ${issueId}`)

      // Sort articles by score
      const sortedArticles = articles
        .map(article => ({
          id: article.id,
          headline: article.headline,
          score: (article.rss_post as any)?.post_rating?.[0]?.total_score || 0,
          currentlyActive: article.is_active
        }))
        .sort((a, b) => b.score - a.score)

      const top5ArticleIds = sortedArticles.slice(0, 5).map(a => a.id)
      const remainingArticleIds = sortedArticles.slice(5).map(a => a.id)

      console.log(`Setting ${top5ArticleIds.length} articles as active, ${remainingArticleIds.length} as inactive`)

      // Set top 5 as active
      if (top5ArticleIds.length > 0) {
        const { error: activateError } = await supabaseAdmin
          .from('module_articles')
          .update({ is_active: true })
          .in('id', top5ArticleIds)

        if (activateError) {
          console.error('Error activating articles:', activateError)
          return NextResponse.json({
            success: false,
            error: 'Failed to activate top articles',
            details: activateError.message
          }, { status: 500 })
        }
      }

      // Set remaining as inactive
      if (remainingArticleIds.length > 0) {
        const { error: deactivateError } = await supabaseAdmin
          .from('module_articles')
          .update({ is_active: false })
          .in('id', remainingArticleIds)

        if (deactivateError) {
          console.error('Error deactivating articles:', deactivateError)
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Articles activated successfully',
        issueId,
        totalArticles: articles.length,
        activatedArticles: top5ArticleIds.length,
        deactivatedArticles: remainingArticleIds.length,
        topArticles: sortedArticles.slice(0, 5).map(a => ({
          id: a.id,
          headline: a.headline,
          score: a.score,
          wasActive: a.currentlyActive
        })),
        timestamp: new Date().toISOString()
      })
    }
  },

  'archive-campaign': {
    GET: async ({ request, logger }) => {
      const { searchParams } = new URL(request.url)
      const issueId = searchParams.get('issueId')
      const issueDate = searchParams.get('date')

      if (!issueId && !issueDate) {
        return NextResponse.json({
          error: 'Missing required parameter: issueId or date',
          usage: 'Call with ?issueId=XXX or ?date=YYYY-MM-DD'
        }, { status: 400 })
      }

      // View mode - just show archive contents
      const viewMode = searchParams.get('view') === 'true'
      if (viewMode) {
        const { data: archived, error: archiveError } = await supabaseAdmin
          .from('archived_newsletters')
          .select('*')
          .eq('issue_date', issueDate || '')
          .single()

        if (archiveError || !archived) {
          return NextResponse.json({
            error: 'Archive not found',
            details: archiveError?.message
          }, { status: 404 })
        }

        return NextResponse.json({
          success: true,
          archive: {
            id: archived.id,
            issue_date: archived.issue_date,
            subject_line: archived.subject_line,
            metadata: archived.metadata,
            sections_keys: Object.keys(archived.sections || {}),
            sections: archived.sections
          }
        })
      }

      console.log('[ARCHIVE] Manual archive request:', { issueId, issueDate })

      // Fetch issue
      let query = supabaseAdmin
        .from('publication_issues')
        .select('*')

      if (issueId) {
        query = query.eq('id', issueId)
      } else if (issueDate) {
        query = query.eq('date', issueDate)
      }

      const { data: issue, error: issueError } = await query.single()

      if (issueError || !issue) {
        return NextResponse.json({
          error: 'issue not found',
          details: issueError?.message,
          issueId,
          issueDate
        }, { status: 404 })
      }

      console.log('[ARCHIVE] Found issue:', {
        id: issue.id,
        date: issue.date,
        status: issue.status,
        subject_line: issue.subject_line
      })

      // Check if already archived
      const force = searchParams.get('force') === 'true'
      const { data: existing, error: existingError } = await supabaseAdmin
        .from('archived_newsletters')
        .select('id, issue_date')
        .eq('issue_id', issue.id)
        .single()

      if (existing && !existingError) {
        if (!force) {
          return NextResponse.json({
            success: false,
            message: 'issue already archived',
            archive_id: existing.id,
            issue_date: existing.issue_date,
            note: 'Add &force=true to re-archive and overwrite'
          })
        }
        // Delete existing archive to re-archive
        console.log('[ARCHIVE] Force re-archive requested, deleting existing archive:', existing.id)
        const { error: deleteError } = await supabaseAdmin
          .from('archived_newsletters')
          .delete()
          .eq('id', existing.id)

        if (deleteError) {
          return NextResponse.json({
            success: false,
            error: 'Failed to delete existing archive',
            details: deleteError.message
          }, { status: 500 })
        }
      }

      // Archive the newsletter
      const result = await newsletterArchiver.archiveNewsletter({
        issueId: issue.id,
        issueDate: issue.date,
        subjectLine: issue.subject_line || 'Newsletter',
        recipientCount: 0 // We don't have this data for past issues
      })

      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: 'Failed to archive newsletter',
          details: result.error
        }, { status: 500 })
      }

      // Verify archive was created
      const { data: archived, error: verifyError } = await supabaseAdmin
        .from('archived_newsletters')
        .select('id, issue_date, subject_line')
        .eq('issue_id', issue.id)
        .single()

      if (verifyError || !archived) {
        return NextResponse.json({
          success: false,
          error: 'Archive created but verification failed',
          details: verifyError?.message
        }, { status: 500 })
      }

      console.log('[ARCHIVE] Successfully archived:', archived)

      return NextResponse.json({
        success: true,
        message: 'Newsletter archived successfully',
        issue: {
          id: issue.id,
          date: issue.date,
          subject_line: issue.subject_line,
          status: issue.status
        },
        archive: {
          id: archived.id,
          issue_date: archived.issue_date,
          subject_line: archived.subject_line
        },
        note: 'Newsletter should now appear at /website/newsletters'
      })
    }
  },

  'archived-articles': {
    GET: async ({ request, logger }) => {
      const { searchParams } = new URL(request.url)
      const issueId = searchParams.get('issue_id')
      const startDate = searchParams.get('start_date')
      const endDate = searchParams.get('end_date')
      const statsOnly = searchParams.get('stats_only') === 'true'

      const archiveService = new ArticleArchiveService()

      // Return just statistics if requested
      if (statsOnly) {
        const stats = await archiveService.getArchiveStats()
        return NextResponse.json({
          success: true,
          stats,
          timestamp: new Date().toISOString()
        })
      }

      // Get archived articles by issue ID
      if (issueId) {
        const archivedArticles = await archiveService.getArchivedArticles(issueId)

        return NextResponse.json({
          success: true,
          issue_id: issueId,
          archived_articles_count: archivedArticles.length,
          articles_with_positions: archivedArticles.filter(a =>
            a.review_position !== null || a.final_position !== null
          ).length,
          archived_articles: archivedArticles.map(article => ({
            id: article.id,
            original_article_id: article.original_article_id,
            headline: article.headline,
            review_position: article.review_position,
            final_position: article.final_position,
            is_active: article.is_active,
            archived_at: article.archived_at,
            archive_reason: article.archive_reason,
            issue_date: article.issue_date,
            issue_status: article.issue_status
          })),
          timestamp: new Date().toISOString()
        })
      }

      // Get archived articles by date range
      if (startDate && endDate) {
        const archivedArticles = await archiveService.getArchivedArticlesByDateRange(startDate, endDate)

        return NextResponse.json({
          success: true,
          date_range: { start: startDate, end: endDate },
          archived_articles_count: archivedArticles.length,
          articles_with_positions: archivedArticles.filter(a =>
            a.review_position !== null || a.final_position !== null
          ).length,
          issues_archived: Array.from(new Set(archivedArticles.map(a => a.issue_id))).length,
          archived_articles: archivedArticles.map(article => ({
            id: article.id,
            original_article_id: article.original_article_id,
            issue_id: article.issue_id,
            headline: article.headline,
            review_position: article.review_position,
            final_position: article.final_position,
            is_active: article.is_active,
            archived_at: article.archived_at,
            archive_reason: article.archive_reason,
            issue_date: article.issue_date,
            issue_status: article.issue_status
          })),
          timestamp: new Date().toISOString()
        })
      }

      // If no specific parameters, return recent archive stats and sample
      const stats = await archiveService.getArchiveStats()

      return NextResponse.json({
        success: true,
        message: 'Article Archive API - provide issueId, date range (start_date & end_date), or stats_only=true',
        stats,
        examples: {
          by_issue: '/api/debug/archived-articles?issueId=YOUR_issue_ID',
          by_date_range: '/api/debug/archived-articles?start_date=2025-09-01&end_date=2025-09-30',
          stats_only: '/api/debug/archived-articles?stats_only=true'
        },
        timestamp: new Date().toISOString()
      })
    }
  },

  'articles-analysis': {
    GET: async ({ logger }) => {
      // Get all active articles with their headlines and content
      const { data: articles, error } = await supabaseAdmin
        .from('module_articles')
        .select('id, headline, content, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) {
        throw error
      }

      return NextResponse.json({
        success: true,
        count: articles?.length || 0,
        articles: articles || []
      })
    }
  },

  'assign-test-ad': {
    POST: async ({ request, logger }) => {
      const body = await request.json()
      const { issueId, adId } = body

      if (!issueId || !adId) {
        return NextResponse.json(
          { error: 'Missing issueId or adId' },
          { status: 400 }
        )
      }

      // Get issue date
      const { data: issue, error: issueError } = await supabaseAdmin
        .from('publication_issues')
        .select('date')
        .eq('id', issueId)
        .single()

      if (issueError || !issue) {
        return NextResponse.json(
          { error: 'issue not found', details: issueError },
          { status: 404 }
        )
      }

      // Check if already assigned
      const { data: existing } = await supabaseAdmin
        .from('issue_advertisements')
        .select('id')
        .eq('issue_id', issueId)
        .maybeSingle()

      if (existing) {
        // Update existing assignment
        const { error: updateError } = await supabaseAdmin
          .from('issue_advertisements')
          .update({
            advertisement_id: adId,
            issue_date: issue.date,
            used_at: new Date().toISOString()
          })
          .eq('issue_id', issueId)

        if (updateError) {
          return NextResponse.json(
            { error: 'Failed to update assignment', details: updateError },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          message: 'Updated existing ad assignment (no usage stats changed)',
          issueId,
          adId
        })
      } else {
        // Insert new assignment
        const { error: insertError } = await supabaseAdmin
          .from('issue_advertisements')
          .insert({
            issue_id: issueId,
            advertisement_id: adId,
            issue_date: issue.date,
            used_at: new Date().toISOString()
          })

        if (insertError) {
          return NextResponse.json(
            { error: 'Failed to insert assignment', details: insertError },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          message: 'Created new ad assignment (no usage stats changed)',
          issueId,
          adId
        })
      }
    }
  },

  'campaign-articles': {
    GET: async ({ request, logger }) => {
      const { searchParams } = new URL(request.url)
      const issueId = searchParams.get('issue_id')

      if (!issueId) {
        return NextResponse.json({ error: 'issueId required' }, { status: 400 })
      }

      // Fetch issue with active articles
      const { data: issue, error } = await supabaseAdmin
        .from('publication_issues')
        .select(`
          *,
          articles:articles(
            headline,
            content,
            is_active,
            rss_post:rss_posts(
              title,
              description,
              content,
              post_rating:post_ratings(total_score)
            )
          )
        `)
        .eq('id', issueId)
        .single()

      if (error || !issue) {
        return NextResponse.json({ error: 'issue not found' }, { status: 404 })
      }

      // Get total RSS posts count for this issue
      const { data: allPosts, error: postsError } = await supabaseAdmin
        .from('rss_posts')
        .select('id, title, post_ratings(total_score)')
        .eq('issue_id', issueId)

      // Get duplicate posts count (two-step query for proper filtering)
      const { data: duplicateGroups } = await supabaseAdmin
        .from('duplicate_groups')
        .select('id')
        .eq('issue_id', issueId)

      const groupIds = duplicateGroups?.map(g => g.id) || []

      let duplicates: { post_id: string }[] = []
      if (groupIds.length > 0) {
        const { data: duplicateData } = await supabaseAdmin
          .from('duplicate_posts')
          .select('post_id')
          .in('group_id', groupIds)

        duplicates = duplicateData || []
      }

      // Get active articles sorted by rating (highest first)
      const activeArticles = issue.articles
        .filter((article: any) => article.is_active)
        .sort((a: any, b: any) => {
          const scoreA = a.rss_post?.post_rating?.[0]?.total_score || 0
          const scoreB = b.rss_post?.post_rating?.[0]?.total_score || 0
          return scoreB - scoreA
        })

      const duplicatePostIds = new Set(duplicates?.map(d => d.post_id) || [])
      const postsWithRatings = allPosts?.filter(p => p.post_ratings?.[0]) || []
      const nonDuplicatePosts = postsWithRatings.filter(p => !duplicatePostIds.has(p.id))

      return NextResponse.json({
        issue_id: issueId,
        issue_date: issue.date,
        total_rss_posts: allPosts?.length || 0,
        posts_with_ratings: postsWithRatings.length,
        duplicate_posts: duplicatePostIds.size,
        non_duplicate_posts: nonDuplicatePosts.length,
        total_articles: issue.articles.length,
        active_articles: activeArticles.length,
        all_posts: allPosts?.map((post: any) => ({
          id: post.id,
          title: post.title,
          has_rating: !!post.post_ratings?.[0],
          score: post.post_ratings?.[0]?.total_score || null,
          is_duplicate: duplicatePostIds.has(post.id),
          has_article: issue.articles.some((a: any) => a.rss_post?.title === post.title)
        })),
        top_article: activeArticles[0] ? {
          headline: activeArticles[0].headline,
          content_preview: activeArticles[0].content?.substring(0, 200) + '...',
          content_length: activeArticles[0].content?.length || 0,
          score: activeArticles[0].rss_post?.post_rating?.[0]?.total_score || 0,
          rss_title: activeArticles[0].rss_post?.title,
          rss_description: activeArticles[0].rss_post?.description
        } : null,
        all_active_articles: activeArticles.map((article: any, index: number) => ({
          index,
          headline: article.headline,
          content_preview: article.content?.substring(0, 100) + '...',
          score: article.rss_post?.post_rating?.[0]?.total_score || 0
        }))
      })
    }
  },

  'complete-campaign': {
    POST: async ({ request, logger }) => {
      console.log('=== COMPLETING INTERRUPTED issue ===')

      // Get the issue ID from request body or find latest
      const body = await request.json().catch(() => ({}))
      let issueId = body.issueId

      if (!issueId) {
        // Find the most recent issue
        const { data: latestissue, error } = await supabaseAdmin
          .from('publication_issues')
          .select('id, date, status')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (error || !latestissue) {
          return NextResponse.json({
            success: false,
            error: 'No issue found to complete'
          }, { status: 404 })
        }

        issueId = latestissue.id
        console.log('Found latest issue:', issueId, 'Status:', latestissue.status)
      }

      // Get issue with articles
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
        .eq('id', issueId)
        .single()

      if (issueError || !issue) {
        return NextResponse.json({
          success: false,
          error: 'issue not found',
          issueId
        }, { status: 404 })
      }

      const fixes = []

      // Fix 1: Reset status to draft
      if (issue.status !== 'draft') {
        await supabaseAdmin
          .from('publication_issues')
          .update({
            status: 'draft',
            review_sent_at: null
          })
          .eq('id', issueId)

        fixes.push(`Status changed from '${issue.status}' to 'draft'`)
      }

      // Fix 2: Generate subject line if missing
      let generatedSubject = issue.subject_line
      if (!issue.subject_line) {
        console.log('Generating missing subject line...')

        const activeArticles = issue.articles
          ?.filter((article: any) => article.is_active)
          ?.sort((a: any, b: any) => {
            const scoreA = a.rss_post?.post_rating?.[0]?.total_score || 0
            const scoreB = b.rss_post?.post_rating?.[0]?.total_score || 0
            return scoreB - scoreA
          }) || []

        if (activeArticles.length > 0) {
          const topArticle = activeArticles[0]
          const subjectPrompt = await AI_PROMPTS.subjectLineGenerator(topArticle) + `\n\nTimestamp: ${new Date().toISOString()}`

          try {
            const aiResponse = await callOpenAI(subjectPrompt, 100, 0.8)
            if (aiResponse && aiResponse.trim()) {
              generatedSubject = aiResponse.trim()

              await supabaseAdmin
                .from('publication_issues')
                .update({
                  subject_line: generatedSubject,
                  updated_at: new Date().toISOString()
                })
                .eq('id', issueId)

              fixes.push(`Generated subject line: "${generatedSubject}"`)
            }
          } catch (error) {
            fixes.push('Failed to generate subject line: ' + (error instanceof Error ? error.message : 'Unknown error'))
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: 'issue completion fixes applied',
        issueId,
        originalStatus: issue.status,
        subjectLine: generatedSubject,
        activeArticles: issue.articles?.filter((a: any) => a.is_active).length || 0,
        totalArticles: issue.articles?.length || 0,
        fixesApplied: fixes,
        timestamp: new Date().toISOString()
      })
    }
  },

  'deactivate-section': {
    POST: async ({ request, logger }) => {
      const { display_order } = await request.json()

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

      // Deactivate it
      const { error: updateError } = await supabaseAdmin
        .from('newsletter_sections')
        .update({ is_active: false })
        .eq('id', section.id)

      if (updateError) {
        return NextResponse.json({
          success: false,
          error: updateError.message
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Deactivated section: ${section.name}`,
        section: {
          id: section.id,
          name: section.name,
          display_order: section.display_order,
          was_active: section.is_active,
          now_active: false
        }
      })
    }
  },

  'list-sections': {
    GET: async () => {
      const { data: sections, error } = await supabaseAdmin
        .from('newsletter_sections')
        .select('*')
        .order('display_order', { ascending: true })

      if (error) {
        throw error
      }

      return NextResponse.json({
        sections: sections || [],
        total: sections?.length || 0
      })
    }
  },

  'manual-review-send': {
    POST: async () => {
      console.log('=== MANUAL REVIEW SEND ===')

      // Get tomorrow's issue
      const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
      const centralDate = new Date(nowCentral)
      const tomorrow = new Date(centralDate)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const issueDate = tomorrow.toISOString().split('T')[0]

      console.log('Sending review for issue date:', issueDate)

      // Find tomorrow's issue with articles
      const { data: issue, error: issueError } = await supabaseAdmin
        .from('publication_issues')
        .select(`
          *,
          articles:articles(
            *,
            rss_post:rss_posts(
              *,
              rss_feed:rss_feeds(*)
            )
          ),
          manual_articles:manual_articles(*)
        `)
        .eq('date', issueDate)
        .eq('status', 'draft')
        .single()

      if (issueError || !issue) {
        return NextResponse.json({
          success: false,
          error: 'No draft issue found for tomorrow',
          issueDate: issueDate,
          errorDetails: issueError
        }, { status: 404 })
      }

      console.log('Found issue:', issue.id, 'Status:', issue.status)

      // Check if issue has active articles
      const activeArticles = issue.articles.filter((article: any) => article.is_active)
      if (activeArticles.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No active articles found for review sending',
          issueId: issue.id
        }, { status: 400 })
      }

      console.log(`issue has ${activeArticles.length} active articles`)

      // Check if subject line exists
      if (!issue.subject_line || issue.subject_line.trim() === '') {
        return NextResponse.json({
          success: false,
          error: 'No subject line found for issue',
          issueId: issue.id
        }, { status: 400 })
      }

      console.log('Using subject line:', issue.subject_line)

      // Create MailerLite review campaign
      const mailerLiteService = new MailerLiteService()
      const result = await mailerLiteService.createReviewissue(issue)

      console.log('MailerLite issue created:', result.issueId)

      // Update issue status to in_review
      const { error: updateError } = await supabaseAdmin
        .from('publication_issues')
        .update({
          status: 'in_review',
          review_sent_at: new Date().toISOString()
        })
        .eq('id', issue.id)

      if (updateError) {
        console.error('Failed to update issue status:', updateError)
        // Continue anyway since MailerLite issue was created
      }

      console.log('=== MANUAL REVIEW SEND COMPLETED ===')

      return NextResponse.json({
        success: true,
        message: 'Review issue sent to MailerLite successfully',
        issueId: issue.id,
        issueDate: issueDate,
        mailerliteissueId: result.issueId,
        subjectLine: issue.subject_line,
        activeArticlesCount: activeArticles.length,
        timestamp: new Date().toISOString()
      })
    }
  },

  'newsletter-sections': {
    GET: async () => {
      console.log('Debug: Fetching all newsletter sections...')

      // Fetch ALL newsletter sections (not just active ones)
      const { data: allSections, error: allError } = await supabaseAdmin
        .from('newsletter_sections')
        .select('*')
        .order('display_order', { ascending: true })

      if (allError) {
        throw allError
      }

      // Fetch only active sections
      const { data: activeSections, error: activeError } = await supabaseAdmin
        .from('newsletter_sections')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (activeError) {
        throw activeError
      }

      return NextResponse.json({
        success: true,
        total_sections: allSections?.length || 0,
        active_sections: activeSections?.length || 0,
        all_sections: allSections || [],
        active_sections_list: activeSections || [],
        message: `Found ${allSections?.length || 0} total sections, ${activeSections?.length || 0} active sections`
      })
    }
  },

  'recent-campaigns': {
    GET: async () => {
      // Get recent issues
      const { data: issues, error } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, status, subject_line, created_at')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // For the most recent issue, get detailed info
      if (issues && issues.length > 0) {
        const latestIssue = issues[0]

        const { data: detailedIssue, error: detailError } = await supabaseAdmin
          .from('publication_issues')
          .select(`
            *,
            articles:articles(
              id,
              headline,
              content,
              is_active,
              rss_post:rss_posts(
                title,
                description,
                post_rating:post_ratings(total_score)
              )
            )
          `)
          .eq('id', latestIssue.id)
          .single()

        if (!detailError && detailedIssue) {
          // Get active articles sorted by rating
          const activeArticles = detailedIssue.articles
            .filter((article: any) => article.is_active)
            .sort((a: any, b: any) => {
              const scoreA = a.rss_post?.post_rating?.[0]?.total_score || 0
              const scoreB = b.rss_post?.post_rating?.[0]?.total_score || 0
              return scoreB - scoreA
            })

          return NextResponse.json({
            recent_issues: issues,
            latest_issue_details: {
              id: detailedIssue.id,
              date: detailedIssue.date,
              status: detailedIssue.status,
              subject_line: detailedIssue.subject_line,
              total_articles: detailedIssue.articles.length,
              active_articles_count: activeArticles.length,
              top_article: activeArticles[0] ? {
                id: activeArticles[0].id,
                headline: activeArticles[0].headline,
                content_preview: activeArticles[0].content?.substring(0, 300) + '...',
                content_full_length: activeArticles[0].content?.length || 0,
                score: activeArticles[0].rss_post?.post_rating?.[0]?.total_score || 0,
                rss_title: activeArticles[0].rss_post?.title,
                rss_description: activeArticles[0].rss_post?.description?.substring(0, 200) + '...'
              } : null,
              all_active_articles: activeArticles.slice(0, 5).map((article: any, index: number) => ({
                rank: index + 1,
                id: article.id,
                headline: article.headline,
                score: article.rss_post?.post_rating?.[0]?.total_score || 0,
                content_preview: article.content?.substring(0, 100) + '...'
              }))
            }
          })
        }
      }

      return NextResponse.json({ recent_issues: issues })
    }
  },

  'reset-campaign': {
    POST: async ({ request }) => {
      const body = await request.json()
      const issueId = body.issueId

      if (!issueId) {
        return NextResponse.json({ error: 'issueId required' }, { status: 400 })
      }

      console.log('Resetting issue:', issueId)

      // 1. Delete articles
      const { error: articlesError } = await supabaseAdmin
        .from('module_articles')
        .delete()
        .eq('issue_id', issueId)

      if (articlesError) {
        console.error('Error deleting articles:', articlesError)
      } else {
        console.log('Deleted articles')
      }

      // 2. Delete post ratings
      const { data: posts } = await supabaseAdmin
        .from('rss_posts')
        .select('id')
        .eq('issue_id', issueId)

      if (posts && posts.length > 0) {
        const postIds = posts.map(p => p.id)

        const { error: ratingsError } = await supabaseAdmin
          .from('post_ratings')
          .delete()
          .in('post_id', postIds)

        if (ratingsError) {
          console.error('Error deleting ratings:', ratingsError)
        } else {
          console.log('Deleted post ratings')
        }
      }

      // 3. Delete duplicate groups and posts
      const { data: duplicateGroups } = await supabaseAdmin
        .from('duplicate_groups')
        .select('id')
        .eq('issue_id', issueId)

      if (duplicateGroups && duplicateGroups.length > 0) {
        const groupIds = duplicateGroups.map(g => g.id)

        await supabaseAdmin
          .from('duplicate_posts')
          .delete()
          .in('group_id', groupIds)

        await supabaseAdmin
          .from('duplicate_groups')
          .delete()
          .eq('issue_id', issueId)

        console.log('Deleted duplicate groups')
      }

      // 4. Delete RSS posts
      const { error: postsError } = await supabaseAdmin
        .from('rss_posts')
        .delete()
        .eq('issue_id', issueId)

      if (postsError) {
        console.error('Error deleting posts:', postsError)
      } else {
        console.log('Deleted RSS posts')
      }

      // 5. Reset issue subject line
      const { error: issueError } = await supabaseAdmin
        .from('publication_issues')
        .update({
          subject_line: '',
          updated_at: new Date().toISOString()
        })
        .eq('id', issueId)

      if (issueError) {
        console.error('Error resetting issue:', issueError)
      } else {
        console.log('Reset issue subject line')
      }

      return NextResponse.json({
        success: true,
        message: 'issue reset - ready for fresh RSS processing with updated prompts',
        issue_id: issueId
      })
    }
  },

  'schedule-settings': {
    GET: async () => {
      // Get all email schedule settings
      const { data: settings } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .like('key', 'email_%')

      // Get max article settings
      const { data: maxArticles } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .in('key', ['max_top_articles', 'max_bottom_articles'])

      // Also check the last run dates
      const { data: lastRuns } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .like('key', 'last_%_run')

      // Get current Central Time
      const now = new Date()
      const centralTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Chicago"}))
      const currentCT = `${centralTime.getHours().toString().padStart(2, '0')}:${centralTime.getMinutes().toString().padStart(2, '0')}`

      return NextResponse.json({
        currentTime: {
          utc: now.toISOString(),
          central: centralTime.toLocaleString("en-US", {timeZone: "America/Chicago"}),
          centralTime24h: currentCT
        },
        settings: settings || [],
        maxArticles: maxArticles || [],
        lastRuns: lastRuns || [],
        today: new Date().toISOString().split('T')[0]
      })
    }
  },

  'tomorrow-campaign': {
    GET: async () => {
      // Get tomorrow's date
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const issueDate = tomorrow.toISOString().split('T')[0]

      console.log('Checking for issue on date:', issueDate)

      // Check if issue exists for tomorrow
      const { data: issue, error } = await supabaseAdmin
        .from('publication_issues')
        .select(`
          *,
          articles:articles(
            id,
            headline,
            is_active,
            rss_post:rss_posts(
              post_rating:post_ratings(total_score)
            )
          )
        `)
        .eq('date', issueDate)
        .single()

      if (error) {
        return NextResponse.json({
          debug: 'Tomorrow issue Check',
          issueDate,
          exists: false,
          error: error.message,
          recommendation: 'RSS processing needs to run to create tomorrow\'s issue'
        })
      }

      const activeArticles = issue.articles?.filter((article: any) => article.is_active) || []

      return NextResponse.json({
        debug: 'Tomorrow issue Check',
        issueDate,
        exists: true,
        issue: {
          id: issue.id,
          status: issue.status,
          subject_line: issue.subject_line,
          created_at: issue.created_at,
          total_articles: issue.articles?.length || 0,
          active_articles: activeArticles.length,
          review_sent_at: issue.review_sent_at
        },
        activeArticles: activeArticles.map((article: any) => ({
          id: article.id,
          headline: article.headline,
          ai_score: article.rss_post?.post_rating?.[0]?.total_score || 0
        })),
        issues: {
          no_subject_line: !issue.subject_line || issue.subject_line.trim() === '',
          no_active_articles: activeArticles.length === 0,
          wrong_status: issue.status !== 'draft',
          already_sent_review: !!issue.review_sent_at
        },
        recommendation: issue.status !== 'draft' ?
          `issue status is ${issue.status}, should be 'draft' for creation` :
          (!issue.subject_line || issue.subject_line.trim() === '') ?
          'No subject line - run subject line generation' :
          activeArticles.length === 0 ?
          'No active articles found' :
          'issue appears ready for creation'
      })
    }
  },
}
