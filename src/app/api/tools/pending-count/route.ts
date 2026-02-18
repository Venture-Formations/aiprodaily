import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PUBLICATION_ID } from '@/lib/config'

/**
 * Get count of pending tool submissions
 * Used to show notification badge in navigation
 */
export async function GET() {
  try {
    const { count, error } = await supabaseAdmin
      .from('ai_applications')
      .select('*', { count: 'exact', head: true })
      .eq('publication_id', PUBLICATION_ID)
      .eq('is_active', false)
      .eq('submission_status', 'pending')

    if (error) {
      console.error('[Tools Pending Count] Error:', error)
      return NextResponse.json({ count: 0 })
    }

    return NextResponse.json({ count: count || 0 })
  } catch (error) {
    console.error('[Tools Pending Count] Error:', error)
    return NextResponse.json({ count: 0 })
  }
}
