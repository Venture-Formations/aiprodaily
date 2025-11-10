import { NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('Attempting to add skipped column to articles table...')

    // First check if column exists by trying to select it
    const { data: testData, error: testError } = await supabaseAdmin
      .from('articles')
      .select('skipped')
      .limit(1)

    if (!testError) {
      return NextResponse.json({
        success: true,
        message: 'Skipped column already exists',
        alreadyExists: true
      })
    }

    console.log('Column does not exist, need to add it manually in Supabase')

    return NextResponse.json({
      success: false,
      message: 'Database column missing',
      instructions: [
        '1. Go to Supabase Dashboard → SQL Editor',
        '2. Run this SQL command:',
        'ALTER TABLE articles ADD COLUMN skipped BOOLEAN DEFAULT FALSE;',
        '3. Also run this for archived articles:',
        'ALTER TABLE archived_articles ADD COLUMN skipped BOOLEAN DEFAULT FALSE;',
        '4. Then try skipping articles again'
      ],
      testError: testError.message
    })

  } catch (error) {
    console.error('Add skip column check failed:', error)
    return NextResponse.json({
      error: 'Failed to check/add skip column',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}