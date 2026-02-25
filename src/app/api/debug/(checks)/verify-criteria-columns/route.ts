import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/verify-criteria-columns' },
  async ({ request, logger }) => {
    console.log('[Verify] Checking if criteria columns exist in post_ratings...')

    // Try to select criteria columns to verify they exist
    const { data: testQuery, error: testError } = await supabaseAdmin
      .from('post_ratings')
      .select(`
        criteria_1_score, criteria_1_reason, criteria_1_weight,
        criteria_2_score, criteria_2_reason, criteria_2_weight,
        criteria_3_score, criteria_3_reason, criteria_3_weight,
        criteria_4_score, criteria_4_reason, criteria_4_weight,
        criteria_5_score, criteria_5_reason, criteria_5_weight
      `)
      .limit(1)

    if (testError) {
      console.error('[Verify] Criteria columns DO NOT exist:', testError.message)
      return NextResponse.json({
        success: false,
        message: 'Criteria columns DO NOT exist in post_ratings table',
        error: testError.message,
        missing_columns: testError.message,
        recommendation: 'Run the migration: db/migrations/add_criteria_to_post_ratings.sql',
        migration_url: '/api/debug/run-criteria-migration'
      })
    }

    console.log('[Verify] Criteria columns exist!')

    // Also check if we have any data with criteria scores
    const { data: withScores, error: scoresError } = await supabaseAdmin
      .from('post_ratings')
      .select('id, criteria_1_score, criteria_1_reason')
      .not('criteria_1_score', 'is', null)
      .limit(5)

    return NextResponse.json({
      success: true,
      message: 'Criteria columns exist in post_ratings table',
      columns_verified: [
        'criteria_1_score', 'criteria_1_reason', 'criteria_1_weight',
        'criteria_2_score', 'criteria_2_reason', 'criteria_2_weight',
        'criteria_3_score', 'criteria_3_reason', 'criteria_3_weight',
        'criteria_4_score', 'criteria_4_reason', 'criteria_4_weight',
        'criteria_5_score', 'criteria_5_reason', 'criteria_5_weight'
      ],
      sample_data_count: withScores?.length || 0,
      sample_data: withScores?.slice(0, 2) || []
    })
  }
)
