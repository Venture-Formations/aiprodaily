import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { AppSelector } from '@/lib/app-selector'

export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(ai)/manual-select-apps' },
  async ({ request, logger }) => {
    const { issueId } = await request.json()

    if (!issueId) {
      return NextResponse.json({ error: 'issueId required' }, { status: 400 })
    }

    logger.info({ issueId }, 'Manual AI app selection for issue')

    // Get accounting newsletter ID
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('publications')
      .select('id, slug')
      .eq('slug', 'accounting')
      .single()

    if (newsletterError || !newsletter) {
      return NextResponse.json({
        error: 'Accounting newsletter not found',
        details: newsletterError?.message
      }, { status: 404 })
    }

    logger.info({ newsletterId: newsletter.id }, 'Found newsletter')

    // Select apps for issue
    const selectedApps = await AppSelector.selectAppsForissue(issueId, newsletter.id)

    logger.info({ count: selectedApps.length }, 'Selected AI applications')

    return NextResponse.json({
      success: true,
      issue_id: issueId,
      publication_id: newsletter.id,
      apps_selected: selectedApps.length,
      apps: selectedApps.map(app => ({
        id: app.id,
        app_name: app.app_name,
        category: app.category
      }))
    })
  }
)
