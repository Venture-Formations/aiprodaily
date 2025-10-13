import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    // Get all active ads to determine next display_order
    const { data: activeAds, error: fetchError } = await supabaseAdmin
      .from('advertisements')
      .select('display_order')
      .eq('status', 'active')
      .not('display_order', 'is', null)
      .order('display_order', { ascending: false })
      .limit(1)

    if (fetchError) throw fetchError

    // Calculate next display_order
    const nextOrder = activeAds && activeAds.length > 0
      ? (activeAds[0].display_order || 0) + 1
      : 1

    // Update ad to active status with next display_order
    const { error } = await supabaseAdmin
      .from('advertisements')
      .update({
        status: 'active',
        display_order: nextOrder,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true, display_order: nextOrder })
  } catch (error) {
    console.error('Activate error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to activate ad' },
      { status: 500 }
    )
  }
}
