import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { PUBLICATION_ID } from '@/lib/config'

/**
 * Get count of pending tool submissions
 * Used to show notification badge in navigation
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'tools/pending-count' },
  async ({ logger }) => {
    const { count, error } = await supabaseAdmin
      .from('ai_applications')
      .select('*', { count: 'exact', head: true })
      .eq('publication_id', PUBLICATION_ID)
      .eq('is_active', false)
      .eq('submission_status', 'pending')

    if (error) {
      logger.error({ err: error }, 'Error fetching pending count')
      return NextResponse.json({ count: 0 })
    }

    return NextResponse.json({ count: count || 0 })
  }
)
