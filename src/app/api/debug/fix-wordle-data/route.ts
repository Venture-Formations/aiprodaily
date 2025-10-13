import { NextRequest, NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    // Get the current data for yesterday
    const { data: current, error: currentError } = await supabaseAdmin
      .from('wordle')
      .select('*')
      .eq('date', '2025-09-28')
      .single()

    if (currentError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch current data',
        details: currentError.message
      }, { status: 500 })
    }

    // Update with good data
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('wordle')
      .update({
        word: 'STORM',
        definition: 'A violent weather condition with strong winds and heavy rain',
        interesting_fact: 'The word storm comes from Old English meaning to rage or be in commotion'
      })
      .eq('date', '2025-09-28')
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to update data',
        details: updateError.message,
        currentData: current
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Wordle data updated successfully',
      before: current,
      after: updated
    })

  } catch (error) {
    console.error('❌ Fix Wordle data failed:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}