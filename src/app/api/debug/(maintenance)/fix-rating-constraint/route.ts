import { NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('Updating post_ratings table constraint to allow interest_level 1-20...')

    // Drop the old constraint and add new one
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        -- Drop old constraint
        ALTER TABLE post_ratings DROP CONSTRAINT IF EXISTS post_ratings_interest_level_check;

        -- Add new constraint for 1-20 range
        ALTER TABLE post_ratings ADD CONSTRAINT post_ratings_interest_level_check
        CHECK (interest_level >= 1 AND interest_level <= 20);
      `
    })

    if (error) {
      console.error('Failed to update constraint:', error)
      return NextResponse.json({
        success: false,
        error: error.message,
        instructions: 'Please run this SQL manually in Supabase SQL Editor:\n\nALTER TABLE post_ratings DROP CONSTRAINT IF EXISTS post_ratings_interest_level_check;\nALTER TABLE post_ratings ADD CONSTRAINT post_ratings_interest_level_check CHECK (interest_level >= 1 AND interest_level <= 20);'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully updated interest_level constraint to allow 1-20 range'
    })

  } catch (error) {
    console.error('Fix rating constraint error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      instructions: 'Please run this SQL manually in Supabase SQL Editor:\n\nALTER TABLE post_ratings DROP CONSTRAINT IF EXISTS post_ratings_interest_level_check;\nALTER TABLE post_ratings ADD CONSTRAINT post_ratings_interest_level_check CHECK (interest_level >= 1 AND interest_level <= 20);'
    }, { status: 500 })
  }
}
