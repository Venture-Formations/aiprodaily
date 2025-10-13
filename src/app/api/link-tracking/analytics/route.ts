import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Link Click Analytics Endpoint
 * Provides aggregated click tracking data for the analytics dashboard
 *
 * Query Parameters:
 * - days: Number of days to look back (default: 30)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    console.log(`Fetching link click analytics for last ${days} days`)

    // Fetch link clicks within date range
    const { data: clicks, error } = await supabaseAdmin
      .from('link_clicks')
      .select('*')
      .gte('campaign_date', startDate.toISOString().split('T')[0])
      .lte('campaign_date', endDate.toISOString().split('T')[0])
      .order('clicked_at', { ascending: false })

    if (error) {
      console.error('Error fetching link clicks:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculate total clicks
    const totalClicks = clicks?.length || 0

    // Calculate clicks by section
    const clicksBySection: { [key: string]: number } = {}
    clicks?.forEach(click => {
      clicksBySection[click.link_section] = (clicksBySection[click.link_section] || 0) + 1
    })

    // Calculate unique users by section
    const uniqueUsersBySection: { [key: string]: Set<string> } = {}
    clicks?.forEach(click => {
      if (!uniqueUsersBySection[click.link_section]) {
        uniqueUsersBySection[click.link_section] = new Set()
      }
      uniqueUsersBySection[click.link_section].add(click.subscriber_email)
    })

    const uniqueUsersCount: { [key: string]: number } = {}
    Object.keys(uniqueUsersBySection).forEach(section => {
      uniqueUsersCount[section] = uniqueUsersBySection[section].size
    })

    // Calculate daily click counts
    const dailyClicks: { [key: string]: number } = {}
    clicks?.forEach(click => {
      const date = click.campaign_date
      dailyClicks[date] = (dailyClicks[date] || 0) + 1
    })

    // Calculate top clicked URLs
    const urlClickCounts: { [key: string]: { count: number; section: string } } = {}
    clicks?.forEach(click => {
      if (!urlClickCounts[click.link_url]) {
        urlClickCounts[click.link_url] = { count: 0, section: click.link_section }
      }
      urlClickCounts[click.link_url].count++
    })

    const topUrls = Object.entries(urlClickCounts)
      .map(([url, data]) => ({
        url,
        section: data.section,
        clicks: data.count
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10)

    // Calculate click-through rate by campaign
    const clicksByCampaign: { [key: string]: number } = {}
    clicks?.forEach(click => {
      const campaignId = click.campaign_id || click.campaign_date
      clicksByCampaign[campaignId] = (clicksByCampaign[campaignId] || 0) + 1
    })

    // Get recent clicks for display
    const recentClicks = clicks?.slice(0, 20).map(click => ({
      campaign_date: click.campaign_date,
      link_section: click.link_section,
      link_url: click.link_url,
      clicked_at: click.clicked_at
    }))

    // Calculate unique users overall
    const uniqueUsers = new Set(clicks?.map(c => c.subscriber_email) || []).size

    return NextResponse.json({
      success: true,
      analytics: {
        totalClicks,
        uniqueUsers,
        clicksBySection,
        uniqueUsersBySection: uniqueUsersCount,
        dailyClicks,
        topUrls,
        clicksByCampaign,
        recentClicks,
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        }
      }
    })

  } catch (error) {
    console.error('Link click analytics error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
