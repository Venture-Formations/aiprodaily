import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams
    const campaignId = searchParams.get('campaign_id')

    // Get all AI apps
    const { data: allApps, error: appsError } = await supabaseAdmin
      .from('ai_applications')
      .select('*')
      .eq('is_active', true)
      .order('app_name')

    if (appsError) {
      return NextResponse.json({ error: appsError.message }, { status: 500 })
    }

    // If campaign ID provided, get selections for that campaign
    let campaignSelections = null
    if (campaignId) {
      const { data: selections, error: selectionsError } = await supabaseAdmin
        .from('campaign_ai_app_selections')
        .select(`
          *,
          app:ai_applications(*)
        `)
        .eq('campaign_id', campaignId)

      if (selectionsError) {
        return NextResponse.json({ error: selectionsError.message }, { status: 500 })
      }

      campaignSelections = selections
    }

    // Check if accounting newsletter exists
    const { data: newsletter } = await supabaseAdmin
      .from('newsletters')
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
        newsletter_id: app.newsletter_id
      })),
      newsletter: newsletter || null,
      campaign_id: campaignId,
      campaign_selections: campaignSelections?.length || 0,
      selected_apps: campaignSelections?.map(s => ({
        app_id: s.app_id,
        selection_order: s.selection_order,
        app_name: s.app?.app_name
      })) || []
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
