import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Fix total_score column type from INTEGER to NUMERIC
 * This allows weighted scores like 22.5, 25.5, etc.
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(maintenance)/fix-total-score-column' },
  async ({ logger }) => {
  try {
    console.log('Fixing total_score column type...')

    // Change column type from INTEGER to NUMERIC
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        ALTER TABLE post_ratings
        ALTER COLUMN total_score TYPE NUMERIC USING total_score::NUMERIC;
      `
    })

    if (error) {
      // Try alternative method if rpc doesn't work
      console.log('RPC method failed, trying direct query...')

      const result = await supabaseAdmin
        .from('post_ratings')
        .select('id')
        .limit(1)

      return NextResponse.json({
        error: 'Could not execute ALTER TABLE. Please run this SQL manually in Supabase SQL Editor:',
        sql: 'ALTER TABLE post_ratings ALTER COLUMN total_score TYPE NUMERIC USING total_score::NUMERIC;',
        supabaseError: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'total_score column type changed from INTEGER to NUMERIC',
      note: 'This allows weighted scores with decimal values like 22.5, 25.5, etc.'
    })

  } catch (error) {
    console.error('Fix failed:', error)
    return NextResponse.json({
      error: 'Migration failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      manual_sql: 'ALTER TABLE post_ratings ALTER COLUMN total_score TYPE NUMERIC USING total_score::NUMERIC;'
    }, { status: 500 })
  }
  }
)
