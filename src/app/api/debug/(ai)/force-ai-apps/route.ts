import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { AppSelector } from '@/lib/app-selector'

export async function GET() {
  try {
    // Get the latest campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, status')
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({
        error: 'No campaign found',
        details: campaignError
      }, { status: 404 })
    }

    // Get accounting newsletter ID
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('newsletters')
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
      .from('campaign_ai_app_selections')
      .select('*')
      .eq('campaign_id', campaign.id)

    console.log(`Existing selections for campaign ${campaign.id}:`, existingSelections?.length || 0)

    // Force select apps for this campaign
    const selectedApps = await AppSelector.selectAppsForCampaign(campaign.id, newsletter.id)

    // Get the final selections from database
    const { data: finalSelections } = await supabaseAdmin
      .from('campaign_ai_app_selections')
      .select('*, app:ai_applications(*)')
      .eq('campaign_id', campaign.id)
      .order('selection_order', { ascending: true })

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        date: campaign.date,
        status: campaign.status
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

  } catch (error) {
    console.error('Force AI apps error:', error)
    return NextResponse.json({
      error: 'Failed to force AI app selection',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
