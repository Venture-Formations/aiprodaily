import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { AppSelector } from '@/lib/app-selector'
import type { AIApplication } from '@/types/database'

/**
 * Simulate app selection without updating database
 * This replicates the core selection logic for dry-run testing
 */
async function simulateAppSelection(issueId: string, newsletterId: string): Promise<AIApplication[]> {
  // Get settings
  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .or('key.like.ai_apps_%,key.eq.affiliate_cooldown_days')

  const settingsMap = new Map(settings?.map(s => [s.key, parseInt(s.value || '0')]) || [])
  const totalApps = settingsMap.get('ai_apps_per_newsletter') || 6
  const affiliateCooldownDays = settingsMap.get('affiliate_cooldown_days') || 7

  // Get all active apps
  const { data: allApps } = await supabaseAdmin
    .from('ai_applications')
    .select('*')
    .eq('publication_id', newsletterId)
    .eq('is_active', true)

  if (!allApps || allApps.length === 0) return []

  // Simple random selection with affiliate weighting and cooldown
  const eligibleApps = allApps.filter(app => {
    if (!app.is_affiliate) return true // Non-affiliates always eligible

    if (!app.last_used_date) return true // Never used, eligible

    const daysSinceLastUsed = Math.floor(
      (Date.now() - new Date(app.last_used_date).getTime()) / (1000 * 60 * 60 * 24)
    )

    return daysSinceLastUsed >= affiliateCooldownDays // Affiliate eligible if past cooldown
  })

  // Create weighted pool (affiliates 3x)
  const weightedPool: AIApplication[] = []
  for (const app of eligibleApps) {
    if (app.is_affiliate) {
      weightedPool.push(app, app, app) // 3x weight
    } else {
      weightedPool.push(app) // 1x weight
    }
  }

  // Random select up to totalApps
  const selected: AIApplication[] = []
  const selectedIds = new Set<string>()

  while (selected.length < totalApps && weightedPool.length > 0) {
    const randomIndex = Math.floor(Math.random() * weightedPool.length)
    const selectedApp = weightedPool[randomIndex]

    if (!selectedIds.has(selectedApp.id)) {
      selected.push(selectedApp)
      selectedIds.add(selectedApp.id)
    }

    // Remove all instances of this app from pool
    for (let i = weightedPool.length - 1; i >= 0; i--) {
      if (weightedPool[i].id === selectedApp.id) {
        weightedPool.splice(i, 1)
      }
    }
  }

  return selected
}

