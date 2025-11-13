import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // Get the first active newsletter for publication_id
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (newsletterError || !newsletter) {
      return NextResponse.json(
        { error: 'No active newsletter found' },
        { status: 404 }
      )
    }

    // Reset next_ad_position to 1 for this newsletter
    const { error } = await supabaseAdmin
      .from('app_settings')
      .update({ value: '1', updated_at: new Date().toISOString() })
      .eq('publication_id', newsletter.id)
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
