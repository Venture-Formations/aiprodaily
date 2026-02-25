import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]' },
  async ({ params }) => {
    const id = params.id

    const { data: issue, error } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        *,
        module_articles:module_articles(
          *,
          rss_post:rss_posts(
            *,
            post_rating:post_ratings(*),
            rss_feed:rss_feeds(*)
          )
        ),
        manual_articles:manual_articles(*),
        email_metrics(*),
        issue_advertisements(
          *,
          advertisement:advertisements(*)
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      throw error
    }

    if (!issue) {
      return NextResponse.json({ error: 'issue not found' }, { status: 404 })
    }

    // Fetch AI app modules separately (no FK relationship to publication_issues)
    const { data: aiAppModules } = await supabaseAdmin
      .from('issue_ai_app_modules')
      .select(`
        *,
        ai_app_module:ai_app_modules(*)
      `)
      .eq('issue_id', id)

    // Also fetch legacy AI app selections for backward compatibility with old issues
    const { data: legacyAiApps } = await supabaseAdmin
      .from('issue_ai_app_selections')
      .select(`
        *,
        app:ai_applications(*)
      `)
      .eq('issue_id', id)
      .order('selection_order', { ascending: true })

    // Transform email_metrics from array to single object (or null)
    // Supabase returns email_metrics(*) as an array even for one-to-one relationships
    // Also alias module_articles as 'articles' for frontend compatibility
    const transformedIssue = {
      ...issue,
      articles: (issue.module_articles || []).filter((a: any) => a && a.id), // Frontend expects 'articles' property
      secondary_articles: [], // No longer used, but keep for compatibility
      email_metrics: Array.isArray(issue.email_metrics) && issue.email_metrics.length > 0
        ? issue.email_metrics[0]
        : null,
      issue_ai_app_modules: aiAppModules || [],
      issue_ai_app_selections: legacyAiApps || []
    }

    return NextResponse.json({ issue: transformedIssue })
  }
)

export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]' },
  async ({ params, session, request }) => {
    const id = params.id

    const body = await request.json()
    const { status, subject_line } = body

    const updateData: any = {}
    if (status) updateData.status = status
    if (subject_line !== undefined) updateData.subject_line = subject_line

    const { data: issue, error } = await supabaseAdmin
      .from('publication_issues')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      throw error
    }

    // Log user activity
    if (session.user?.email) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

      if (user) {
        await supabaseAdmin
          .from('user_activities')
          .insert([{
            user_id: user.id,
            issue_id: id,
            action: 'issue_updated',
            details: updateData
          }])
      }
    }

    return NextResponse.json({ issue })
  }
)
