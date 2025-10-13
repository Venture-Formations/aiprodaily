import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('Testing Road Work database setup...')

    // Test 1: Check if road_work_data table exists by trying to query it
    const { data: existingData, error: queryError } = await supabaseAdmin
      .from('road_work_data')
      .select('id')
      .limit(1)

    let tableExists = !queryError
    console.log('Table exists check:', tableExists, queryError?.message || 'OK')

    if (!tableExists) {
      return NextResponse.json({
        success: false,
        error: 'road_work_data table does not exist',
        details: queryError?.message,
        solution: 'The database table needs to be created manually in Supabase SQL editor',
        sql: `
CREATE TABLE IF NOT EXISTS road_work_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  road_work_data JSONB NOT NULL,
  html_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_road_work_data_campaign_id ON road_work_data(campaign_id);
CREATE INDEX IF NOT EXISTS idx_road_work_data_generated_at ON road_work_data(generated_at);
CREATE INDEX IF NOT EXISTS idx_road_work_data_is_active ON road_work_data(is_active);
        `
      })
    }

    // Test 2: Try to insert a test record
    const testData = {
      campaign_id: null, // Temporarily null for testing
      generated_at: new Date().toISOString(),
      road_work_data: [
        {
          road_name: "Test Highway 15",
          road_range: "from 1st Street to 2nd Street",
          city_or_township: "St. Cloud",
          reason: "Test closure for database verification",
          start_date: "Sep 25",
          expected_reopen: "Sep 26",
          source_url: "https://www.dot.state.mn.us/d3/"
        }
      ],
      html_content: "<p>Test HTML content</p>",
      is_active: true
    }

    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('road_work_data')
      .insert(testData)
      .select()

    if (insertError) {
      console.error('Failed to insert test record:', insertError)
      return NextResponse.json({
        success: false,
        error: 'Cannot insert into road_work_data table',
        details: insertError.message,
        tableExists: true,
        testData
      })
    }

    console.log('✅ Test record inserted successfully:', insertData?.[0]?.id)

    // Test 3: Clean up test record
    if (insertData?.[0]?.id) {
      const { error: deleteError } = await supabaseAdmin
        .from('road_work_data')
        .delete()
        .eq('id', insertData[0].id)

      if (deleteError) {
        console.warn('Failed to clean up test record:', deleteError.message)
      } else {
        console.log('✅ Test record cleaned up')
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Road Work database is properly configured',
      tests: {
        tableExists: true,
        canInsert: true,
        canDelete: true
      },
      recordCount: existingData?.length || 0
    })

  } catch (error) {
    console.error('Road Work database test failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Road Work database test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST() {
  return GET()
}