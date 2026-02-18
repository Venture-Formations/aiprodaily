import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { PUBLICATION_ID } from '@/lib/config'

/**
 * Tools Directory Analytics Endpoint
 * Provides aggregated click tracking data for the tools analytics dashboard
 *
 * Query Parameters:
 * - days: Number of days to look back (default: 30)
 * - click_type: Filter by type (optional: category_click, tool_view, external_link)
 * - tool_id: Filter by specific tool (optional)
 * - category_slug: Filter by category (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const clickTypeFilter = searchParams.get('click_type')
    const toolIdFilter = searchParams.get('tool_id')
    const categorySlugFilter = searchParams.get('category_slug')

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    console.log(`[Tools Analytics] Fetching analytics for last ${days} days`)

    // Build the query
    let query = supabaseAdmin
      .from('tool_directory_clicks')
      .select('*')
      .eq('publication_id', PUBLICATION_ID)
      .gte('clicked_at', startDate.toISOString())
      .lte('clicked_at', endDate.toISOString())
      .order('clicked_at', { ascending: false })

    // Apply filters
    if (clickTypeFilter) {
      query = query.eq('click_type', clickTypeFilter)
    }
    if (toolIdFilter) {
      query = query.eq('tool_id', toolIdFilter)
    }
    if (categorySlugFilter) {
      query = query.eq('category_slug', categorySlugFilter)
    }

    // Fetch clicks with pagination (Supabase has 1000 row limit per query)
    const BATCH_SIZE = 1000
    let allClicks: any[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data: clicks, error } = await query.range(offset, offset + BATCH_SIZE - 1)

      if (error) {
        console.error('[Tools Analytics] Error fetching clicks:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (clicks && clicks.length > 0) {
        allClicks = allClicks.concat(clicks)
        offset += BATCH_SIZE
        hasMore = clicks.length === BATCH_SIZE
      } else {
        hasMore = false
      }
    }

    console.log(`[Tools Analytics] Fetched ${allClicks.length} clicks`)

    // Calculate total clicks
    const totalClicks = allClicks.length

    // Calculate clicks by type
    const clicksByType: { [key: string]: number } = {
      category_click: 0,
      tool_view: 0,
      external_link: 0
    }
    allClicks.forEach(click => {
      clicksByType[click.click_type] = (clicksByType[click.click_type] || 0) + 1
    })

    // Calculate daily clicks
    const dailyClicks: { [key: string]: number } = {}
    const dailyByType: { [key: string]: { category_click: number; tool_view: number; external_link: number } } = {}

    allClicks.forEach(click => {
      const date = click.clicked_at.split('T')[0]
      dailyClicks[date] = (dailyClicks[date] || 0) + 1

      if (!dailyByType[date]) {
        dailyByType[date] = { category_click: 0, tool_view: 0, external_link: 0 }
      }
      dailyByType[date][click.click_type as keyof typeof dailyByType[string]]++
    })

    // Calculate top categories by clicks
    const categoryClicks: { [key: string]: { clicks: number; name: string } } = {}
    allClicks.forEach(click => {
      if (click.category_slug) {
        if (!categoryClicks[click.category_slug]) {
          categoryClicks[click.category_slug] = { clicks: 0, name: click.category_name || click.category_slug }
        }
        categoryClicks[click.category_slug].clicks++
      }
    })

    const topCategories = Object.entries(categoryClicks)
      .map(([slug, data]) => ({
        slug,
        name: data.name,
        clicks: data.clicks
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10)

    // Calculate top tools by views
    const toolViews: { [key: string]: { views: number; name: string; external_clicks: number } } = {}
    allClicks.forEach(click => {
      if (click.tool_id) {
        if (!toolViews[click.tool_id]) {
          toolViews[click.tool_id] = { views: 0, name: click.tool_name || 'Unknown', external_clicks: 0 }
        }
        if (click.click_type === 'tool_view') {
          toolViews[click.tool_id].views++
        } else if (click.click_type === 'external_link') {
          toolViews[click.tool_id].external_clicks++
        }
      }
    })

    const topToolsByViews = Object.entries(toolViews)
      .map(([id, data]) => ({
        id,
        name: data.name,
        views: data.views,
        external_clicks: data.external_clicks
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)

    const topToolsByClicks = Object.entries(toolViews)
      .map(([id, data]) => ({
        id,
        name: data.name,
        views: data.views,
        external_clicks: data.external_clicks
      }))
      .sort((a, b) => b.external_clicks - a.external_clicks)
      .slice(0, 10)

    // Calculate clicks by referrer type
    const clicksByReferrerType: { [key: string]: number } = {}
    allClicks.forEach(click => {
      const referrerType = click.referrer_type || 'unknown'
      clicksByReferrerType[referrerType] = (clicksByReferrerType[referrerType] || 0) + 1
    })

    // Calculate recent clicks for activity feed
    const recentClicks = allClicks.slice(0, 20).map(click => ({
      click_type: click.click_type,
      tool_name: click.tool_name,
      category_name: click.category_name,
      referrer_page: click.referrer_page,
      clicked_at: click.clicked_at
    }))

    // Format date range for response
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    return NextResponse.json({
      success: true,
      analytics: {
        totalClicks,
        clicksByType,
        topCategories,
        topToolsByViews,
        topToolsByClicks,
        dailyClicks,
        dailyByType,
        clicksByReferrerType,
        recentClicks,
        dateRange: {
          start: startDateStr,
          end: endDateStr
        }
      }
    })

  } catch (error) {
    console.error('[Tools Analytics] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
