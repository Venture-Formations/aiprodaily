import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Debug endpoint to verify multi-tenant database schema
 * GET /api/debug/verify-multitenant
 */
export async function GET() {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      checks: {}
    }

    // Check 1: newsletters table exists
    const { data: newsletters, error: newslettersError } = await supabaseAdmin
      .from('newsletters')
      .select('*')
      .limit(5)

    results.checks.newsletters_table = {
      exists: !newslettersError,
      error: newslettersError?.message || null,
      count: newsletters?.length || 0,
      sample: newsletters || []
    }

    // Check 2: newsletter_settings table exists
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('newsletter_settings')
      .select('*')
      .limit(5)

    results.checks.newsletter_settings_table = {
      exists: !settingsError,
      error: settingsError?.message || null,
      count: settings?.length || 0,
      sample: settings || []
    }

    // Check 3: Verify newsletter_id columns exist on key tables
    const tablesToCheck = [
      'newsletter_campaigns',
      'rss_feeds',
      'events',
      'dining_deals',
      'advertisements',
      'newsletter_sections'
    ]

    for (const tableName of tablesToCheck) {
      const { data, error } = await supabaseAdmin
        .from(tableName)
        .select('newsletter_id')
        .limit(1)

      results.checks[`${tableName}_has_newsletter_id`] = {
        exists: !error,
        error: error?.message || null
      }
    }

    // Check 4: Count existing data
    const { count: campaignCount } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('*', { count: 'exact', head: true })

    const { count: articleCount } = await supabaseAdmin
      .from('articles')
      .select('*', { count: 'exact', head: true })

    results.data_counts = {
      campaigns: campaignCount || 0,
      articles: articleCount || 0
    }

    // Determine overall status
    const allChecks = Object.values(results.checks) as any[]
    const allPassed = allChecks.every((check: any) => check.exists === true)

    results.status = allPassed ? 'READY' : 'INCOMPLETE'
    results.message = allPassed
      ? 'Multi-tenant schema is ready! All required tables and columns exist.'
      : 'Some multi-tenant components are missing. See checks for details.'

    return NextResponse.json(results, {
      status: allPassed ? 200 : 500
    })

  } catch (error: any) {
    return NextResponse.json({
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
