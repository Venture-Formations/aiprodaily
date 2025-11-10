import { NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'

// This endpoint adds a custom_default column to app_settings table
// Run once to enable "Save as Default" functionality for AI prompts
export async function GET() {
  try {
    console.log('Adding custom_default column to app_settings table...')

    // Check if column already exists
    const { data: existingData, error: checkError } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .limit(1)

    if (checkError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to check table schema',
        details: checkError.message
      }, { status: 500 })
    }

    // Try to query with custom_default to see if it exists
    const { error: columnCheckError } = await supabaseAdmin
      .from('app_settings')
      .select('custom_default')
      .limit(1)

    if (columnCheckError) {
      // Column doesn't exist, need to add it
      console.log('Column does not exist, need to run SQL migration manually')

      return NextResponse.json({
        success: false,
        message: 'Column does not exist. Run this SQL in Supabase SQL Editor:',
        sql: `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS custom_default TEXT;`,
        note: 'After running the SQL, this endpoint will confirm the column exists.'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'custom_default column already exists in app_settings table',
      note: 'You can now use "Save as Default" functionality for AI prompts'
    })

  } catch (error) {
    console.error('Error checking/adding custom_default column:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
