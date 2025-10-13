import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { updates } = await request.json()

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'Invalid updates array' }, { status: 400 })
    }

    // Update each ad's display_order
    for (const update of updates) {
      const { error } = await supabaseAdmin
        .from('advertisements')
        .update({ display_order: update.display_order })
        .eq('id', update.id)

      if (error) {
        console.error(`Error updating ad ${update.id}:`, error)
        throw error
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reorder error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reorder ads' },
      { status: 500 }
    )
  }
}