/**
 * GET /api/debug/test-affiliate-selection
 *
 * Tests the affiliate app selection logic without running RSS process
 *
 * Query params:
 * - issueId: (optional) Use existing issue, or creates test issue
 * - reset: (optional) Set to 'true' to clear existing selections first
 * - dryRun: (optional) Set to 'true' to simulate without updating database
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(tests)/test-affiliate-selection' },
  async ({ request, logger }) => {
  try {
    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('issueId')
    const reset = searchParams.get('reset') === 'true'
    const dryRun = searchParams.get('dryRun') === 'true'

    let testissueId = issueId

    // Get newsletter ID
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('slug', 'accounting')
      .single()

    if (!newsletter) {
      return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 })
    }

    // If no issue ID provided, get latest draft issue or create test one
    if (!testissueId) {
      const { data: latestissue } = await supabaseAdmin
        .from('publication_issues')
        .select('id')
        .eq('publication_id', newsletter.id)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (latestissue) {
        testissueId = latestissue.id
      } else {
        // Create a test issue
        const testDate = new Date().toISOString().split('T')[0]
        const { data: newissue, error } = await supabaseAdmin
          .from('publication_issues')
          .insert({
            publication_id: newsletter.id,
            date: testDate,
            status: 'draft'
          })
          .select('id')
          .single()

        if (error || !newissue) {
          return NextResponse.json({ error: 'Failed to create test issue' }, { status: 500 })
        }
        testissueId = newissue.id
      }
    }

    // Clear existing selections if reset=true
    if (reset) {
      await supabaseAdmin
        .from('issue_ai_app_selections')
        .delete()
        .eq('issue_id', testissueId)
    }

    // Get current settings
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .or('key.like.ai_apps_%,key.eq.affiliate_cooldown_days')

    const settingsMap: Record<string, string> = {}
    settings?.forEach(s => {
      settingsMap[s.key] = s.value || '0'
    })

    // Get all active apps
    const { data: allApps } = await supabaseAdmin
      .from('ai_applications')
      .select('*')
      .eq('publication_id', newsletter.id)
      .eq('is_active', true)
      .order('app_name')

    // Run selection logic
    if (!testissueId) {
      return NextResponse.json({ error: 'Failed to get or create issue' }, { status: 500 })
    }

    let selectedApps
    if (dryRun) {
      // Dry run: Simulate selection without updating database
      selectedApps = await simulateAppSelection(testissueId, newsletter.id)
    } else {
      // Real run: Actually select and update database
      selectedApps = await AppSelector.selectAppsForissue(testissueId, newsletter.id)
    }

    // Get detailed info about all apps for comparison
    const affiliateCooldownDays = parseInt(settingsMap.affiliate_cooldown_days || '7')
    const now = new Date()

    const appDetails = allApps?.map(app => {
      const isSelected = selectedApps.some(sa => sa.id === app.id)
      const daysSinceLastUsed = app.last_used_date
        ? Math.floor((now.getTime() - new Date(app.last_used_date).getTime()) / (1000 * 60 * 60 * 24))
        : null

      const inCooldown = app.is_affiliate && app.last_used_date && daysSinceLastUsed !== null && daysSinceLastUsed < affiliateCooldownDays

      return {
        app_name: app.app_name,
        category: app.category,
        is_affiliate: app.is_affiliate,
        is_featured: app.is_featured,
        last_used_date: app.last_used_date,
        days_since_last_used: daysSinceLastUsed,
        in_cooldown: inCooldown,
        is_selected: isSelected,
        times_used: app.times_used
      }
    }) || []

    // Get selection details from database
    const { data: selections } = await supabaseAdmin
      .from('issue_ai_app_selections')
      .select('*, app:ai_applications(*)')
      .eq('issue_id', testissueId)
      .order('selection_order')

    return NextResponse.json({
      success: true,
      dry_run: dryRun,
      issue_id: testissueId,
      settings: {
        total_apps: settingsMap.ai_apps_per_newsletter || '6',
        affiliate_cooldown_days: affiliateCooldownDays,
        category_counts: {
          payroll: settingsMap.ai_apps_payroll_count || '0',
          hr: settingsMap.ai_apps_hr_count || '0',
          accounting: settingsMap.ai_apps_accounting_count || '0',
          finance: settingsMap.ai_apps_finance_count || '0',
          productivity: settingsMap.ai_apps_productivity_count || '0',
          client_mgmt: settingsMap.ai_apps_client_mgmt_count || '0',
          banking: settingsMap.ai_apps_banking_count || '0'
        }
      },
      selection_summary: {
        total_selected: selectedApps.length,
        affiliates_selected: selectedApps.filter(a => a.is_affiliate).length,
        non_affiliates_selected: selectedApps.filter(a => !a.is_affiliate).length
      },
      selected_apps: selections?.map(s => ({
        selection_order: s.selection_order,
        app_name: s.app.app_name,
        category: s.app.category,
        is_affiliate: s.app.is_affiliate,
        is_featured: s.app.is_featured,
        last_used_date: s.app.last_used_date,
        times_used: s.app.times_used
      })) || [],
      all_apps_status: appDetails
    })

  } catch (error: any) {
    console.error('Test selection error:', error)
    return NextResponse.json(
      { error: 'Test failed', details: error.message },
      { status: 500 }
    )
  }
  }
)

export const maxDuration = 600
