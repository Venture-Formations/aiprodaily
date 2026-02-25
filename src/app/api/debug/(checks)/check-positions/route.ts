import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/check-positions' },
  async ({ request, logger }) => {
    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('issue_id')

    if (!issueId) {
      return NextResponse.json({ error: 'issueId parameter required' }, { status: 400 })
    }

    // Check if the position columns exist by trying to select them
    const { data: articles, error } = await supabaseAdmin
      .from('articles')
      .select('id, headline, rank, is_active, review_position, final_position')
      .eq('issue_id', issueId)
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
      .eq('issue_id', issueId)
      .eq('is_active', true)
      .order('rank', { ascending: true })
      .limit(5)

    if (manualError) {
      console.error('Error querying manual articles with positions:', manualError)
    }

    return NextResponse.json({
      success: true,
      issue_id: issueId,
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
  }
)
