import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing image analysis database columns...')

    // Test if the new columns exist by trying to select them
    const { data: testQuery, error: testError } = await supabaseAdmin
      .from('images')
      .select('id, age_groups, ocr_text, text_density, ocr_entities, signage_conf')
      .limit(1)

    if (testError) {
      console.error('Database column test failed:', testError)
      return NextResponse.json({
        error: 'Database column test failed',
        details: testError.message,
        suggestion: 'You need to add the missing columns to your Supabase database'
      }, { status: 500 })
    }

    // Test if we can query existing images with the new columns
    const { data: existingImages, error: queryError } = await supabaseAdmin
      .from('images')
      .select('id, age_groups, ocr_text, text_density, ocr_entities, signage_conf')
      .limit(5)

    if (queryError) {
      console.error('Query test failed:', queryError)
      return NextResponse.json({
        error: 'Query test failed - columns may not exist',
        details: queryError.message,
        code: queryError.code
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'All database columns are working correctly',
      test_completed: new Date().toISOString(),
      sample_data: existingImages,
      columns_verified: ['age_groups', 'ocr_text', 'text_density', 'ocr_entities', 'signage_conf']
    })

  } catch (error) {
    console.error('Test endpoint error:', error)
    return NextResponse.json({
      error: 'Test endpoint error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { secret } = await request.json()

    if (secret !== 'test123') {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    // Show current database schema for images table
    const { data: schemaData, error: schemaError } = await supabaseAdmin
      .rpc('get_table_columns', { table_name: 'images' })

    if (schemaError) {
      console.log('Schema query failed, trying alternative approach...')

      // Alternative: try to describe the table structure
      const { data: sampleRow, error: sampleError } = await supabaseAdmin
        .from('images')
        .select('*')
        .limit(1)

      if (sampleError) {
        return NextResponse.json({
          error: 'Cannot analyze database schema',
          details: sampleError.message
        }, { status: 500 })
      }

      const columns = sampleRow && sampleRow.length > 0 ? Object.keys(sampleRow[0]) : []

      return NextResponse.json({
        message: 'Database columns analysis',
        columns_found: columns,
        missing_columns: {
          age_groups: !columns.includes('age_groups'),
          ocr_text: !columns.includes('ocr_text'),
          text_density: !columns.includes('text_density'),
          ocr_entities: !columns.includes('ocr_entities'),
          signage_conf: !columns.includes('signage_conf')
        },
        sql_to_run: `
-- Run this SQL in your Supabase SQL Editor:
ALTER TABLE images
ADD COLUMN IF NOT EXISTS age_groups JSONB,
ADD COLUMN IF NOT EXISTS ocr_text TEXT,
ADD COLUMN IF NOT EXISTS text_density FLOAT,
ADD COLUMN IF NOT EXISTS ocr_entities JSONB,
ADD COLUMN IF NOT EXISTS signage_conf FLOAT;
        `
      })
    }

    return NextResponse.json({
      message: 'Database schema information',
      schema: schemaData
    })

  } catch (error) {
    console.error('POST endpoint error:', error)
    return NextResponse.json({
      error: 'POST endpoint error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}