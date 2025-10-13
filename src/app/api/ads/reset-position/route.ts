import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // Reset next_ad_position to 1
    const { error } = await supabaseAdmin
      .from('app_settings')
      .update({ value: '1', updated_at: new Date().toISOString() })
      .eq('key', 'next_ad_position')

    if (error) throw error

    return NextResponse.json({ success: true, next_ad_position: 1 })
  } catch (error) {
    console.error('Reset position error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reset position' },
      { status: 500 }
    )
  }
}
