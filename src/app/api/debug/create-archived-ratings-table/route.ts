import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Create the archived_post_ratings table
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS archived_post_ratings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          archived_post_id UUID REFERENCES archived_rss_posts(id) ON DELETE CASCADE,
          interest_level INTEGER,
          local_relevance INTEGER,
          community_impact INTEGER,
          ai_reasoning TEXT,
          total_score NUMERIC,
          criteria_1_score INTEGER,
          criteria_1_reason TEXT,
          criteria_1_weight NUMERIC,
          criteria_2_score INTEGER,
          criteria_2_reason TEXT,
          criteria_2_weight NUMERIC,
          criteria_3_score INTEGER,
          criteria_3_reason TEXT,
          criteria_3_weight NUMERIC,
          criteria_4_score INTEGER,
          criteria_4_reason TEXT,
          criteria_4_weight NUMERIC,
          criteria_5_score INTEGER,
          criteria_5_reason TEXT,
          criteria_5_weight NUMERIC,
          archived_at TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Create index for faster lookups
        CREATE INDEX IF NOT EXISTS idx_archived_post_ratings_post_id
          ON archived_post_ratings(archived_post_id);
      `
    })

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'archived_post_ratings table created successfully'
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
