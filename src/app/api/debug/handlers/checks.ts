import { NextResponse } from 'next/server'
import type { ApiHandlerContext } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { ScheduleChecker } from '@/lib/schedule-checker'
import { STORAGE_PUBLIC_URL, PUBLICATION_ID as EXPECTED_PUBLICATION_ID } from '@/lib/config'
import { isIPExcluded, type IPExclusion } from '@/lib/ip-utils'
import crypto from 'crypto'

type DebugHandler = (context: ApiHandlerContext) => Promise<NextResponse>

// --- Helper used by check-historical-dedup ---
function createContentHash(post: any): string {
  const content = (
    post.full_article_text ||
    post.content ||
    post.description ||
    ''
  ).trim().toLowerCase()

  const normalized = content.replace(/\s+/g, ' ')

  if (normalized.length === 0) {
    return crypto.createHash('md5').update(post.title.toLowerCase()).digest('hex')
  }

  return crypto.createHash('md5').update(normalized).digest('hex')
}

export const handlers: Record<string, { GET?: DebugHandler; POST?: DebugHandler; maxDuration?: number }> = {
  // ─── check-ai-apps ───
  'check-ai-apps': {
    GET: async ({ logger }) => {
      const { data: newsletters, error: newslettersError } = await supabaseAdmin
        .from('publications')
        .select('*')

      if (newslettersError) {
        return NextResponse.json({
          error: 'Failed to fetch newsletters',
          details: newslettersError
        }, { status: 500 })
      }

      const { data: allApps, error: allAppsError } = await supabaseAdmin
        .from('ai_applications')
        .select('*')

      if (allAppsError) {
        return NextResponse.json({
          error: 'Failed to fetch AI applications',
          details: allAppsError
        }, { status: 500 })
      }

      const appsByNewsletter = newsletters?.map(newsletter => {
        const newsletterApps = allApps?.filter(app =>
          app.publication_id === newsletter.id && app.is_active
        ) || []

        return {
          publication_id: newsletter.id,
          newsletter_slug: newsletter.slug,
          newsletter_name: newsletter.name,
          total_apps: newsletterApps.length,
          active_apps: newsletterApps.length,
          apps: newsletterApps.map(app => ({
            id: app.id,
            app_name: app.app_name,
            category: app.category,
            is_active: app.is_active
          }))
        }
      })

      const { data: settings } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .like('key', 'ai_apps_%')

      return NextResponse.json({
        success: true,
        newsletters: newsletters?.map(n => ({ id: n.id, slug: n.slug, name: n.name })),
        total_apps: allApps?.length || 0,
        active_apps: allApps?.filter(a => a.is_active).length || 0,
        apps_by_newsletter: appsByNewsletter,
        ai_app_settings: settings,
        diagnosis: {
          has_newsletters: (newsletters?.length || 0) > 0,
          has_apps: (allApps?.length || 0) > 0,
          has_accounting_newsletter: newsletters?.some(n => n.slug === 'accounting'),
          accounting_has_active_apps: appsByNewsletter?.find(n => n.newsletter_slug === 'accounting')?.active_apps || 0
        }
      })
    }
  },

  // ─── check-ai-apps-selection ───
  'check-ai-apps-selection': {
    GET: async ({ request, logger }) => {
      const searchParams = new URL(request.url).searchParams
      const issueId = searchParams.get('issue_id')

      const { data: allApps, error: appsError } = await supabaseAdmin
        .from('ai_applications')
        .select('*')
        .eq('is_active', true)
        .order('app_name')

      if (appsError) {
        return NextResponse.json({ error: appsError.message }, { status: 500 })
      }

      let issueSelections = null
      if (issueId) {
        const { data: selections, error: selectionsError } = await supabaseAdmin
          .from('issue_ai_app_selections')
          .select(`
            *,
            app:ai_applications(*)
          `)
          .eq('issue_id', issueId)

        if (selectionsError) {
          return NextResponse.json({ error: selectionsError.message }, { status: 500 })
        }

        issueSelections = selections
      }

      const { data: newsletter } = await supabaseAdmin
        .from('publications')
        .select('id, name, slug')
        .eq('slug', 'accounting')
        .single()

      return NextResponse.json({
        success: true,
        total_ai_apps: allApps?.length || 0,
        ai_apps: allApps?.map(app => ({
          id: app.id,
          name: app.app_name,
          is_active: app.is_active,
          publication_id: app.publication_id
        })),
        newsletter: newsletter || null,
        issue_id: issueId,
        issue_selections: issueSelections?.length || 0,
        selected_apps: issueSelections?.map(s => ({
          app_id: s.app_id,
          selection_order: s.selection_order,
          app_name: s.app?.app_name
        })) || []
      })
    }
  },

  // ─── check-ai-prompts ───
  'check-ai-prompts': {
    GET: async ({ logger }) => {
      const { data: prompts, error } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .like('key', 'ai_prompt_%')

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        total_prompts: prompts?.length || 0,
        prompts: prompts?.map(p => ({
          key: p.key,
          has_value: !!p.value,
          value_length: p.value?.length || 0,
          has_title_placeholder: p.value?.includes('{{title}}'),
          has_description_placeholder: p.value?.includes('{{description}}'),
          preview: p.value?.substring(0, 200) + '...'
        }))
      })
    }
  },

  // ─── check-app-selections ───
  'check-app-selections': {
    GET: async ({ request, logger }) => {
      const { data: issues, error: issuesError } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, created_at, status')
        .order('created_at', { ascending: false })
        .limit(5)

      if (issuesError) {
        return NextResponse.json({ error: issuesError.message }, { status: 500 })
      }

      const results = await Promise.all(
        issues.map(async (issue) => {
          const { data: appSelections, error: appError } = await supabaseAdmin
            .from('issue_ai_app_selections')
            .select(`
              *,
              app:ai_applications(id, app_name, category)
            `)
            .eq('issue_id', issue.id)
            .order('selection_order', { ascending: true })

          const { data: promptSelection, error: promptError } = await supabaseAdmin
            .from('issue_prompt_selections')
            .select(`
              *,
              prompt:prompt_ideas(id, title, category)
            `)
            .eq('issue_id', issue.id)
            .single()

          return {
            issue_id: issue.id,
            issue_date: issue.date,
            issue_status: issue.status,
            created_at: issue.created_at,
            app_count: appSelections?.length || 0,
            apps: appSelections?.map(s => ({
              name: s.app?.app_name,
              category: s.app?.category,
              order: s.selection_order
            })) || [],
            prompt_selected: !!promptSelection,
            prompt: promptSelection ? {
              title: promptSelection.prompt?.title,
              category: promptSelection.prompt?.category
            } : null
          }
        })
      )

      return NextResponse.json({
        success: true,
        issues: results,
        summary: {
          total_issues: issues.length,
          campaigns_with_apps: results.filter(r => r.app_count > 0).length,
          campaigns_with_prompts: results.filter(r => r.prompt_selected).length,
          campaigns_without_apps: results.filter(r => r.app_count === 0).length,
          campaigns_without_prompts: results.filter(r => !r.prompt_selected).length
        }
      })
    }
  },

  // ─── check-article-failures ───
  'check-article-failures': {
    GET: async ({ request, logger }) => {
      const { searchParams } = new URL(request.url)
      const issueId = searchParams.get('issue_id')

      if (!issueId) {
        return NextResponse.json({ error: 'issueId required' }, { status: 400 })
      }

      const { data: ratedPosts } = await supabaseAdmin
        .from('rss_posts')
        .select(`
          id,
          title,
          post_ratings(total_score, interest_level, local_relevance, community_impact)
        `)
        .eq('issue_id', issueId)

      const { data: articles } = await supabaseAdmin
        .from('module_articles')
        .select('id, post_id, headline, is_active')
        .eq('issue_id', issueId)

      const articlePostIds = new Set(articles?.map(a => a.post_id) || [])

      const postsWithRatings = ratedPosts?.filter((p: any) => p.post_ratings && p.post_ratings.length > 0) || []
      const missingArticles = postsWithRatings.filter(p => !articlePostIds.has(p.id))

      const { data: duplicateGroups } = await supabaseAdmin
        .from('duplicate_groups')
        .select(`
          id,
          topic_signature,
          primary_post_id,
          duplicate_posts(post_id)
        `)
        .eq('issue_id', issueId)

      const duplicatePostIds = new Set()
      duplicateGroups?.forEach(g => {
        g.duplicate_posts?.forEach((dp: any) => {
          duplicatePostIds.add(dp.post_id)
        })
      })

      const { data: errorLogs } = await supabaseAdmin
        .from('system_logs')
        .select('created_at, level, message, metadata')
        .or(`message.ilike.%article%,message.ilike.%fact%,message.ilike.%newsletter%`)
        .order('created_at', { ascending: false })
        .limit(50)

      return NextResponse.json({
        success: true,
        issue_id: issueId,
        summary: {
          total_rated_posts: postsWithRatings.length,
          total_articles: articles?.length || 0,
          missing_articles: missingArticles.length,
          duplicate_groups: duplicateGroups?.length || 0,
          duplicate_posts_excluded: duplicatePostIds.size
        },
        posts_without_articles: missingArticles.map((p: any) => ({
          id: p.id,
          title: p.title.substring(0, 80),
          score: p.post_ratings?.[0]?.total_score || 0,
          interest: p.post_ratings?.[0]?.interest_level || 0,
          local: p.post_ratings?.[0]?.local_relevance || 0,
          impact: p.post_ratings?.[0]?.community_impact || 0,
          is_duplicate: duplicatePostIds.has(p.id)
        })),
        duplicate_groups: duplicateGroups?.map(g => ({
          topic: g.topic_signature,
          primary_post_id: g.primary_post_id,
          duplicate_count: g.duplicate_posts?.length || 0
        })),
        recent_errors: errorLogs?.slice(0, 10).map(log => ({
          time: log.created_at,
          level: log.level,
          message: log.message,
          metadata: log.metadata
        }))
      })
    }
  },

  // ─── check-campaign-ad ───
  'check-campaign-ad': {
    GET: async ({ request, logger }) => {
      const { searchParams } = new URL(request.url)
      const issueId = searchParams.get('issue_id')

      if (!issueId) {
        return NextResponse.json({
          error: 'issueId parameter required'
        }, { status: 400 })
      }

      const { data: issue, error: issueError } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, status, publication_id')
        .eq('id', issueId)
        .single()

      if (issueError || !issue) {
        return NextResponse.json({
          error: 'issue not found',
          details: issueError
        }, { status: 404 })
      }

      const { data: issueAds, error: adsError } = await supabaseAdmin
        .from('issue_advertisements')
        .select('*')
        .eq('issue_id', issueId)

      console.log(`[Check Ad] Found ${issueAds?.length || 0} issue_advertisements records`)

      const { data: issueAdsNested, error: nestedError } = await supabaseAdmin
        .from('issue_advertisements')
        .select('*, advertisement:advertisements(*)')
        .eq('issue_id', issueId)

      console.log(`[Check Ad] Nested query returned ${issueAdsNested?.length || 0} records`)

      const { data: fullissue, error: fullError } = await supabaseAdmin
        .from('publication_issues')
        .select(`
          id,
          date,
          status,
          issue_advertisements(
            *,
            advertisement:advertisements(*)
          )
        `)
        .eq('id', issueId)
        .single()

      return NextResponse.json({
        success: true,
        issue: {
          id: issue.id,
          date: issue.date,
          status: issue.status,
          publication_id: issue.publication_id
        },
        issue_advertisements_count: issueAds?.length || 0,
        issue_advertisements: issueAds,
        nested_query_error: nestedError?.message,
        nested_query_result: issueAdsNested,
        full_dashboard_query_error: fullError?.message,
        full_dashboard_query: fullissue?.issue_advertisements
      })
    },
    maxDuration: 60
  },

  // ─── check-campaign-data ───
  'check-campaign-data': {
    GET: async ({ request, logger }) => {
      const url = new URL(request.url)
      const issueId = url.searchParams.get('issue_id')

      if (!issueId) {
        return NextResponse.json({ error: 'issueId required' }, { status: 400 })
      }

      console.log('Fetching issue data for:', issueId)

      const { data: selections, error: selectionsError } = await supabaseAdmin
        .from('issue_ai_app_selections')
        .select('*')
        .eq('issue_id', issueId)

      console.log('Direct selections query:', selections?.length || 0, 'results')
      if (selectionsError) {
        console.error('Selections error:', selectionsError)
      }

      const { data: selectionsWithApps, error: joinError } = await supabaseAdmin
        .from('issue_ai_app_selections')
        .select('*, app:ai_applications(*)')
        .eq('issue_id', issueId)

      console.log('Selections with apps join:', selectionsWithApps?.length || 0, 'results')
      if (joinError) {
        console.error('Join error:', joinError)
      }

      const { data: issue, error: issueError } = await supabaseAdmin
        .from('publication_issues')
        .select(`
          *,
          articles:articles(
            *,
            rss_post:rss_posts(
              *,
              post_rating:post_ratings(*),
              rss_feed:rss_feeds(*)
            )
          ),
          secondary_articles:secondary_articles(
            *,
            rss_post:rss_posts(
              *,
              post_rating:post_ratings(*),
              rss_feed:rss_feeds(*)
            )
          ),
          manual_articles:manual_articles(*),
          email_metrics(*),
          issue_ai_app_selections(
            *,
            app:ai_applications(*)
          )
        `)
        .eq('id', issueId)
        .single()

      console.log('Full issue query:', {
        found: !!issue,
        ai_apps_count: issue?.issue_ai_app_selections?.length || 0
      })

      if (issueError) {
        console.error('issue error:', issueError)
      }

      return NextResponse.json({
        success: true,
        issue_id: issueId,
        test_results: {
          direct_selections: {
            count: selections?.length || 0,
            error: selectionsError?.message || null,
            data: selections
          },
          selections_with_apps: {
            count: selectionsWithApps?.length || 0,
            error: joinError?.message || null,
            data: selectionsWithApps
          },
          full_issue: {
            found: !!issue,
            ai_apps_count: issue?.issue_ai_app_selections?.length || 0,
            error: issueError?.message || null,
            ai_apps: issue?.issue_ai_app_selections
          }
        }
      })
    }
  },

  // ─── check-campaign-dates ───
  'check-campaign-dates': {
    GET: async ({ logger }) => {
      const { data: campaigns, error } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, created_at, status')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        throw error
      }

      return NextResponse.json({
        issues: campaigns?.map(c => ({
          id: c.id,
          date: c.date,
          created_at: c.created_at,
          status: c.status,
          dates_match: c.date === c.created_at?.split('T')[0]
        }))
      })
    }
  },

  // ─── check-campaign-ids ───
  'check-campaign-ids': {
    GET: async ({ request, logger }) => {
      const issueIds = [
        'bd08af8d-e2c1-40e3-bf94-bd4af912639e',
        'c8750496-9cf2-4f68-85fe-86dae32f226a'
      ]

      const { data: campaigns, error } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, status, created_at, subject_line')
        .in('id', issueIds)
        .order('created_at', { ascending: false })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const today = new Date().toISOString().split('T')[0]
      const { data: todaysCampaigns } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, status, created_at, subject_line')
        .gte('created_at', today + 'T00:00:00')
        .order('created_at', { ascending: false })

      return NextResponse.json({
        specificCampaigns: campaigns || [],
        foundCount: campaigns?.length || 0,
        allCampaignsCreatedToday: todaysCampaigns || [],
        todaysCampaignsCount: todaysCampaigns?.length || 0
      })
    }
  },

  // ─── check-campaign-relations ───
  'check-campaign-relations': {
    GET: async ({ request, logger }) => {
      const { searchParams } = new URL(request.url)
      const issueId = searchParams.get('issue_id')

      if (!issueId) {
        return NextResponse.json({
          error: 'issueId parameter required'
        }, { status: 400 })
      }

      console.log(`Checking relations for issue: ${issueId}`)

      const results: Record<string, any> = {}

      const tables = [
        'issue_events',
        'articles',
        'rss_posts',
        'road_work_data',
        'user_activities',
        'archived_articles',
        'archived_rss_posts'
      ]

      for (const table of tables) {
        try {
          const { data, error, count } = await supabaseAdmin
            .from(table)
            .select('*', { count: 'exact', head: false })
            .eq('issue_id', issueId)

          if (error) {
            results[table] = { error: error.message, code: error.code }
          } else {
            results[table] = {
              count: count || data?.length || 0,
              sample: data?.slice(0, 2) || []
            }
          }
        } catch (err) {
          results[table] = {
            error: err instanceof Error ? err.message : 'Unknown error',
            note: 'Table might not exist or column name different'
          }
        }
      }

      const { data: issue, error: issueError } = await supabaseAdmin
        .from('publication_issues')
        .select('*')
        .eq('id', issueId)
        .single()

      return NextResponse.json({
        success: true,
        issue_id: issueId,
        issue: issue || { error: issueError?.message },
        related_data: results,
        summary: {
          tables_with_data: Object.entries(results)
            .filter(([_, data]) => !data.error && data.count > 0)
            .map(([table, data]) => `${table}: ${data.count} records`)
        },
        timestamp: new Date().toISOString()
      })
    }
  },

  // ─── check-campaign-schedule ───
  'check-campaign-schedule': {
    GET: async ({ request, logger }) => {
      console.log('=== issue SCHEDULE DEBUG ===')

      const { data: activeNewsletter } = await supabaseAdmin
        .from('publications')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single()

      if (!activeNewsletter) {
        return NextResponse.json({
          success: false,
          error: 'No active newsletter found'
        }, { status: 404 })
      }

      const nowUTC = new Date()
      const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
      const centralDate = new Date(nowCentral)

      const tomorrow = new Date(centralDate)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowDate = tomorrow.toISOString().split('T')[0]

      const shouldRunReviewSend = await ScheduleChecker.shouldRunReviewSend(activeNewsletter.id)

      const { data: settings } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .or('key.eq.email_scheduledSendTime,key.eq.email_issueCreationTime,key.eq.email_reviewScheduleEnabled')

      const emailSettings: Record<string, string> = {}
      settings?.forEach(s => {
        emailSettings[s.key.replace('email_', '')] = s.value
      })

      const { data: issue, error: issueError } = await supabaseAdmin
        .from('publication_issues')
        .select(`
          id,
          date,
          status,
          subject_line,
          review_sent_at,
          articles:articles(id, is_active)
        `)
        .eq('date', tomorrowDate)
        .single()

      const activeArticles = issue?.articles?.filter((a: any) => a.is_active) || []

      return NextResponse.json({
        success: true,
        currentTime: {
          utc: nowUTC.toISOString(),
          central: nowCentral,
          centralHour: centralDate.getHours(),
          centralMinute: centralDate.getMinutes()
        },
        tomorrowDate,
        scheduleChecks: {
          shouldRunReviewSend
        },
        emailSettings,
        issue: issue ? {
          id: issue.id,
          date: issue.date,
          status: issue.status,
          hasSubjectLine: !!issue.subject_line,
          subjectLine: issue.subject_line,
          reviewSentAt: issue.review_sent_at,
          totalArticles: issue.articles?.length || 0,
          activeArticles: activeArticles.length,
          readyForReview: issue.status === 'draft' && !!issue.subject_line && activeArticles.length > 0
        } : null,
        issueError: issueError?.message
      })
    }
  },

  // ─── check-dates ───
  'check-dates': {
    GET: async ({ request, logger }) => {
      const ctParts1 = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Chicago',
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date())
      const [ctYear1, ctMonth1, ctDay1] = ctParts1.split('-').map(Number)
      const tomorrowDate1 = new Date(ctYear1, ctMonth1 - 1, ctDay1 + 1)
      const rssProcessingDate = `${tomorrowDate1.getFullYear()}-${String(tomorrowDate1.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate1.getDate()).padStart(2, '0')}`

      const ctParts2 = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Chicago',
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date())
      const [ctYear2, ctMonth2, ctDay2] = ctParts2.split('-').map(Number)
      const tomorrowDate2 = new Date(ctYear2, ctMonth2 - 1, ctDay2 + 1)
      const createissueDate = `${tomorrowDate2.getFullYear()}-${String(tomorrowDate2.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate2.getDate()).padStart(2, '0')}`

      const { data: rssissue } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, status, created_at, subject_line')
        .eq('date', rssProcessingDate)
        .single()

      const { data: createissue } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, status, created_at, subject_line')
        .eq('date', createissueDate)
        .single()

      const { data: allCampaigns, error } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, status, created_at, subject_line')
        .order('date', { ascending: false })
        .limit(10)

      const datesMismatch = rssProcessingDate !== createissueDate

      return NextResponse.json({
        debug: 'Date Calculation Comparison',
        currentTime: {
          utc: new Date().toISOString(),
          central: ctParts1,
        },
        rssProcessing: {
          description: "RSS Processing creates issue for tomorrow in Central Time",
          calculation: "Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }) + 1 day",
          issueDate: rssProcessingDate,
          foundissue: rssissue ? {
            id: rssissue.id,
            date: rssissue.date,
            status: rssissue.status,
            created_at: rssissue.created_at
          } : null
        },
        createissue: {
          description: "Create issue targets tomorrow in Central Time",
          calculation: "Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }) + 1 day",
          issueDate: createissueDate,
          foundissue: createissue ? {
            id: createissue.id,
            date: createissue.date,
            status: createissue.status,
            created_at: createissue.created_at
          } : null
        },
        analysis: {
          datesMismatch,
          diagnosis: datesMismatch
            ? "DATES DON'T MATCH - RSS Processing creates for " + rssProcessingDate + " but Create issue looks for " + createissueDate
            : "Dates match - both endpoints target tomorrow in CT: " + rssProcessingDate,
          explanation: "All endpoints use tomorrow in Central Time, matching send-review logic. This ensures consistent issue dates regardless of time of day.",
          possibleCause: datesMismatch
            ? "If Create issue doesn't find a issue, it would return 404. No duplicate should be created."
            : "Both endpoints should work with the same issue."
        },
        allCampaigns: allCampaigns || [],
        timestamp: new Date().toISOString()
      })
    }
  },

  // ─── check-deduplication ───
  'check-deduplication': {
    GET: async ({ request }) => {
      const { searchParams } = new URL(request.url)
      let issueId = searchParams.get('issue_id')

      if (!issueId) {
        const { data: recentissue } = await supabaseAdmin
          .from('publication_issues')
          .select('id, date, status')
          .order('date', { ascending: false })
          .limit(1)
          .single()

        if (!recentissue) {
          return NextResponse.json({ error: 'No issues found' }, { status: 404 })
        }

        issueId = recentissue.id
      }

      const { data: issue } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, status, subject_line')
        .eq('id', issueId)
        .single()

      if (!issue) {
        return NextResponse.json({ error: 'issue not found' }, { status: 404 })
      }

      const { data: duplicateGroups } = await supabaseAdmin
        .from('duplicate_groups')
        .select(`
          id,
          topic_signature,
          primary_post_id,
          primary_post:rss_posts!duplicate_groups_primary_post_id_fkey(
            id,
            title,
            description
          )
        `)
        .eq('issue_id', issueId)

      const groupIds = duplicateGroups?.map(g => g.id) || []
      const { data: duplicatePosts } = await supabaseAdmin
        .from('duplicate_posts')
        .select(`
          id,
          post_id,
          group_id,
          detection_method,
          similarity_score,
          post:rss_posts(
            id,
            title,
            description
          )
        `)
        .in('group_id', groupIds)

      const duplicatePostIds = duplicatePosts?.map(dp => dp.post_id) || []
      const { data: articlesFromDuplicates } = await supabaseAdmin
        .from('module_articles')
        .select('id, headline, post_id, article_module_id')
        .eq('issue_id', issueId)
        .in('post_id', duplicatePostIds)

      const { data: allArticles } = await supabaseAdmin
        .from('module_articles')
        .select('id, headline, post_id, is_active, article_module_id')
        .eq('issue_id', issueId)

      const groupsFormatted = duplicateGroups?.map(group => ({
        topic: group.topic_signature,
        primary_post: {
          id: group.primary_post_id,
          title: (group.primary_post as any)?.title || 'Unknown',
          description: (group.primary_post as any)?.description?.substring(0, 100) || 'No description'
        },
        duplicates: duplicatePosts
          ?.filter(dp => dp.group_id === group.id)
          .map(dp => ({
            id: dp.post_id,
            title: (dp.post as any)?.title || 'Unknown',
            description: (dp.post as any)?.description?.substring(0, 100) || 'No description',
            detection_method: dp.detection_method,
            similarity_score: dp.similarity_score
          })) || []
      })) || []

      return NextResponse.json({
        issue: {
          id: issue.id,
          date: issue.date,
          status: issue.status,
          subject_line: issue.subject_line
        },
        deduplication_summary: {
          total_duplicate_groups: duplicateGroups?.length || 0,
          total_duplicate_posts: duplicatePosts?.length || 0,
          posts_filtered_correctly: duplicatePostIds.length - (articlesFromDuplicates?.length || 0),
          duplicate_posts_that_made_it_to_articles: articlesFromDuplicates?.length || 0,
        },
        articles_count: {
          total_articles: allArticles?.length || 0,
          active_articles: allArticles?.filter(a => a.is_active).length || 0
        },
        duplicate_groups: groupsFormatted,
        warning_duplicates_in_articles: [
          ...(articlesFromDuplicates?.map(a => ({
            article_id: a.id,
            headline: a.headline,
            post_id: a.post_id,
            article_module_id: a.article_module_id
          })) || [])
        ]
      })
    }
  },

  // ─── check-email-schedule-settings ───
  'check-email-schedule-settings': {
    GET: async () => {
      const { data: settings, error } = await supabaseAdmin
        .from('app_settings')
        .select('key, value, updated_at')
        .like('key', 'email_%')
        .order('key')

      if (error) {
        throw error
      }

      return NextResponse.json({
        message: 'Email schedule settings from database',
        count: settings?.length || 0,
        settings: settings || [],
        schedule_settings: settings?.filter(s =>
          s.key.includes('Time') || s.key.includes('Enabled')
        ) || []
      })
    }
  },

  // ─── check-email-settings ───
  'check-email-settings': {
    GET: async () => {
      console.log('=== EMAIL SETTINGS DEBUG ===')

      const { data: settings, error } = await supabaseAdmin
        .from('app_settings')
        .select('*')
        .like('key', 'email_%')
        .order('key')

      if (error) {
        console.error('Database error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      console.log('Database settings:', settings)

      return NextResponse.json({
        success: true,
        count: settings?.length || 0,
        settings: settings || [],
        formatted: settings?.map(s => ({
          key: s.key.replace('email_', ''),
          value: s.value,
          isEmpty: s.value === '' || s.value === null,
          updated: s.updated_at
        }))
      }, { status: 200 })
    }
  },

  // ─── check-env-vars ───
  'check-env-vars': {
    GET: async () => {
      const envVars = {
        GOOGLE_CLOUD_TYPE: !!process.env.GOOGLE_CLOUD_TYPE,
        GOOGLE_CLOUD_PROJECT_ID: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
        GOOGLE_CLOUD_PRIVATE_KEY_ID: !!process.env.GOOGLE_CLOUD_PRIVATE_KEY_ID,
        GOOGLE_CLOUD_PRIVATE_KEY: !!process.env.GOOGLE_CLOUD_PRIVATE_KEY && process.env.GOOGLE_CLOUD_PRIVATE_KEY.length > 0,
        GOOGLE_CLOUD_CLIENT_EMAIL: !!process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        GOOGLE_CLOUD_CLIENT_ID: !!process.env.GOOGLE_CLOUD_CLIENT_ID,
        GOOGLE_CLOUD_CREDENTIALS_JSON: !!process.env.GOOGLE_CLOUD_CREDENTIALS_JSON
      }

      const values = {
        GOOGLE_CLOUD_TYPE: process.env.GOOGLE_CLOUD_TYPE,
        GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID,
        GOOGLE_CLOUD_PRIVATE_KEY_ID: process.env.GOOGLE_CLOUD_PRIVATE_KEY_ID,
        GOOGLE_CLOUD_PRIVATE_KEY: process.env.GOOGLE_CLOUD_PRIVATE_KEY ? `${process.env.GOOGLE_CLOUD_PRIVATE_KEY.substring(0, 50)}...` : 'missing',
        GOOGLE_CLOUD_CLIENT_EMAIL: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        GOOGLE_CLOUD_CLIENT_ID: process.env.GOOGLE_CLOUD_CLIENT_ID,
        GOOGLE_CLOUD_CREDENTIALS_JSON_LENGTH: process.env.GOOGLE_CLOUD_CREDENTIALS_JSON?.length || 0
      }

      const hasIndividualVars = !!(process.env.GOOGLE_CLOUD_TYPE && process.env.GOOGLE_CLOUD_PRIVATE_KEY)
      const hasJsonCredentials = !!process.env.GOOGLE_CLOUD_CREDENTIALS_JSON

      return NextResponse.json({
        success: true,
        hasIndividualVars,
        hasJsonCredentials,
        envVarsPresent: envVars,
        values: values,
        message: hasIndividualVars ? 'Individual variables detected' : 'No individual variables, falling back to JSON'
      })
    }
  },

  // ─── check-fact-checker-prompt ───
  'check-fact-checker-prompt': {
    GET: async () => {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('key, value, description')
        .eq('key', 'ai_prompt_fact_checker')
        .single()

      if (error) {
        return NextResponse.json({
          success: false,
          error: 'Prompt not found in database',
          details: error.message,
          fallback_used: true
        })
      }

      if (!data) {
        return NextResponse.json({
          success: false,
          message: 'No fact checker prompt in database',
          fallback_used: true
        })
      }

      const hasNewsletterPlaceholder = data.value.includes('{{newsletterContent}}')
      const hasOriginalPlaceholder = data.value.includes('{{originalContent}}')

      const sampleNewsletter = 'TEST NEWSLETTER CONTENT: This is a sample article about local news.'
      const sampleOriginal = 'TEST ORIGINAL CONTENT: This is the original source material for the article.'

      const processedPrompt = data.value
        .replace(/\{\{newsletterContent\}\}/g, sampleNewsletter)
        .replace(/\{\{originalContent\}\}/g, sampleOriginal.substring(0, 2000))

      return NextResponse.json({
        success: true,
        prompt_info: {
          key: data.key,
          description: data.description,
          length: data.value?.length || 0,
          has_newsletter_placeholder: hasNewsletterPlaceholder,
          has_original_placeholder: hasOriginalPlaceholder,
          preview: data.value.substring(0, 500) + '...',
          full_prompt: data.value,
          sample_processed_preview: processedPrompt.substring(0, 800) + '...'
        }
      })
    }
  },

  // ─── check-feed-names ───
  'check-feed-names': {
    GET: async () => {
      const { data: feeds, error: feedsError } = await supabaseAdmin
        .from('rss_feeds')
        .select('id, name, active, url')
        .order('name')

      if (feedsError) {
        console.error('Feeds query error:', feedsError)
        throw feedsError
      }

      return NextResponse.json({
        success: true,
        feeds: feeds || [],
        message: `Found ${feeds?.length || 0} RSS feeds`
      })
    }
  },

  // ─── check-feed-sections ───
  'check-feed-sections': {
    GET: async () => {
      const { data: feeds, error } = await supabaseAdmin
        .from('rss_feeds')
        .select('id, name, url, active, use_for_primary_section, use_for_secondary_section')
        .order('name')

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const primaryFeeds = feeds?.filter(f => f.use_for_primary_section) || []
      const secondaryFeeds = feeds?.filter(f => f.use_for_secondary_section) || []

      return NextResponse.json({
        success: true,
        total_feeds: feeds?.length || 0,
        primary_feeds: primaryFeeds.length,
        secondary_feeds: secondaryFeeds.length,
        feeds: feeds,
        primary_feed_list: primaryFeeds.map(f => ({ id: f.id, name: f.name })),
        secondary_feed_list: secondaryFeeds.map(f => ({ id: f.id, name: f.name }))
      })
    }
  },

  // ─── check-historical-dedup ───
  'check-historical-dedup': {
    GET: async ({ request }) => {
      const { searchParams } = new URL(request.url)
      const issueId1 = searchParams.get('issue1') || 'd8679cfd-c2a2-42c0-aa1a-ca6a612ba0af'
      const issueId2 = searchParams.get('issue2') || 'f546382b-54e6-4d3f-8edf-79bc20541b85'

      const results: any = {
        step1_issue_details: {},
        step2_lookback_calculation: {},
        step3_historical_campaigns: {},
        step4_historical_articles: {},
        step5_historical_posts: {},
        step6_new_issue_posts: {},
        step7_hash_comparison: [],
        step8_dedup_records_check: {}
      }

      console.log('============ HISTORICAL DEDUP TRACE ============')
      console.log(`Issue 1: ${issueId1}`)
      console.log(`Issue 2: ${issueId2}`)

      const { data: issues } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, status, created_at')
        .in('id', [issueId1, issueId2])
        .order('date')

      results.step1_issue_details = issues

      if (!issues || issues.length < 2) {
        return NextResponse.json({ error: 'Issues not found', results }, { status: 404 })
      }

      const earlierIssue = issues[0]
      const laterIssue = issues[1]

      const historicalLookbackDays = 3
      const laterIssueDate = new Date(laterIssue.date)
      const cutoffDate = new Date(laterIssueDate)
      cutoffDate.setDate(cutoffDate.getDate() - historicalLookbackDays)
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

      results.step2_lookback_calculation = {
        laterIssueDate: laterIssue.date,
        lookbackDays: historicalLookbackDays,
        cutoffDate: cutoffDateStr,
        earlierIssueDate: earlierIssue.date,
        earlierIssueWithinLookback: earlierIssue.date >= cutoffDateStr
      }

      const { data: recentCampaigns } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, status')
        .eq('status', 'sent')
        .gte('date', cutoffDateStr)
        .neq('id', laterIssue.id)

      results.step3_historical_campaigns = {
        count: recentCampaigns?.length || 0,
        campaigns: recentCampaigns,
        includesEarlierIssue: recentCampaigns?.some(c => c.id === earlierIssue.id)
      }

      if (!recentCampaigns || recentCampaigns.length === 0) {
        results.step3_historical_campaigns.note = 'No sent campaigns found in lookback period - this is why dedup did not catch it!'
        return NextResponse.json(results, { status: 200 })
      }

      const campaignIds = recentCampaigns.map(c => c.id)

      const { data: historicalArticles } = await supabaseAdmin
        .from('module_articles')
        .select('id, post_id, headline, issue_id, is_active, skipped')
        .in('issue_id', campaignIds)
        .eq('is_active', true)
        .eq('skipped', false)

      results.step4_historical_articles = {
        count: historicalArticles?.length || 0,
        articlesByIssue: {} as Record<string, any[]>
      }

      if (historicalArticles) {
        for (const article of historicalArticles) {
          if (!results.step4_historical_articles.articlesByIssue[article.issue_id]) {
            results.step4_historical_articles.articlesByIssue[article.issue_id] = []
          }
          results.step4_historical_articles.articlesByIssue[article.issue_id].push({
            id: article.id,
            post_id: article.post_id,
            headline: article.headline
          })
        }
      }

      const historicalPostIds = historicalArticles?.map(a => a.post_id).filter(Boolean) || []

      const { data: historicalPosts } = await supabaseAdmin
        .from('rss_posts')
        .select('id, title, content, full_article_text, feed_id')
        .in('id', historicalPostIds)

      const historicalHashes = new Map<string, any>()

      results.step5_historical_posts = {
        count: historicalPosts?.length || 0,
        hashes: [] as any[]
      }

      for (const post of historicalPosts || []) {
        const hash = createContentHash(post)
        historicalHashes.set(hash, {
          post_id: post.id,
          title: post.title,
          feed_id: post.feed_id
        })
        results.step5_historical_posts.hashes.push({
          hash: hash,
          post_id: post.id,
          title: post.title,
          feed_id: post.feed_id
        })
      }

      const { data: newIssuePosts } = await supabaseAdmin
        .from('rss_posts')
        .select('id, title, content, full_article_text, feed_id, issue_id')
        .eq('issue_id', laterIssue.id)

      results.step6_new_issue_posts = {
        count: newIssuePosts?.length || 0,
        posts: newIssuePosts?.map(p => ({
          id: p.id,
          title: p.title,
          feed_id: p.feed_id
        }))
      }

      for (const post of newIssuePosts || []) {
        const postHash = createContentHash(post)
        const match = historicalHashes.get(postHash)

        results.step7_hash_comparison.push({
          new_post: {
            id: post.id,
            title: post.title,
            feed_id: post.feed_id,
            hash: postHash
          },
          matched: !!match,
          historical_match: match || null
        })
      }

      const matchCount = results.step7_hash_comparison.filter((c: any) => c.matched).length

      const { data: dupGroups } = await supabaseAdmin
        .from('duplicate_groups')
        .select('id, topic_signature, primary_post_id')
        .eq('issue_id', laterIssue.id)

      const { data: dupPosts } = await supabaseAdmin
        .from('duplicate_posts')
        .select('id, post_id, detection_method, group_id')
        .in('group_id', dupGroups?.map(g => g.id) || [])

      results.step8_dedup_records_check = {
        groups_found: dupGroups?.length || 0,
        duplicate_posts_found: dupPosts?.length || 0,
        groups: dupGroups,
        duplicate_posts: dupPosts
      }

      results.summary = {
        earlierIssueStatus: earlierIssue.status,
        earlierIssueDate: earlierIssue.date,
        laterIssueDate: laterIssue.date,
        lookbackCutoffDate: cutoffDateStr,
        earlierIssueInLookback: earlierIssue.date >= cutoffDateStr,
        earlierIssueInQuery: recentCampaigns?.some(c => c.id === earlierIssue.id),
        historicalCampaignsFound: recentCampaigns?.length || 0,
        historicalPostsFound: historicalPosts?.length || 0,
        newPostsChecked: newIssuePosts?.length || 0,
        hashMatchesFound: matchCount,
        dedupGroupsRecorded: dupGroups?.length || 0,
        conclusion: matchCount > 0
          ? `Found ${matchCount} hash match(es) - dedup SHOULD have caught these`
          : earlierIssue.status !== 'sent'
            ? `Earlier issue status is '${earlierIssue.status}' not 'sent' - NOT included in historical check`
            : `No hash matches found - posts have different content or feeds`
      }

      console.log('============ SUMMARY ============')
      console.log(JSON.stringify(results.summary, null, 2))

      return NextResponse.json(results, { status: 200 })
    },
    maxDuration: 60
  },

  // ─── check-last-run (GET + POST) ───
  'check-last-run': {
    GET: async ({ request, logger }) => {
      const { data: lastRunSettings } = await supabaseAdmin
        .from('app_settings')
        .select('key, value, updated_at')
        .or('key.eq.last_rss_processing_run,key.eq.last_issue_creation_run,key.eq.last_review_send_run,key.eq.last_final_send_run,key.eq.last_event_population_run')
        .order('key')

      const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
      const centralDate = new Date(nowCentral)
      const today = centralDate.toISOString().split('T')[0]

      return NextResponse.json({
        success: true,
        today,
        currentCentralTime: nowCentral,
        lastRunSettings: lastRunSettings || [],
        analysis: lastRunSettings?.map(s => ({
          task: s.key.replace('last_', '').replace('_run', ''),
          lastRunDate: s.value,
          isToday: s.value === today,
          willRunToday: s.value !== today,
          updatedAt: s.updated_at
        }))
      })
    },
    POST: async ({ request, logger }) => {
      const body = await request.json()
      const { resetKey } = body

      if (!resetKey) {
        return NextResponse.json({
          error: 'resetKey is required (e.g., "last_review_send_run")'
        }, { status: 400 })
      }

      const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
      const centralDate = new Date(nowCentral)
      const yesterday = new Date(centralDate)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayDate = yesterday.toISOString().split('T')[0]

      const { error } = await supabaseAdmin
        .from('app_settings')
        .upsert({
          key: resetKey,
          value: yesterdayDate,
          description: `Last run date for ${resetKey} (manually reset)`,
          updated_at: new Date().toISOString()
        })

      if (error) {
        return NextResponse.json({
          error: error.message
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Reset ${resetKey} to ${yesterdayDate}`,
        resetKey,
        newValue: yesterdayDate
      })
    }
  },

  // ─── check-last-runs ───
  'check-last-runs': {
    GET: async ({ request, logger }) => {
      const { data: lastRuns } = await supabaseAdmin
        .from('app_settings')
        .select('key, value, updated_at')
        .in('key', [
          'last_rss_processing_run',
          'last_issue_creation_run',
          'last_final_send_run',
          'last_subject_generation_run'
        ])
        .order('key')

      const { data: recentCampaigns } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, created_at, status')
        .order('created_at', { ascending: false })
        .limit(5)

      return NextResponse.json({
        success: true,
        lastRuns,
        recentCampaigns,
        currentDate: new Date().toISOString().split('T')[0],
        currentTime: new Date().toISOString()
      })
    }
  },

  // ─── check-latest-campaign ───
  'check-latest-campaign': {
    GET: async ({ logger }) => {
      const { data: issue, error: issueError } = await supabaseAdmin
        .from('publication_issues')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (issueError || !issue) {
        return NextResponse.json({ error: 'No issue found' }, { status: 404 })
      }

      const { data: aiApps, error: appsError } = await supabaseAdmin
        .from('issue_ai_app_selections')
        .select('*, app:ai_applications(*)')
        .eq('issue_id', issue.id)

      const { data: prompts, error: promptsError } = await supabaseAdmin
        .from('issue_prompt_selections')
        .select('*, prompt:prompt_ideas(*)')
        .eq('issue_id', issue.id)

      const { data: metrics, error: metricsError } = await supabaseAdmin
        .from('email_metrics')
        .select('*')
        .eq('issue_id', issue.id)

      const { data: logs, error: logsError } = await supabaseAdmin
        .from('system_logs')
        .select('*')
        .eq('context->>issueId', issue.id)
        .order('timestamp', { ascending: false })
        .limit(20)

      return NextResponse.json({
        success: true,
        issue: {
          id: issue.id,
          date: issue.date,
          status: issue.status,
          subject_line: issue.subject_line,
          review_sent_at: issue.review_sent_at,
          created_at: issue.created_at
        },
        ai_apps: {
          count: aiApps?.length || 0,
          error: appsError?.message || null,
          apps: aiApps?.map(s => ({
            app_name: s.app?.app_name,
            selection_order: s.selection_order
          })) || []
        },
        prompts: {
          count: prompts?.length || 0,
          error: promptsError?.message || null,
          prompts: prompts?.map(p => ({
            title: p.prompt?.title,
            selection_order: p.selection_order
          })) || []
        },
        email_metrics: {
          found: !!metrics,
          mailerlite_issue_id: metrics?.[0]?.mailerlite_issue_id || null,
          error: metricsError?.message || null
        },
        recent_logs: logs || []
      })
    }
  },

  // ─── check-latest-rss-run ───
  'check-latest-rss-run': {
    GET: async ({ logger }) => {
      const { data: recentCampaigns } = await supabaseAdmin
        .from('publication_issues')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3)

      if (!recentCampaigns || recentCampaigns.length === 0) {
        return NextResponse.json({ error: 'No issues found' })
      }

      const latestissue = recentCampaigns[0]

      const { data: articles, count: articleCount } = await supabaseAdmin
        .from('module_articles')
        .select('id, post_id, headline, content, is_active, rank, skipped, article_module_id, created_at', { count: 'exact' })
        .eq('issue_id', latestissue.id)

      const { data: rssPosts, count: rssPostCount } = await supabaseAdmin
        .from('rss_posts')
        .select('*', { count: 'exact' })
        .eq('issue_id', latestissue.id)

      const { data: promptSelection } = await supabaseAdmin
        .from('issue_prompt_selections')
        .select('*, prompt:prompt_ideas(*)')
        .eq('issue_id', latestissue.id)
        .single()

      const { data: appSelections, count: appCount } = await supabaseAdmin
        .from('issue_ai_app_selections')
        .select('*, app:ai_applications(*)', { count: 'exact' })
        .eq('issue_id', latestissue.id)

      const { data: logs } = await supabaseAdmin
        .from('system_logs')
        .select('*')
        .or(`context->>issueId.eq.${latestissue.id},message.ilike.%${latestissue.id}%`)
        .order('created_at', { ascending: false })
        .limit(20)

      return NextResponse.json({
        latestissue: {
          id: latestissue.id,
          date: latestissue.date,
          status: latestissue.status,
          subject_line: latestissue.subject_line,
          created_at: latestissue.created_at,
          updated_at: latestissue.updated_at
        },
        articleCount: articleCount || 0,
        rssPostCount: rssPostCount || 0,
        appCount: appCount || 0,
        hasPrompt: !!promptSelection,
        promptTitle: promptSelection?.prompt?.title,
        recentCampaigns: recentCampaigns.map(c => ({
          id: c.id,
          date: c.date,
          status: c.status,
          created_at: c.created_at
        })),
        sampleArticles: articles?.slice(0, 3).map(a => ({
          id: a.id,
          headline: a.headline,
          is_active: a.is_active,
          rank: a.rank
        })),
        sampleRssPosts: rssPosts?.slice(0, 3).map(p => ({
          id: p.id,
          title: p.title,
          source_feed: p.source_feed
        })),
        logs: logs?.map(l => ({
          level: l.level,
          message: l.message,
          created_at: l.created_at,
          context: l.context
        }))
      })
    }
  },

  // ─── check-logs ───
  'check-logs': {
    GET: async ({ request, logger }) => {
      const { searchParams } = new URL(request.url)
      const issueId = searchParams.get('issue_id')
      const limit = parseInt(searchParams.get('limit') || '50')

      let query = supabaseAdmin
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (issueId) {
        query = query.eq('context->>issueId', issueId)
      }

      const { data: logs, error } = await query

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        total_logs: logs?.length || 0,
        logs: logs?.map(log => ({
          level: log.level,
          message: log.message,
          context: log.context,
          source: log.source,
          created_at: log.created_at
        })) || []
      })
    }
  },

  // ─── check-low-article-alerts ───
  'check-low-article-alerts': {
    GET: async ({ logger }) => {
      const tenDaysAgo = new Date()
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)

      const { data: campaigns, error: issuesError } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, status, created_at')
        .gte('created_at', tenDaysAgo.toISOString())
        .order('created_at', { ascending: false })

      if (issuesError) throw issuesError

      const campaignsWithCounts = await Promise.all(
        (campaigns || []).map(async (issue) => {
          const { data: articles, error: articlesError } = await supabaseAdmin
            .from('module_articles')
            .select('id, is_active')
            .eq('issue_id', issue.id)

          const activeCount = articles?.filter(a => a.is_active).length || 0
          const totalCount = articles?.length || 0

          const { data: lowCountLogs } = await supabaseAdmin
            .from('system_logs')
            .select('created_at, message, context')
            .eq('source', 'slack_service')
            .ilike('message', '%Low Article Count%')
            .eq('context->>issueId', issue.id)
            .order('created_at', { ascending: false })
            .limit(1)

          const { data: rssLogs } = await supabaseAdmin
            .from('system_logs')
            .select('created_at, message, context')
            .eq('source', 'slack_service')
            .ilike('message', '%RSS Processing%')
            .or(`context->>issueId.eq.${issue.id}`)
            .order('created_at', { ascending: false })
            .limit(5)

          return {
            issue_id: issue.id,
            date: issue.date,
            status: issue.status,
            created_at: issue.created_at,
            active_articles: activeCount,
            total_articles: totalCount,
            low_count_alert_sent: lowCountLogs && lowCountLogs.length > 0,
            low_count_alert_time: lowCountLogs?.[0]?.created_at || null,
            rss_logs_found: rssLogs?.length || 0,
            should_have_triggered_alert: activeCount <= 6 && activeCount > 0
          }
        })
      )

      const missedAlerts = campaignsWithCounts.filter(c =>
        c.should_have_triggered_alert && !c.low_count_alert_sent
      )

      const { data: notificationSetting } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .eq('key', 'slack_low_article_count_enabled')
        .single()

      const { data: rssProcessingSetting } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .eq('key', 'slack_rss_processing_updates_enabled')
        .single()

      return NextResponse.json({
        success: true,
        summary: {
          total_issues: campaigns?.length || 0,
          campaigns_with_low_article_count: campaignsWithCounts.filter(c => c.active_articles <= 6).length,
          alerts_sent: campaignsWithCounts.filter(c => c.low_count_alert_sent).length,
          missed_alerts: missedAlerts.length
        },
        notification_settings: {
          low_article_count_enabled: notificationSetting?.value === 'true' || !notificationSetting,
          rss_processing_updates_enabled: rssProcessingSetting?.value === 'true' || !rssProcessingSetting,
          low_article_count_setting_exists: !!notificationSetting,
          rss_processing_setting_exists: !!rssProcessingSetting
        },
        issues: campaignsWithCounts,
        missed_alerts: missedAlerts
      })
    }
  },

  // ─── check-mailerlite-config ───
  'check-mailerlite-config': {
    GET: async ({ request, logger }) => {
      const { data: settings } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .or('key.eq.email_reviewGroupId,key.eq.email_mainGroupId,key.eq.email_fromEmail,key.eq.email_senderName')

      const config: Record<string, string> = {}
      settings?.forEach(s => {
        config[s.key.replace('email_', '')] = s.value
      })

      const hasApiKey = !!process.env.MAILERLITE_API_KEY
      const apiKeyLength = process.env.MAILERLITE_API_KEY?.length || 0

      return NextResponse.json({
        success: true,
        databaseSettings: config,
        environment: {
          hasApiKey,
          apiKeyLength,
          envReviewGroupId: process.env.MAILERLITE_REVIEW_GROUP_ID || 'not set',
          envMainGroupId: process.env.MAILERLITE_MAIN_GROUP_ID || 'not set'
        },
        validation: {
          reviewGroupIdValid: config.reviewGroupId && config.reviewGroupId.length > 0,
          mainGroupIdValid: config.mainGroupId && config.mainGroupId.length > 0,
          fromEmailValid: config.fromEmail && config.fromEmail.length > 0,
          senderNameValid: config.senderName && config.senderName.length > 0
        }
      })
    }
  },

  // ─── check-newsletters ───
  'check-newsletters': {
    GET: async ({ request, logger }) => {
      const { data: newsletters, error } = await supabaseAdmin
        .from('publications')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        count: newsletters?.length || 0,
        newsletters: newsletters || []
      })
    }
  },

  // ─── check-openai-posts ───
  'check-openai-posts': {
    GET: async ({ request, logger }) => {
      const { searchParams } = new URL(request.url)
      const issueId = searchParams.get('issue_id')

      if (!issueId) {
        return NextResponse.json({ error: 'issueId required' }, { status: 400 })
      }

      const { data: posts, error } = await supabaseAdmin
        .from('rss_posts')
        .select('id, title, description, full_article_text, source_url')
        .eq('issue_id', issueId)
        .ilike('title', '%OpenAI%')
        .order('title')

      if (error) {
        throw error
      }

      if (!posts || posts.length === 0) {
        return NextResponse.json({
          status: 'success',
          message: 'No OpenAI posts found in this issue',
          issue_id: issueId
        })
      }

      const analysis = posts.map(post => ({
        title: post.title,
        has_full_text: !!post.full_article_text,
        full_text_length: post.full_article_text?.length || 0,
        description_length: post.description?.length || 0,
        source_url: post.source_url,
        full_text_preview: post.full_article_text
          ? post.full_article_text.substring(0, 200) + '...'
          : 'NO FULL TEXT'
      }))

      const withFullText = analysis.filter(a => a.has_full_text).length
      const withoutFullText = analysis.length - withFullText

      return NextResponse.json({
        status: 'success',
        issue_id: issueId,
        total_openai_posts: posts.length,
        with_full_text: withFullText,
        without_full_text: withoutFullText,
        success_rate: `${Math.round((withFullText / posts.length) * 100)}%`,
        posts: analysis
      })
    },
    maxDuration: 600
  },

  // ─── check-pending-submissions ───
  'check-pending-submissions': {
    GET: async ({ request, logger }) => {
      const { data: allSubmissions, error: allError } = await supabaseAdmin
        .from('pending_event_submissions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      const { data: processed, error: processedError } = await supabaseAdmin
        .from('pending_event_submissions')
        .select('*')
        .eq('processed', true)
        .order('processed_at', { ascending: false })
        .limit(10)

      const { data: paidEvents, error: eventsError } = await supabaseAdmin
        .from('events')
        .select('id, title, payment_status, payment_intent_id, submitter_email, created_at')
        .not('payment_intent_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10)

      return NextResponse.json({
        pending_submissions: {
          count: allSubmissions?.length || 0,
          data: allSubmissions,
          error: allError?.message || null
        },
        processed_submissions: {
          count: processed?.length || 0,
          data: processed,
          error: processedError?.message || null
        },
        paid_events: {
          count: paidEvents?.length || 0,
          data: paidEvents,
          error: eventsError?.message || null
        }
      })
    }
  },

  // ─── check-posts ───
  'check-posts': {
    GET: async ({ request, logger }) => {
      const { searchParams } = new URL(request.url)
      const issueId = searchParams.get('issue_id')

      if (!issueId) {
        return NextResponse.json({ error: 'issueId required' }, { status: 400 })
      }

      const { data: posts, error: postsError } = await supabaseAdmin
        .from('rss_posts')
        .select(`
          id,
          title,
          description,
          issueId,
          post_rating:post_ratings(
            interest_level,
            local_relevance,
            community_impact,
            total_score,
            ai_reasoning
          )
        `)
        .eq('issue_id', issueId)
        .order('processed_at', { ascending: false })

      if (postsError) {
        return NextResponse.json({ error: postsError.message }, { status: 500 })
      }

      const { data: articles, error: articlesError } = await supabaseAdmin
        .from('module_articles')
        .select('id, headline, is_active, post_id')
        .eq('issue_id', issueId)

      if (articlesError) {
        return NextResponse.json({ error: articlesError.message }, { status: 500 })
      }

      const postsWithRatings = posts?.filter(p => p.post_rating && p.post_rating.length > 0) || []
      const postsWithoutRatings = posts?.filter(p => !p.post_rating || p.post_rating.length === 0) || []

      return NextResponse.json({
        issue_id: issueId,
        total_posts: posts?.length || 0,
        posts_with_ratings: postsWithRatings.length,
        posts_without_ratings: postsWithoutRatings.length,
        total_articles: articles?.length || 0,
        active_articles: articles?.filter(a => a.is_active).length || 0,
        posts_sample: postsWithRatings.slice(0, 5).map(p => ({
          id: p.id,
          title: p.title,
          rating: p.post_rating?.[0],
          has_article: articles?.some(a => a.post_id === p.id)
        })),
        posts_without_ratings_sample: postsWithoutRatings.slice(0, 5).map(p => ({
          id: p.id,
          title: p.title
        }))
      })
    }
  },

  // ─── check-prompt-value ───
  'check-prompt-value': {
    GET: async ({ request, logger }) => {
      const searchParams = request.nextUrl.searchParams
      const key = searchParams.get('key') || 'ai_prompt_criteria_1'

      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('key, value, ai_provider, description, updated_at, created_at')
        .eq('key', key)
        .single()

      if (error) {
        return NextResponse.json({
          success: false,
          error: error.message,
          errorCode: error.code
        }, { status: 500 })
      }

      if (!data) {
        return NextResponse.json({
          success: false,
          error: `Prompt ${key} not found in database`
        }, { status: 404 })
      }

      let valueType: string = typeof data.value
      let isString = typeof data.value === 'string'
      let isObject = typeof data.value === 'object' && data.value !== null
      let parsedValue: any = null
      let parseError: string | null = null
      let hasMessages = false
      let messagesIsArray = false

      if (isString) {
        try {
          parsedValue = JSON.parse(data.value)
          valueType = 'string (JSON)'
        } catch (e) {
          parseError = e instanceof Error ? e.message : 'Parse failed'
          valueType = 'string (not JSON)'
        }
      } else if (isObject) {
        parsedValue = data.value
        valueType = 'object (JSONB)'
      }

      if (parsedValue) {
        hasMessages = 'messages' in parsedValue
        messagesIsArray = Array.isArray(parsedValue.messages)
      }

      const valuePreview = isString
        ? data.value.substring(0, 500)
        : JSON.stringify(data.value).substring(0, 500)

      return NextResponse.json({
        success: true,
        key,
        metadata: {
          ai_provider: data.ai_provider || 'openai',
          description: data.description || '',
          updated_at: data.updated_at,
          created_at: data.created_at
        },
        valueAnalysis: {
          valueType,
          isString,
          isObject,
          valueLength: isString ? data.value.length : JSON.stringify(data.value).length,
          valuePreview: valuePreview + (valuePreview.length >= 500 ? '...' : ''),
          parseError,
          hasMessages,
          messagesIsArray,
          messagesLength: parsedValue?.messages?.length || 0
        },
        rawValue: data.value,
        parsedValue: parsedValue,
        validation: {
          isValidJSON: !parseError && parsedValue !== null,
          hasMessagesArray: hasMessages && messagesIsArray,
          isValidStructure: !parseError && hasMessages && messagesIsArray
        },
        error: !parseError && hasMessages && messagesIsArray
          ? null
          : `Prompt is ${parseError ? 'not valid JSON' : !hasMessages ? 'missing messages property' : !messagesIsArray ? 'has messages but it\'s not an array' : 'invalid'}`
      })
    }
  },

  // ─── check-prompts ───
  'check-prompts': {
    GET: async ({ logger }) => {
      const { data: allPrompts, count: totalCount } = await supabaseAdmin
        .from('prompt_ideas')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })

      const { data: activePrompts, count: activeCount } = await supabaseAdmin
        .from('prompt_ideas')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      const { data: newsletterPrompts, count: newsletterCount } = await supabaseAdmin
        .from('prompt_ideas')
        .select('*, newsletter:newsletters(name)', { count: 'exact' })
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      const { data: recentSelections } = await supabaseAdmin
        .from('issue_prompt_selections')
        .select('*, prompt:prompt_ideas(title), issue:publication_issues(date)')
        .order('created_at', { ascending: false })
        .limit(5)

      return NextResponse.json({
        total_prompts: totalCount,
        active_prompts: activeCount,
        newsletter_assigned_prompts: newsletterCount,
        sample_active_prompts: activePrompts?.slice(0, 5).map(p => ({
          id: p.id,
          title: p.title,
          is_active: p.is_active,
          publication_id: p.publication_id
        })),
        newsletter_prompts_detail: newsletterPrompts?.slice(0, 5).map(p => ({
          id: p.id,
          title: p.title,
          newsletter_name: (p as any).newsletter?.name
        })),
        recent_selections: recentSelections?.map(s => ({
          issue_date: (s as any).issue?.date,
          prompt_title: (s as any).prompt?.title,
          created_at: s.created_at
        }))
      })
    }
  },

  // ─── check-secondary-articles ───
  'check-secondary-articles': {
    GET: async ({ request, logger }) => {
      const searchParams = new URL(request.url).searchParams
      const issueId = searchParams.get('issue_id')

      if (!issueId) {
        return NextResponse.json({ error: 'issueId required' }, { status: 400 })
      }

      const { data: secondaryArticles, error: secondaryError } = await supabaseAdmin
        .from('module_articles')
        .select(`
          id,
          post_id,
          headline,
          content,
          rank,
          is_active,
          skipped,
          fact_check_score,
          word_count,
          article_module_id,
          created_at,
          rss_post:rss_posts(
            id,
            title,
            post_rating:post_ratings(total_score)
          )
        `)
        .eq('issue_id', issueId)
        .order('rank', { ascending: true, nullsFirst: false })

      if (secondaryError) {
        return NextResponse.json({ error: secondaryError.message }, { status: 500 })
      }

      const activeCount = secondaryArticles?.filter(a => a.is_active).length || 0
      const totalCount = secondaryArticles?.length || 0

      return NextResponse.json({
        success: true,
        issue_id: issueId,
        total_secondary_articles: totalCount,
        active_secondary_articles: activeCount,
        articles: secondaryArticles?.map(a => ({
          id: a.id,
          headline: a.headline,
          is_active: a.is_active,
          rank: a.rank,
          fact_check_score: a.fact_check_score,
          rss_post_title: (a.rss_post as any)?.title,
          score: (a.rss_post as any)?.post_rating?.[0]?.total_score || 0
        })) || []
      })
    }
  },

  // ─── check-sections (GET + POST) ───
  'check-sections': {
    GET: async ({ logger }) => {
      const { data: newsletter } = await supabaseAdmin
        .from('publications')
        .select('id, slug')
        .eq('slug', 'accounting')
        .single()

      if (!newsletter) {
        return NextResponse.json({
          error: 'Newsletter not found'
        }, { status: 404 })
      }

      const { data: sections } = await supabaseAdmin
        .from('newsletter_sections')
        .select('*')
        .eq('publication_id', newsletter.id)
        .order('display_order', { ascending: true })

      const advertorialSection = sections?.find(s => s.name === 'Advertorial')

      return NextResponse.json({
        success: true,
        publication_id: newsletter.id,
        newsletter_slug: newsletter.slug,
        sections: sections || [],
        has_advertorial: !!advertorialSection,
        advertorial_section: advertorialSection
      })
    },
    POST: async ({ logger }) => {
      const { data: newsletter } = await supabaseAdmin
        .from('publications')
        .select('id, slug')
        .eq('slug', 'accounting')
        .single()

      if (!newsletter) {
        return NextResponse.json({
          error: 'Newsletter not found'
        }, { status: 404 })
      }

      const { data: existingSection } = await supabaseAdmin
        .from('newsletter_sections')
        .select('*')
        .eq('publication_id', newsletter.id)
        .eq('name', 'Advertorial')
        .maybeSingle()

      if (existingSection) {
        return NextResponse.json({
          success: true,
          message: 'Advertorial section already exists',
          section: existingSection
        })
      }

      const { data: sections } = await supabaseAdmin
        .from('newsletter_sections')
        .select('display_order')
        .eq('publication_id', newsletter.id)
        .order('display_order', { ascending: false })
        .limit(1)

      const nextOrder = (sections?.[0]?.display_order || 0) + 1

      const { data: newSection, error: insertError } = await supabaseAdmin
        .from('newsletter_sections')
        .insert({
          publication_id: newsletter.id,
          name: 'Advertorial',
          display_order: nextOrder,
          is_active: true
        })
        .select()
        .single()

      if (insertError) {
        throw insertError
      }

      return NextResponse.json({
        success: true,
        message: 'Advertorial section added successfully',
        section: newSection
      })
    },
    maxDuration: 60
  },

  // ─── check-social-media ───
  'check-social-media': {
    GET: async ({ logger }) => {
      console.log('Checking social media settings...')

      const { data: settings, error } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .in('key', [
          'facebook_enabled', 'facebook_url',
          'twitter_enabled', 'twitter_url',
          'linkedin_enabled', 'linkedin_url',
          'instagram_enabled', 'instagram_url'
        ])

      if (error) {
        throw error
      }

      const settingsMap: Record<string, string> = {}
      settings?.forEach(setting => {
        settingsMap[setting.key] = setting.value
      })

      const imageUrls = [
        `${STORAGE_PUBLIC_URL}/img/s/facebook_light.png`,
        `${STORAGE_PUBLIC_URL}/img/s/twitter_light.png`,
        `${STORAGE_PUBLIC_URL}/img/s/linkedin_light.png`,
        `${STORAGE_PUBLIC_URL}/img/s/instagram_light.png`
      ]

      const imageTests = await Promise.all(
        imageUrls.map(async (url) => {
          try {
            const response = await fetch(url, { method: 'HEAD' })
            return {
              url,
              exists: response.ok,
              status: response.status
            }
          } catch (error) {
            return {
              url,
              exists: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })
      )

      const iconLogic = {
        facebook: {
          enabled: settingsMap.facebook_enabled === 'true',
          hasUrl: !!settingsMap.facebook_url,
          shouldShow: settingsMap.facebook_enabled === 'true' && !!settingsMap.facebook_url,
          url: settingsMap.facebook_url
        },
        twitter: {
          enabled: settingsMap.twitter_enabled === 'true',
          hasUrl: !!settingsMap.twitter_url,
          shouldShow: settingsMap.twitter_enabled === 'true' && !!settingsMap.twitter_url,
          url: settingsMap.twitter_url
        },
        linkedin: {
          enabled: settingsMap.linkedin_enabled === 'true',
          hasUrl: !!settingsMap.linkedin_url,
          shouldShow: settingsMap.linkedin_enabled === 'true' && !!settingsMap.linkedin_url,
          url: settingsMap.linkedin_url
        },
        instagram: {
          enabled: settingsMap.instagram_enabled === 'true',
          hasUrl: !!settingsMap.instagram_url,
          shouldShow: settingsMap.instagram_enabled === 'true' && !!settingsMap.instagram_url,
          url: settingsMap.instagram_url
        }
      }

      return NextResponse.json({
        success: true,
        settings: settingsMap,
        iconLogic,
        imageTests,
        summary: {
          totalIconsEnabled: Object.values(iconLogic).filter(i => i.shouldShow).length,
          missingImages: imageTests.filter(t => !t.exists).map(t => t.url)
        }
      })
    }
  },

  // ─── check-system-logs ───
  'check-system-logs': {
    GET: async ({ logger }) => {
      const { data: campaigns } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, created_at')
        .order('created_at', { ascending: false })
        .limit(1)

      const issueId = campaigns?.[0]?.id

      const { data: logs, error } = await supabaseAdmin
        .from('system_logs')
        .select('*')
        .eq('source', 'rss_processor')
        .order('timestamp', { ascending: false })
        .limit(50)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const issueLogs = issueId
        ? logs?.filter(log => log.context?.issueId === issueId || log.context?.postId)
        : logs

      return NextResponse.json({
        success: true,
        latest_issue: campaigns?.[0],
        total_logs: logs?.length || 0,
        issue_logs: issueLogs?.length || 0,
        recent_logs: logs?.slice(0, 20).map(log => ({
          level: log.level,
          message: log.message,
          context: log.context,
          timestamp: log.timestamp
        }))
      })
    }
  },

  // ─── check-tool-visibility ───
  'check-tool-visibility': {
    GET: async ({ request, logger }) => {
      const { data: allApps, error: allError } = await supabaseAdmin
        .from('ai_applications')
        .select('id, app_name, is_active, is_featured, is_paid_placement, publication_id, submission_status, created_at, approved_at')
        .order('created_at', { ascending: false })
        .limit(20)

      const { data: activeApps, error: activeError } = await supabaseAdmin
        .from('ai_applications')
        .select('id, app_name, is_active, is_featured, is_paid_placement, publication_id, submission_status')
        .eq('publication_id', EXPECTED_PUBLICATION_ID)
        .eq('is_active', true)
        .order('is_paid_placement', { ascending: false })
        .order('is_featured', { ascending: false })
        .order('app_name', { ascending: true })
        .limit(20)

      const mismatched = allApps?.filter(app =>
        app.is_active === true && app.publication_id !== EXPECTED_PUBLICATION_ID
      ) || []

      const recentlyApproved = allApps?.filter(app => app.approved_at) || []

      return NextResponse.json({
        expected_publication_id: EXPECTED_PUBLICATION_ID,
        all_recent_apps: {
          count: allApps?.length || 0,
          data: allApps,
          error: allError?.message || null
        },
        active_apps_visible_on_tools_page: {
          count: activeApps?.length || 0,
          data: activeApps,
          error: activeError?.message || null
        },
        diagnosis: {
          mismatched_publication_ids: mismatched.map(app => ({
            id: app.id,
            app_name: app.app_name,
            actual_publication_id: app.publication_id,
            is_active: app.is_active
          })),
          recently_approved: recentlyApproved.map(app => ({
            id: app.id,
            app_name: app.app_name,
            publication_id: app.publication_id,
            is_active: app.is_active,
            approved_at: app.approved_at,
            matches_expected: app.publication_id === EXPECTED_PUBLICATION_ID
          }))
        }
      })
    }
  },

  // ─── check-webhook-logs ───
  'check-webhook-logs': {
    GET: async ({ request, logger }) => {
      const { searchParams } = new URL(request.url)
      const sessionId = searchParams.get('session_id')

      if (!sessionId) {
        return NextResponse.json({
          error: 'Please provide ?session_id=cs_...'
        }, { status: 400 })
      }

      const { data: pending, error: pendingError } = await supabaseAdmin
        .from('pending_event_submissions')
        .select('*')
        .eq('stripe_session_id', sessionId)
        .maybeSingle()

      const { data: events, error: eventsError } = await supabaseAdmin
        .from('events')
        .select('*')
        .eq('payment_intent_id', sessionId)

      const envVars = {
        STRIPE_SECRET_KEY_SET: !!process.env.STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET_SET: !!process.env.STRIPE_WEBHOOK_SECRET,
        SLACK_WEBHOOK_URL_SET: !!process.env.SLACK_WEBHOOK_URL,
        NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL || 'not set'
      }

      return NextResponse.json({
        success: true,
        session_id: sessionId,
        pending_submission: pending || 'Not found',
        pending_error: pendingError?.message || null,
        events_created: events?.length || 0,
        events: events || [],
        events_error: eventsError?.message || null,
        environment_variables: envVars,
        diagnosis: !pending
          ? 'No pending submission found - checkout may have failed or session ID is wrong'
          : pending.processed
            ? 'Already processed successfully'
            : 'Pending submission exists but not processed - webhook likely failed',
        next_steps: !pending
          ? 'Check Stripe Dashboard > Payments to verify payment succeeded'
          : !pending.processed
            ? 'Check Vercel logs for webhook errors. Try manually resending webhook from Stripe Dashboard.'
            : 'Everything looks good!'
      })
    }
  },

  // ─── env-check ───
  'env-check': {
    GET: async ({ request, logger }) => {
      const hasApiKey = !!process.env.HTML_CSS_TO_IMAGE_API_KEY
      const apiKeyLength = process.env.HTML_CSS_TO_IMAGE_API_KEY?.length || 0
      const hasUserId = !!process.env.HTML_CSS_TO_IMAGE_USER_ID
      const userIdLength = process.env.HTML_CSS_TO_IMAGE_USER_ID?.length || 0

      return NextResponse.json({
        hasApiKey,
        apiKeyLength,
        hasUserId,
        userIdLength,
        apiKeyPreview: process.env.HTML_CSS_TO_IMAGE_API_KEY ?
          `${process.env.HTML_CSS_TO_IMAGE_API_KEY.substring(0, 8)}...` :
          'Not set',
        userIdPreview: process.env.HTML_CSS_TO_IMAGE_USER_ID ?
          `${process.env.HTML_CSS_TO_IMAGE_USER_ID.substring(0, 8)}...` :
          'Not set'
      })
    }
  },

  // ─── feedback-exclusion-debug ───
  'feedback-exclusion-debug': {
    GET: async ({ request, logger }) => {
      const { searchParams } = new URL(request.url)
      const publicationId = searchParams.get('publication_id')

      if (!publicationId) {
        return NextResponse.json({ error: 'publication_id required' }, { status: 400 })
      }

      const { data: excludedIps } = await supabaseAdmin
        .from('excluded_ips')
        .select('ip_address, is_range, cidr_prefix, exclusion_source, reason, added_by')
        .eq('publication_id', publicationId)

      const bySource: Record<string, number> = {}
      for (const ip of excludedIps || []) {
        const source = ip.exclusion_source || 'null'
        bySource[source] = (bySource[source] || 0) + 1
      }

      const { data: module } = await supabaseAdmin
        .from('feedback_modules')
        .select('id')
        .eq('publication_id', publicationId)
        .eq('is_active', true)
        .single()

      if (!module) {
        return NextResponse.json({
          error: 'No active feedback module',
          excludedIpsBySource: bySource,
          totalExcludedIps: excludedIps?.length || 0
        })
      }

      const { data: votes } = await supabaseAdmin
        .from('feedback_votes')
        .select('id, subscriber_email, ip_address, selected_value, voted_at, campaign_date')
        .eq('feedback_module_id', module.id)
        .order('voted_at', { ascending: false })
        .limit(50)

      const exclusions: IPExclusion[] = (excludedIps || []).map(e => ({
        ip_address: e.ip_address,
        is_range: e.is_range || false,
        cidr_prefix: e.cidr_prefix
      }))

      const voteAnalysis = (votes || []).map(vote => {
        const excluded = isIPExcluded(vote.ip_address, exclusions)
        const matchingExclusion = excluded
          ? excludedIps?.find(e => e.ip_address === vote.ip_address)
          : null

        return {
          email: vote.subscriber_email,
          ip: vote.ip_address,
          rating: vote.selected_value,
          date: vote.campaign_date,
          isExcluded: excluded,
          exclusionSource: matchingExclusion?.exclusion_source || null,
          exclusionReason: matchingExclusion?.reason || null
        }
      })

      const visibleVotes = voteAnalysis.filter(v => !v.isExcluded)
      const excludedVotes = voteAnalysis.filter(v => v.isExcluded)

      return NextResponse.json({
        summary: {
          totalExcludedIps: excludedIps?.length || 0,
          excludedIpsBySource: bySource,
          totalVotesChecked: voteAnalysis.length,
          visibleVotes: visibleVotes.length,
          excludedVotes: excludedVotes.length
        },
        visibleVotes: visibleVotes.slice(0, 20),
        excludedVotes: excludedVotes.slice(0, 20),
        allExcludedIps: (excludedIps || []).slice(0, 50).map(ip => ({
          ip: ip.ip_address,
          source: ip.exclusion_source,
          reason: ip.reason?.substring(0, 50)
        }))
      })
    }
  },

  // ─── verify-ai-features ───
  'verify-ai-features': {
    GET: async ({ logger }) => {
      const results: any = {
        timestamp: new Date().toISOString(),
        tables: {},
        sample_data: {}
      }

      const { data: apps, error: appsError } = await supabaseAdmin
        .from('ai_applications')
        .select('*')
        .limit(5)

      results.tables.ai_applications = {
        exists: !appsError,
        error: appsError?.message || null,
        count: apps?.length || 0
      }
      results.sample_data.ai_applications = apps || []

      const { data: prompts, error: promptsError } = await supabaseAdmin
        .from('prompt_ideas')
        .select('*')
        .limit(5)

      results.tables.prompt_ideas = {
        exists: !promptsError,
        error: promptsError?.message || null,
        count: prompts?.length || 0
      }
      results.sample_data.prompt_ideas = prompts || []

      const { data: appSelections, error: appSelectionsError } = await supabaseAdmin
        .from('issue_ai_app_selections')
        .select('*')
        .limit(5)

      results.tables.issue_ai_app_selections = {
        exists: !appSelectionsError,
        error: appSelectionsError?.message || null,
        count: appSelections?.length || 0
      }

      const { data: promptSelections, error: promptSelectionsError } = await supabaseAdmin
        .from('issue_prompt_selections')
        .select('*')
        .limit(5)

      results.tables.issue_prompt_selections = {
        exists: !promptSelectionsError,
        error: promptSelectionsError?.message || null,
        count: promptSelections?.length || 0
      }

      const allTablesExist =
        results.tables.ai_applications.exists &&
        results.tables.prompt_ideas.exists &&
        results.tables.issue_ai_app_selections.exists &&
        results.tables.issue_prompt_selections.exists

      results.status = allTablesExist ? 'READY' : 'INCOMPLETE'
      results.message = allTablesExist
        ? 'AI features are ready! All tables exist.'
        : 'Some AI feature tables are missing.'

      return NextResponse.json(results)
    }
  },
}
