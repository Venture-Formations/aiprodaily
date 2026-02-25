import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { AppSelector } from '@/lib/app-selector'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(ai)/force-ai-apps' },
  async ({ logger }) => {
    // Get the latest issue
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, status')
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (issueError || !issue) {
      return NextResponse.json({
        error: 'No issue found',
        details: issueError
      }, { status: 404 })
    }

    // Get accounting newsletter ID
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('publications')
      .select('id, slug, name')
      .eq('slug', 'accounting')
      .single()

    if (newsletterError || !newsletter) {
      return NextResponse.json({
        error: 'Accounting newsletter not found',
        details: newsletterError
      }, { status: 404 })
    }

    // Check existing selections
    const { data: existingSelections } = await supabaseAdmin
      .from('issue_ai_app_selections')
      .select('*')
      .eq('issue_id', issue.id)

    logger.info({ issueId: issue.id, count: existingSelections?.length || 0 }, 'Existing selections for issue')

    // Force select apps for this issue
    const selectedApps = await AppSelector.selectAppsForissue(issue.id, newsletter.id)

    // Get the final selections from database
    const { data: finalSelections } = await supabaseAdmin
      .from('issue_ai_app_selections')
      .select('*, app:ai_applications(*)')
      .eq('issue_id', issue.id)
      .order('selection_order', { ascending: true })

    return NextResponse.json({
      success: true,
      issue: {
        id: issue.id,
        date: issue.date,
        status: issue.status
      },
      newsletter: {
        id: newsletter.id,
        slug: newsletter.slug,
        name: newsletter.name
      },
      existing_selections_count: existingSelections?.length || 0,
      apps_selected_count: selectedApps.length,
      final_selections_count: finalSelections?.length || 0,
      selected_apps: finalSelections?.map(s => ({
        app_id: s.app_id,
        app_name: s.app?.app_name,
        category: s.app?.category,
        selection_order: s.selection_order
      }))
    })
  }
)
