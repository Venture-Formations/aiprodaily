import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Check newsletters table
    const { data: newsletters, error: newslettersError } = await supabaseAdmin
      .from('newsletters')
      .select('*')

    if (newslettersError) {
      return NextResponse.json({
        error: 'Failed to fetch newsletters',
        details: newslettersError
      }, { status: 500 })
    }

    // Check ai_applications table
    const { data: allApps, error: allAppsError } = await supabaseAdmin
      .from('ai_applications')
      .select('*')

    if (allAppsError) {
      return NextResponse.json({
        error: 'Failed to fetch AI applications',
        details: allAppsError
      }, { status: 500 })
    }

    // Check active apps for each newsletter
    const appsByNewsletter = newsletters?.map(newsletter => {
      const newsletterApps = allApps?.filter(app =>
        app.newsletter_id === newsletter.id && app.is_active
      ) || []

      return {
        newsletter_id: newsletter.id,
        newsletter_slug: newsletter.slug,
        newsletter_name: newsletter.name,
        total_apps: newsletterApps.length,
        active_apps: newsletterApps.length,
        apps: newsletterApps.map(app => ({
          id: app.id,
          app_name: app.app_name,
          category: app.category,
          is_active: app.is_active
        }))
      }
    })

    // Check app settings
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .like('key', 'ai_apps_%')

    return NextResponse.json({
      success: true,
      newsletters: newsletters?.map(n => ({ id: n.id, slug: n.slug, name: n.name })),
      total_apps: allApps?.length || 0,
      active_apps: allApps?.filter(a => a.is_active).length || 0,
      apps_by_newsletter: appsByNewsletter,
      ai_app_settings: settings,
      diagnosis: {
        has_newsletters: (newsletters?.length || 0) > 0,
        has_apps: (allApps?.length || 0) > 0,
        has_accounting_newsletter: newsletters?.some(n => n.slug === 'accounting'),
        accounting_has_active_apps: appsByNewsletter?.find(n => n.newsletter_slug === 'accounting')?.active_apps || 0
      }
    })

  } catch (error) {
    console.error('Debug check-ai-apps error:', error)
    return NextResponse.json({
      error: 'Failed to check AI apps setup',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
