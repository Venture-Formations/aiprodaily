import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get the 5 most recent campaigns
    const { data: campaigns, error: campaignsError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, created_at, status')
      .order('created_at', { ascending: false })
      .limit(5)

    if (campaignsError) {
      return NextResponse.json({ error: campaignsError.message }, { status: 500 })
    }

    // For each campaign, get the AI app selections
    const results = await Promise.all(
      campaigns.map(async (campaign) => {
        const { data: appSelections, error: appError } = await supabaseAdmin
          .from('campaign_ai_app_selections')
          .select(`
            *,
            app:ai_applications(id, app_name, category)
          `)
          .eq('campaign_id', campaign.id)
          .order('selection_order', { ascending: true })

        const { data: promptSelection, error: promptError } = await supabaseAdmin
          .from('campaign_prompt_selections')
          .select(`
            *,
            prompt:prompt_ideas(id, title, category)
          `)
          .eq('campaign_id', campaign.id)
          .single()

        return {
          campaign_id: campaign.id,
          campaign_date: campaign.date,
          campaign_status: campaign.status,
          created_at: campaign.created_at,
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
      campaigns: results,
      summary: {
        total_campaigns: campaigns.length,
        campaigns_with_apps: results.filter(r => r.app_count > 0).length,
        campaigns_with_prompts: results.filter(r => r.prompt_selected).length,
        campaigns_without_apps: results.filter(r => r.app_count === 0).length,
        campaigns_without_prompts: results.filter(r => !r.prompt_selected).length
      }
    })

  } catch (error) {
    console.error('Error checking app selections:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
