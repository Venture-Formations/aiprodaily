import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const logs: string[] = []

  try {
    logs.push('=== MANUAL APP SELECTION TEST ===')

    // Step 1: Get the most recent campaign
    logs.push('Step 1: Fetching most recent campaign...')
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, created_at, status')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (campaignError) {
      logs.push(`ERROR: Failed to fetch campaign: ${campaignError.message}`)
      return NextResponse.json({ success: false, error: campaignError.message, logs })
    }

    logs.push(`Found campaign: ${campaign.id}`)
    logs.push(`Campaign date: ${campaign.date}`)
    logs.push(`Campaign status: ${campaign.status}`)
    logs.push(`Created at: ${campaign.created_at}`)

    // Step 2: Get the active newsletter
    logs.push('\nStep 2: Fetching active newsletter...')
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('newsletters')
      .select('id, name, slug, is_active')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (newsletterError) {
      logs.push(`ERROR: Failed to fetch newsletter: ${newsletterError.message}`)
      return NextResponse.json({ success: false, error: newsletterError.message, logs })
    }

    logs.push(`Found newsletter: ${newsletter.name}`)
    logs.push(`Newsletter ID: ${newsletter.id}`)
    logs.push(`Newsletter slug: ${newsletter.slug}`)

    // Step 3: Check if apps already selected for this campaign
    logs.push('\nStep 3: Checking existing app selections...')
    const { data: existingSelections, error: selectionsError } = await supabaseAdmin
      .from('campaign_ai_app_selections')
      .select('id, app_id, selection_order')
      .eq('campaign_id', campaign.id)

    if (selectionsError) {
      logs.push(`ERROR: Failed to check existing selections: ${selectionsError.message}`)
    } else {
      logs.push(`Existing selections: ${existingSelections?.length || 0}`)
      if (existingSelections && existingSelections.length > 0) {
        logs.push('Campaign already has app selections - skipping')
        return NextResponse.json({
          success: true,
          message: 'Campaign already has apps selected',
          existing_count: existingSelections.length,
          logs
        })
      }
    }

    // Step 4: Get available apps for this newsletter
    logs.push('\nStep 4: Fetching available AI apps...')
    const { data: apps, error: appsError } = await supabaseAdmin
      .from('ai_applications')
      .select('id, app_name, category, newsletter_id, is_active')
      .eq('newsletter_id', newsletter.id)
      .eq('is_active', true)

    if (appsError) {
      logs.push(`ERROR: Failed to fetch apps: ${appsError.message}`)
      return NextResponse.json({ success: false, error: appsError.message, logs })
    }

    logs.push(`Found ${apps?.length || 0} active apps for newsletter`)

    if (!apps || apps.length === 0) {
      logs.push('ERROR: No active apps available for selection!')
      return NextResponse.json({
        success: false,
        error: 'No apps available',
        logs
      })
    }

    // Step 5: Try importing AppSelector
    logs.push('\nStep 5: Importing AppSelector module...')
    try {
      const { AppSelector } = await import('@/lib/app-selector')
      logs.push('AppSelector imported successfully')

      // Step 6: Call selectAppsForCampaign
      logs.push(`\nStep 6: Calling AppSelector.selectAppsForCampaign(${campaign.id}, ${newsletter.id})...`)

      const selectedApps = await AppSelector.selectAppsForCampaign(campaign.id, newsletter.id)

      logs.push(`✅ Selection completed! Selected ${selectedApps.length} apps`)
      selectedApps.forEach((app, index) => {
        logs.push(`  ${index + 1}. ${app.app_name} (${app.category})`)
      })

      // Step 7: Verify selections were saved
      logs.push('\nStep 7: Verifying selections were saved to database...')
      const { data: verifySelections } = await supabaseAdmin
        .from('campaign_ai_app_selections')
        .select('id, app_id, selection_order')
        .eq('campaign_id', campaign.id)

      logs.push(`Verified: ${verifySelections?.length || 0} selections saved to database`)

      return NextResponse.json({
        success: true,
        campaign_id: campaign.id,
        newsletter_id: newsletter.id,
        selected_count: selectedApps.length,
        verified_count: verifySelections?.length || 0,
        logs
      })

    } catch (importError) {
      logs.push(`ERROR importing or calling AppSelector: ${importError instanceof Error ? importError.message : 'Unknown error'}`)
      logs.push(`Stack trace: ${importError instanceof Error ? importError.stack : 'No stack trace'}`)
      return NextResponse.json({ success: false, error: 'AppSelector error', logs }, { status: 500 })
    }

  } catch (error) {
    logs.push(`FATAL ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`)
    logs.push(`Stack trace: ${error instanceof Error ? error.stack : 'No stack trace'}`)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      logs
    }, { status: 500 })
  }
}
