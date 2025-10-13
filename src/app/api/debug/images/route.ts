import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('Debug endpoint called, checking database...')
    console.log('Environment check:')
    console.log('- SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing')
    console.log('- SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing')
    console.log('- SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing')

    // Check if supabaseAdmin is working
    const { data: testQuery, error: testError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('count(*)')

    console.log('Test query result:', testQuery, 'Error:', testError)

    // Get all campaigns to see what exists
    const { data: allCampaigns, error: campaignsError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, status')
      .order('date', { ascending: false })

    console.log('Campaigns query result:', allCampaigns, 'Error:', campaignsError)

    // Get RSS feeds to see if they're configured
    const { data: feeds } = await supabaseAdmin
      .from('rss_feeds')
      .select('id, name, url, active')

    if (!allCampaigns || allCampaigns.length === 0) {
      return NextResponse.json({
        error: 'No campaigns found',
        campaigns: [],
        feeds: feeds || [],
        debug: 'RSS processing has never run or campaigns are not being created'
      })
    }

    const campaign = allCampaigns[0]

    // Get RSS posts with images for this campaign
    const { data: posts } = await supabaseAdmin
      .from('rss_posts')
      .select('id, title, image_url, campaign_id')
      .eq('campaign_id', campaign.id)

    // Get articles for this campaign
    const { data: articles } = await supabaseAdmin
      .from('articles')
      .select(`
        id,
        headline,
        is_active,
        rss_post:rss_posts(
          id,
          title,
          image_url
        )
      `)
      .eq('campaign_id', campaign.id)

    return NextResponse.json({
      campaigns: allCampaigns,
      currentCampaign: campaign,
      feeds: feeds || [],
      posts: posts || [],
      articles: articles || [],
      postsWithImages: posts?.filter(p => p.image_url) || [],
      activeArticles: articles?.filter(a => a.is_active) || []
    })

  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}