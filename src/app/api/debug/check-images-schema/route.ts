import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('Checking images table schema...')

    // Get current table structure
    const { data: tableInfo, error: tableError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'images')
      .order('ordinal_position')

    if (tableError) {
      console.error('Error fetching table info:', tableError)
      return NextResponse.json(
        { error: 'Failed to fetch table schema' },
        { status: 500 }
      )
    }

    // Check for specific columns we need
    const requiredColumns = ['city', 'source', 'original_file_name']
    const existingColumns = tableInfo?.map(col => col.column_name) || []
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col))

    // Get a sample of current data
    const { data: sampleData, error: sampleError } = await supabaseAdmin
      .from('images')
      .select('id, location, city, source, original_file_name, ai_caption')
      .limit(5)

    if (sampleError) {
      console.error('Error fetching sample data:', sampleError)
    }

    return NextResponse.json({
      table_schema: tableInfo,
      existing_columns: existingColumns,
      missing_columns: missingColumns,
      needs_migration: missingColumns.length > 0,
      sample_data: sampleData || [],
      migration_sql: missingColumns.length > 0 ? [
        'ALTER TABLE images ADD COLUMN IF NOT EXISTS source TEXT;',
        'ALTER TABLE images ADD COLUMN IF NOT EXISTS original_file_name TEXT;',
        'ALTER TABLE images ADD COLUMN IF NOT EXISTS city TEXT;',
        'UPDATE images SET city = location WHERE location IS NOT NULL AND city IS NULL;'
      ] : [],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Schema check API error:', error)
    return NextResponse.json(
      {
        error: 'Schema check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}