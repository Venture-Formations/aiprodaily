import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'

/**
 * Get events for a issue (stub endpoint - accounting newsletter doesn't use events)
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]/events' },
  async () => {
    // Return empty events for newsletters that don't use this feature
    return NextResponse.json({
      issue_events: []
    })
  }
)

/**
 * Update events for a issue (stub endpoint)
 */
export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]/events' },
  async () => {
    // Return success for newsletters that don't use this feature
    return NextResponse.json({
      success: true,
      issue_events: []
    })
  }
)
