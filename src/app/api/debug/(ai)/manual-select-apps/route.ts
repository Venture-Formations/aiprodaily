import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { AppSelector } from '@/lib/app-selector'

export async function POST(request: Request) {
  try {
    const { issueId } = await request.json()

    if (!issueId) {
      return NextResponse.json({ error: 'issueId required' }, { status: 400 })
    }

    console.log('Manual AI app selection for issue:', issueId)

    // Get accounting newsletter ID
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('publications')
      .select('id, slug')
      .eq('slug', 'accounting')
      .single()

    if (newsletterError || !newsletter) {
      return NextResponse.json({
        error: 'Accounting newsletter not found',
        details: newsletterError?.message
      }, { status: 404 })
    }

    console.log('Found newsletter:', newsletter.id)

    // Select apps for issue
    const selectedApps = await AppSelector.selectAppsForissue(issueId, newsletter.id)

    console.log(`Selected ${selectedApps.length} AI applications`)

    return NextResponse.json({
      success: true,
      issue_id: issueId,
      publication_id: newsletter.id,
      apps_selected: selectedApps.length,
      apps: selectedApps.map(app => ({
        id: app.id,
        app_name: app.app_name,
        category: app.category
      }))
    })

  } catch (error) {
    console.error('Manual app selection error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
