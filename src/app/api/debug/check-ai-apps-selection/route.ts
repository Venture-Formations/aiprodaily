import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams
    const campaignId = searchParams.get('campaign_id')

    // Get all AI apps
    const { data: allApps, error: appsError } = await supabaseAdmin
      .from('ai_apps')
      .select('*')
      .eq('active', true)
      .order('name')

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
          ai_app:ai_apps(*)
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
        name: app.name,
        active: app.active,
        newsletter_id: app.newsletter_id
      })),
      newsletter: newsletter || null,
      campaign_id: campaignId,
      campaign_selections: campaignSelections?.length || 0,
      selected_apps: campaignSelections?.map(s => ({
        ai_app_id: s.ai_app_id,
        display_order: s.display_order,
        app_name: s.ai_app?.name
      })) || []
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
