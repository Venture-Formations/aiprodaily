import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'

/**
 * GET /api/campaigns/[id]/ad-modules - Get ad mod selections for an issue
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: issueId } = await params

    // Get the issue to get publication_id
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('publication_id')
      .eq('id', issueId)
      .single()

    if (issueError || !issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    // Get all ad mod selections for this issue
    let { data: selections, error: selectionsError } = await supabaseAdmin
      .from('issue_module_ads')
      .select(`
        id,
        selection_mode,
        selected_at,
        used_at,
        advertisement_id,
        ad_module:ad_modules(
          id,
          name,
          display_order,
          block_order,
          selection_mode,
          is_active
        )
      `)
      .eq('issue_id', issueId)

    // Fetch advertisement details separately for each selection that has an advertisement_id
    if (selections && selections.length > 0) {
      const adIds = selections
        .filter(s => s.advertisement_id)
        .map(s => s.advertisement_id)

      if (adIds.length > 0) {
        const { data: advertisements } = await supabaseAdmin
          .from('advertisements')
          .select(`
            id,
            title,
            body,
            image_url,
            button_text,
            button_url,
            company_name,
            times_used,
            advertiser:advertisers(
              id,
              company_name,
              logo_url
            )
          `)
          .in('id', adIds)

        // Map advertisements to selections
        const adMap = new Map(advertisements?.map(a => [a.id, a]) || [])
        selections = selections.map(s => ({
          ...s,
          advertisement: s.advertisement_id ? adMap.get(s.advertisement_id) || null : null
        }))
      }
    }

    if (selectionsError) {
      console.error('[AdModules] Error fetching selections:', selectionsError)
      return NextResponse.json(
        { error: 'Failed to fetch ad mod selections' },
        { status: 500 }
      )
    }

    // If no selections exist, run automatic ad selection
    if (!selections || selections.length === 0) {
      const { ModuleAdSelector } = await import('@/lib/ad-modules')

      // Get issue date for cooldown calculation
      const { data: issueData } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('issue_date')
        .eq('id', issueId)
        .single()

      const issueDate = issueData?.issue_date ? new Date(issueData.issue_date) : new Date()

      // Run ad selection for all modules
      await ModuleAdSelector.selectAdsForIssue(issueId, issue.publication_id, issueDate)

      // Re-fetch selections after creating them
      let { data: newSelections } = await supabaseAdmin
        .from('issue_module_ads')
        .select(`
          id,
          selection_mode,
          selected_at,
          used_at,
          advertisement_id,
          ad_module:ad_modules(
            id,
            name,
            display_order,
            block_order,
            selection_mode,
            is_active
          )
        `)
        .eq('issue_id', issueId)

      // Fetch advertisement details for new selections
      if (newSelections && newSelections.length > 0) {
        const newAdIds = newSelections
          .filter(s => s.advertisement_id)
          .map(s => s.advertisement_id)

        if (newAdIds.length > 0) {
          const { data: newAdvertisements } = await supabaseAdmin
            .from('advertisements')
            .select(`
              id,
              title,
              body,
              image_url,
              button_text,
              button_url,
              company_name,
              times_used,
              advertiser:advertisers(
                id,
                company_name,
                logo_url
              )
            `)
            .in('id', newAdIds)

          const newAdMap = new Map(newAdvertisements?.map(a => [a.id, a]) || [])
          newSelections = newSelections.map(s => ({
            ...s,
            advertisement: s.advertisement_id ? newAdMap.get(s.advertisement_id) || null : null
          }))
        }
      }

      selections = newSelections || []
    }

    // Also get all active ad modules for the publication (to show modules without selections)
    const { data: allModules } = await supabaseAdmin
      .from('ad_modules')
      .select('id, name, display_order, block_order, selection_mode, is_active')
      .eq('publication_id', issue.publication_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    // Get available ads for each mod (for manual selection dropdown)
    // Uses advertisements table with ad_module_id filter
    const moduleAds: Record<string, any[]> = {}
    if (allModules) {
      for (const mod of allModules) {
        const { data: ads } = await supabaseAdmin
          .from('advertisements')
          .select(`
            id,
            title,
            image_url,
            status,
            company_name,
            advertiser:advertisers(company_name)
          `)
          .eq('ad_module_id', mod.id)
          .eq('publication_id', issue.publication_id)
          .eq('status', 'active')
          .order('title')

        moduleAds[mod.id] = ads || []
      }
    }

    return NextResponse.json({
      selections: selections || [],
      modules: allModules || [],
      moduleAds
    })

  } catch (error: any) {
    console.error('[AdModules] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ad modules', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/campaigns/[id]/ad-modules - Manually select an ad for a mod
 * Body: { moduleId, adId }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: issueId } = await params
    const body = await request.json()
    const { moduleId, adId } = body

    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    // Import the selector to use its manual selection method
    const { ModuleAdSelector } = await import('@/lib/ad-modules')

    const result = await ModuleAdSelector.manuallySelectAd(issueId, moduleId, adId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('[AdModules] Error selecting ad:', error)
    return NextResponse.json(
      { error: 'Failed to select ad', details: error.message },
      { status: 500 }
    )
  }
}
