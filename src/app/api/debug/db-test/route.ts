import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Starting database connection test...')
    console.log('⏰ Start time:', new Date().toISOString())

    // Test basic database connectivity
    console.log('1️⃣ Testing basic connection...')
    const { data: testData, error: testError } = await supabaseAdmin
      .from('events')
      .select('id, title, created_at')
      .limit(1)

    if (testError) {
      throw new Error(`Database connection failed: ${testError.message}`)
    }

    console.log('✅ Basic connection successful')
    console.log('📊 Sample event:', testData?.[0] || 'No events found')

    // Test more complex query like the sync does
    console.log('2️⃣ Testing sync-style query...')
    console.log('⏰ Complex query start:', new Date().toISOString())

    const { data: syncTestData, error: syncTestError } = await supabaseAdmin
      .from('events')
      .select('id, updated_at, event_summary')
      .eq('external_id', 'test_nonexistent_id')
      .single()

    console.log('⏰ Complex query complete:', new Date().toISOString())
    console.log('📋 Sync query result:', {
      found: !!syncTestData,
      error: syncTestError?.code,
      message: syncTestError?.message
    })

    // Test insert operation
    console.log('3️⃣ Testing insert operation...')
    console.log('⏰ Insert test start:', new Date().toISOString())

    const testEventData = {
      external_id: `test_${Date.now()}`,
      title: 'Test Event - Safe to Delete',
      description: 'This is a test event created for debugging',
      start_date: new Date().toISOString(),
      end_date: null,
      venue: 'Test Venue',
      address: 'Test Address',
      url: null,
      image_url: null,
      featured: false,
      active: true,
      raw_data: { test: true },
      updated_at: new Date().toISOString()
    }

    const { data: insertedEvent, error: insertError } = await supabaseAdmin
      .from('events')
      .insert([testEventData])
      .select()

    console.log('⏰ Insert test complete:', new Date().toISOString())

    if (insertError) {
      console.error('❌ Insert failed:', insertError)
      throw new Error(`Insert failed: ${insertError.message}`)
    }

    console.log('✅ Insert successful:', insertedEvent?.[0]?.id)

    // Test update operation
    console.log('4️⃣ Testing update operation...')
    console.log('⏰ Update test start:', new Date().toISOString())

    const { error: updateError } = await supabaseAdmin
      .from('events')
      .update({ title: 'Test Event - Updated - Safe to Delete' })
      .eq('id', insertedEvent?.[0]?.id)

    console.log('⏰ Update test complete:', new Date().toISOString())

    if (updateError) {
      console.error('❌ Update failed:', updateError)
      throw new Error(`Update failed: ${updateError.message}`)
    }

    console.log('✅ Update successful')

    // Clean up test event
    console.log('5️⃣ Cleaning up test event...')
    console.log('⏰ Cleanup start:', new Date().toISOString())

    const { error: deleteError } = await supabaseAdmin
      .from('events')
      .delete()
      .eq('id', insertedEvent?.[0]?.id)

    console.log('⏰ Cleanup complete:', new Date().toISOString())

    if (deleteError) {
      console.error('❌ Cleanup failed:', deleteError)
      // Don't throw here, just log
    } else {
      console.log('✅ Cleanup successful')
    }

    console.log('⏰ All tests complete:', new Date().toISOString())

    return NextResponse.json({
      success: true,
      message: 'All database operations completed successfully',
      tests: {
        connection: 'passed',
        complex_query: 'passed',
        insert: 'passed',
        update: 'passed',
        cleanup: deleteError ? 'failed' : 'passed'
      },
      sample_event: testData?.[0],
      test_event_id: insertedEvent?.[0]?.id,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Database test failed:', error)
    console.log('⏰ Error time:', new Date().toISOString())

    return NextResponse.json({
      error: 'Database test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}