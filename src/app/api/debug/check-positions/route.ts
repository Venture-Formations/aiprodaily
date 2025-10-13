import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')

    if (!campaignId) {
      return NextResponse.json({ error: 'campaign_id parameter required' }, { status: 400 })
    }

    // Check if the position columns exist by trying to select them
    const { data: articles, error } = await supabaseAdmin
      .from('articles')
      .select('id, headline, rank, is_active, review_position, final_position')
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .order('rank', { ascending: true })
      .limit(5)

    if (error) {
      console.error('Error querying articles with positions:', error)
      return NextResponse.json({
        error: 'Database query failed',
        message: error.message,
        hint: error.message.includes('column') ? 'Position columns may not exist in database' : 'Other database error'
      }, { status: 500 })
    }

    // Also check manual articles
    const { data: manualArticles, error: manualError } = await supabaseAdmin
      .from('manual_articles')
      .select('id, title, rank, is_active, review_position, final_position')
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .order('rank', { ascending: true })
      .limit(5)

    if (manualError) {
      console.error('Error querying manual articles with positions:', manualError)
    }

    return NextResponse.json({
      success: true,
      campaign_id: campaignId,
      articles: {
        count: articles?.length || 0,
        data: articles?.map((a, index) => ({
          id: a.id,
          headline: a.headline,
          rank: a.rank,
          review_position: a.review_position,
          final_position: a.final_position,
          expected_review_position: index + 1
        })) || []
      },
      manual_articles: {
        count: manualArticles?.length || 0,
        data: manualArticles?.map((a, index) => ({
          id: a.id,
          title: a.title,
          rank: a.rank,
          review_position: a.review_position,
          final_position: a.final_position,
          expected_review_position: index + 1
        })) || []
      },
      analysis: {
        has_position_columns: !error,
        articles_with_review_positions: articles?.filter(a => a.review_position !== null).length || 0,
        articles_with_final_positions: articles?.filter(a => a.final_position !== null).length || 0,
        positions_working: (articles?.filter(a => a.review_position !== null).length || 0) > 0
      }
    })

  } catch (error) {
    console.error('Position check error:', error)
    return NextResponse.json({
      error: 'Failed to check article positions',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}