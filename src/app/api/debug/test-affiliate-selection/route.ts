import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { AppSelector } from '@/lib/app-selector'

/**
 * GET /api/debug/test-affiliate-selection
 *
 * Tests the affiliate app selection logic without running RSS process
 *
 * Query params:
 * - campaignId: (optional) Use existing campaign, or creates test campaign
 * - reset: (optional) Set to 'true' to clear existing selections first
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')
    const reset = searchParams.get('reset') === 'true'

    let testCampaignId = campaignId

    // Get newsletter ID
    const { data: newsletter } = await supabaseAdmin
      .from('newsletters')
      .select('id')
      .eq('slug', 'accounting')
      .single()

    if (!newsletter) {
      return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 })
    }

    // If no campaign ID provided, get latest draft campaign or create test one
    if (!testCampaignId) {
      const { data: latestCampaign } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('id')
        .eq('newsletter_id', newsletter.id)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (latestCampaign) {
        testCampaignId = latestCampaign.id
      } else {
        // Create a test campaign
        const testDate = new Date().toISOString().split('T')[0]
        const { data: newCampaign, error } = await supabaseAdmin
          .from('newsletter_campaigns')
          .insert({
            newsletter_id: newsletter.id,
            date: testDate,
            status: 'draft'
          })
          .select('id')
          .single()

        if (error || !newCampaign) {
          return NextResponse.json({ error: 'Failed to create test campaign' }, { status: 500 })
        }
        testCampaignId = newCampaign.id
      }
    }

    // Clear existing selections if reset=true
    if (reset) {
      await supabaseAdmin
        .from('campaign_ai_app_selections')
        .delete()
        .eq('campaign_id', testCampaignId)
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
      .eq('newsletter_id', newsletter.id)
      .eq('is_active', true)
      .order('app_name')

    // Run selection logic
    const selectedApps = await AppSelector.selectAppsForCampaign(testCampaignId, newsletter.id)

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
      .from('campaign_ai_app_selections')
      .select('*, app:ai_applications(*)')
      .eq('campaign_id', testCampaignId)
      .order('selection_order')

    return NextResponse.json({
      success: true,
      campaign_id: testCampaignId,
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

export const maxDuration = 60
