import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { AppSelector } from '@/lib/app-selector'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(ai)/ai-apps-status' },
  async ({ logger }) => {
    logger.info('=== AI APPS STATUS DEBUG ===')

    // 1. Check if AI applications exist
    const { data: allApps, error: appsError } = await supabaseAdmin
      .from('ai_applications')
      .select('id, app_name, publication_id, is_active')
      .order('app_name')

    logger.info({ count: allApps?.length || 0 }, 'Total AI apps in database')
    if (appsError) {
      logger.error({ err: appsError }, 'Error fetching apps')
    }

    // 2. Get latest issue
    const { data: latestissue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, status')
      .order('date', { ascending: false })
      .limit(1)
      .single()

    logger.info({ latestissue }, 'Latest issue')
    if (issueError) {
      logger.error({ err: issueError }, 'Error fetching issue')
    }

    // 3. Check selections for latest issue
    let issueSelections = null
    let newsletterInfo = null
    let manualSelectionResult = null

    if (latestissue) {
      const { data: selections, error: selectionsError } = await supabaseAdmin
        .from('issue_ai_app_selections')
        .select('*, app:ai_applications(*)')
        .eq('issue_id', latestissue.id)
        .order('selection_order')

      logger.info({ count: selections?.length || 0 }, 'Selections for latest issue')
      if (selectionsError) {
        logger.error({ err: selectionsError }, 'Error fetching selections')
      }
      issueSelections = selections

      // 4. Get newsletter info
      const { data: newsletter } = await supabaseAdmin
        .from('publications')
        .select('id, name, slug')
        .eq('slug', 'accounting')
        .single()

      newsletterInfo = newsletter
      logger.info({ newsletter }, 'Newsletter info')

      // 5. Try to manually select apps
      if (newsletter && (!selections || selections.length === 0)) {
        logger.info('Attempting manual app selection...')
        try {
          const selectedApps = await AppSelector.selectAppsForissue(latestissue.id, newsletter.id)
          manualSelectionResult = {
            success: true,
            count: selectedApps.length,
            apps: selectedApps.map(app => ({
              id: app.id,
              name: app.app_name,
              category: app.category
            }))
          }
          logger.info({ count: selectedApps.length }, 'Manual selection successful')
        } catch (error) {
          manualSelectionResult = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          }
          logger.error({ err: error }, 'Manual selection failed')
        }

        // Fetch selections again after manual selection
        const { data: newSelections } = await supabaseAdmin
          .from('issue_ai_app_selections')
          .select('*, app:ai_applications(*)')
          .eq('issue_id', latestissue.id)
          .order('selection_order')

        issueSelections = newSelections
        logger.info({ count: newSelections?.length || 0 }, 'Selections after manual attempt')
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      database_apps: {
        total: allApps?.length || 0,
        active: allApps?.filter(app => app.is_active).length || 0,
        apps: allApps?.map(app => ({
          id: app.id,
          name: app.app_name,
          active: app.is_active,
          publication_id: app.publication_id
        }))
      },
      latest_issue: latestissue ? {
        id: latestissue.id,
        date: latestissue.date,
        status: latestissue.status
      } : null,
      newsletter: newsletterInfo,
      issue_selections: {
        count: issueSelections?.length || 0,
        selections: issueSelections?.map(s => ({
          app_id: s.app_id,
          app_name: s.app?.app_name,
          category: s.app?.category,
          order: s.selection_order
        }))
      },
      manual_selection_attempt: manualSelectionResult,
      errors: {
        apps_error: appsError?.message,
        issue_error: issueError?.message
      }
    })
  }
)
