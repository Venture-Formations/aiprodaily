import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(tests)/test-manual-app-selection' },
  async ({ logger }) => {
  const logs: string[] = []

  try {
    logs.push('=== MANUAL APP SELECTION TEST ===')

    // Step 1: Get the most recent issue
    logs.push('Step 1: Fetching most recent issue...')
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, created_at, status')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (issueError) {
      logs.push(`ERROR: Failed to fetch issue: ${issueError.message}`)
      return NextResponse.json({ success: false, error: issueError.message, logs })
    }

    logs.push(`Found issue: ${issue.id}`)
    logs.push(`issue date: ${issue.date}`)
    logs.push(`issue status: ${issue.status}`)
    logs.push(`Created at: ${issue.created_at}`)

    // Step 2: Get the active newsletter
    logs.push('\nStep 2: Fetching active newsletter...')
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('publications')
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

    // Step 3: Check if apps already selected for this issue
    logs.push('\nStep 3: Checking existing app selections...')
    const { data: existingSelections, error: selectionsError } = await supabaseAdmin
      .from('issue_ai_app_selections')
      .select('id, app_id, selection_order')
      .eq('issue_id', issue.id)

    if (selectionsError) {
      logs.push(`ERROR: Failed to check existing selections: ${selectionsError.message}`)
    } else {
      logs.push(`Existing selections: ${existingSelections?.length || 0}`)
      if (existingSelections && existingSelections.length > 0) {
        logs.push('issue already has app selections - skipping')
        return NextResponse.json({
          success: true,
          message: 'issue already has apps selected',
          existing_count: existingSelections.length,
          logs
        })
      }
    }

    // Step 4: Get available apps for this newsletter
    logs.push('\nStep 4: Fetching available AI apps...')
    const { data: apps, error: appsError } = await supabaseAdmin
      .from('ai_applications')
      .select('id, app_name, category, publication_id, is_active')
      .eq('publication_id', newsletter.id)
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
      logs.push(`\nStep 6: Calling AppSelector.selectAppsForissue(${issue.id}, ${newsletter.id})...`)

      const selectedApps = await AppSelector.selectAppsForissue(issue.id, newsletter.id)

      logs.push(`✅ Selection completed! Selected ${selectedApps.length} apps`)
      selectedApps.forEach((app, index) => {
        logs.push(`  ${index + 1}. ${app.app_name} (${app.category})`)
      })

      // Step 7: Verify selections were saved
      logs.push('\nStep 7: Verifying selections were saved to database...')
      const { data: verifySelections } = await supabaseAdmin
        .from('issue_ai_app_selections')
        .select('id, app_id, selection_order')
        .eq('issue_id', issue.id)

      logs.push(`Verified: ${verifySelections?.length || 0} selections saved to database`)

      return NextResponse.json({
        success: true,
        issue_id: issue.id,
        publication_id: newsletter.id,
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
)
