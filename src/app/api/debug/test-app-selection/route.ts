import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { AppSelector } from '@/lib/app-selector'

export async function GET(request: NextRequest) {
  try {
    // Step 1: Check newsletters
    const { data: newsletters, error: newsletterError } = await supabaseAdmin
      .from('newsletters')
      .select('*')
      .eq('active', true)

    if (newsletterError) {
      return NextResponse.json({ error: newsletterError.message, step: 'newsletters' }, { status: 500 })
    }

    // Step 2: Check AI applications
    const { data: apps, error: appsError } = await supabaseAdmin
      .from('ai_applications')
      .select('*')
      .eq('is_active', true)

    if (appsError) {
      return NextResponse.json({ error: appsError.message, step: 'apps' }, { status: 500 })
    }

    // Step 3: Get most recent campaign
    const { data: campaigns, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (campaignError) {
      return NextResponse.json({ error: campaignError.message, step: 'campaign' }, { status: 500 })
    }

    // Step 4: Check existing app selections for this campaign
    const { data: existingSelections } = await supabaseAdmin
      .from('campaign_ai_app_selections')
      .select('*, app:ai_applications(*)')
      .eq('campaign_id', campaigns.id)

    // Step 5: Try selecting apps manually
    let selectionResult = null
    let selectionError = null

    if (newsletters && newsletters.length > 0) {
      const newsletter = newsletters[0]
      try {
        const selectedApps = await AppSelector.selectAppsForCampaign(campaigns.id, newsletter.id)
        selectionResult = {
          newsletter_id: newsletter.id,
          newsletter_name: newsletter.name,
          selected_count: selectedApps.length,
          selected_apps: selectedApps.map(app => ({
            id: app.id,
            name: app.app_name,
            category: app.category
          }))
        }
      } catch (err) {
        selectionError = err instanceof Error ? err.message : 'Unknown error'
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        newsletters: {
          count: newsletters?.length || 0,
          list: newsletters?.map(n => ({ id: n.id, name: n.name, slug: n.slug, active: n.is_active }))
        },
        ai_applications: {
          total_active: apps?.length || 0,
          by_newsletter: newsletters?.map(n => ({
            newsletter: n.name,
            app_count: apps?.filter(app => app.newsletter_id === n.id).length || 0
          }))
        },
        latest_campaign: {
          id: campaigns.id,
          date: campaigns.date,
          created_at: campaigns.created_at,
          existing_app_selections: existingSelections?.length || 0
        },
        manual_selection_test: selectionResult,
        selection_error: selectionError
      }
    })

  } catch (error) {
    console.error('Error in test-app-selection:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
