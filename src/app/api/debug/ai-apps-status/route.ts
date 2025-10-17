import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { AppSelector } from '@/lib/app-selector'

export async function GET() {
  try {
    console.log('=== AI APPS STATUS DEBUG ===')

    // 1. Check if AI applications exist
    const { data: allApps, error: appsError } = await supabaseAdmin
      .from('ai_applications')
      .select('id, app_name, newsletter_id, is_active')
      .order('app_name')

    console.log('Total AI apps in database:', allApps?.length || 0)
    if (appsError) {
      console.error('Error fetching apps:', appsError)
    }

    // 2. Get latest campaign
    const { data: latestCampaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, status')
      .order('date', { ascending: false })
      .limit(1)
      .single()

    console.log('Latest campaign:', latestCampaign)
    if (campaignError) {
      console.error('Error fetching campaign:', campaignError)
    }

    // 3. Check selections for latest campaign
    let campaignSelections = null
    let newsletterInfo = null
    let manualSelectionResult = null

    if (latestCampaign) {
      const { data: selections, error: selectionsError } = await supabaseAdmin
        .from('campaign_ai_app_selections')
        .select('*, app:ai_applications(*)')
        .eq('campaign_id', latestCampaign.id)
        .order('selection_order')

      console.log('Selections for latest campaign:', selections?.length || 0)
      if (selectionsError) {
        console.error('Error fetching selections:', selectionsError)
      }
      campaignSelections = selections

      // 4. Get newsletter info
      const { data: newsletter } = await supabaseAdmin
        .from('newsletters')
        .select('id, name, slug')
        .eq('slug', 'accounting')
        .single()

      newsletterInfo = newsletter
      console.log('Newsletter info:', newsletter)

      // 5. Try to manually select apps
      if (newsletter && (!selections || selections.length === 0)) {
        console.log('Attempting manual app selection...')
        try {
          const selectedApps = await AppSelector.selectAppsForCampaign(latestCampaign.id, newsletter.id)
          manualSelectionResult = {
            success: true,
            count: selectedApps.length,
            apps: selectedApps.map(app => ({
              id: app.id,
              name: app.app_name,
              category: app.category
            }))
          }
          console.log('Manual selection successful:', selectedApps.length, 'apps')
        } catch (error) {
          manualSelectionResult = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          }
          console.error('Manual selection failed:', error)
        }

        // Fetch selections again after manual selection
        const { data: newSelections } = await supabaseAdmin
          .from('campaign_ai_app_selections')
          .select('*, app:ai_applications(*)')
          .eq('campaign_id', latestCampaign.id)
          .order('selection_order')

        campaignSelections = newSelections
        console.log('Selections after manual attempt:', newSelections?.length || 0)
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
          newsletter_id: app.newsletter_id
        }))
      },
      latest_campaign: latestCampaign ? {
        id: latestCampaign.id,
        date: latestCampaign.date,
        status: latestCampaign.status
      } : null,
      newsletter: newsletterInfo,
      campaign_selections: {
        count: campaignSelections?.length || 0,
        selections: campaignSelections?.map(s => ({
          app_id: s.app_id,
          app_name: s.app?.app_name,
          category: s.app?.category,
          order: s.selection_order
        }))
      },
      manual_selection_attempt: manualSelectionResult,
      errors: {
        apps_error: appsError?.message,
        campaign_error: campaignError?.message
      }
    })

  } catch (error) {
    console.error('AI apps status error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
