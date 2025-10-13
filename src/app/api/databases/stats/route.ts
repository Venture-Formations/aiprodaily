import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: eventsCount, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('id', { count: 'exact' })

    if (eventsError) {
      console.error('Error fetching events count:', eventsError)
      return NextResponse.json({ error: 'Failed to fetch events count' }, { status: 500 })
    }

    const { data: vrboCount, error: vrboError } = await supabaseAdmin
      .from('vrbo_listings')
      .select('id', { count: 'exact' })

    if (vrboError) {
      console.error('Error fetching VRBO count:', vrboError)
      // Don't fail the request if VRBO table doesn't exist yet
    }

    const { data: diningCount, error: diningError } = await supabaseAdmin
      .from('dining_deals')
      .select('id', { count: 'exact' })

    if (diningError) {
      console.error('Error fetching Dining Deals count:', diningError)
      // Don't fail the request if table doesn't exist yet
    }

    const { data: imagesCount, error: imagesError } = await supabaseAdmin
      .from('images')
      .select('id', { count: 'exact' })

    if (imagesError) {
      console.error('Error fetching Images count:', imagesError)
      // Don't fail the request if table doesn't exist yet
    }

    const { data: pollsCount, error: pollsError } = await supabaseAdmin
      .from('polls')
      .select('id', { count: 'exact' })

    if (pollsError) {
      console.error('Error fetching Polls count:', pollsError)
      // Don't fail the request if table doesn't exist yet
    }

    const { data: adsCount, error: adsError } = await supabaseAdmin
      .from('advertisements')
      .select('id', { count: 'exact' })

    if (adsError) {
      console.error('Error fetching Ads count:', adsError)
      // Don't fail the request if table doesn't exist yet
    }

    // Get unique RSS sources count
    const { data: rssPosts, error: rssError } = await supabaseAdmin
      .from('rss_posts')
      .select('author')

    const uniqueSources = rssPosts
      ? new Set(rssPosts.map(p => p.author || '(No Author)')).size
      : 0

    const databases = [
      {
        name: 'Local Events',
        description: 'Events pulled from Visit St. Cloud API',
        count: eventsCount?.length || 0,
        href: '/dashboard/databases/events'
      },
      {
        name: 'Dining Deals',
        description: 'Restaurant specials organized by day of week',
        count: diningCount?.length || 0,
        href: '/dashboard/databases/dining'
      },
      {
        name: 'VRBO Listings',
        description: 'Minnesota Getaways properties for newsletters',
        count: vrboCount?.length || 0,
        href: '/dashboard/databases/vrbo'
      },
      {
        name: 'Images',
        description: 'AI-tagged image library with crop and tag management',
        count: imagesCount?.length || 0,
        href: '/dashboard/databases/images'
      },
      {
        name: 'Polls',
        description: 'Newsletter polls and subscriber responses',
        count: pollsCount?.length || 0,
        href: '/dashboard/polls'
      },
      {
        name: 'RSS Sources',
        description: 'Block images from specific RSS sources',
        count: uniqueSources,
        href: '/dashboard/databases/rss-sources'
      },
      {
        name: 'Advertisements',
        description: 'Community Business Spotlight submissions',
        count: adsCount?.length || 0,
        href: '/dashboard/databases/ads'
      }
    ]

    return NextResponse.json({ databases })
  } catch (error) {
    console.error('Database stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}