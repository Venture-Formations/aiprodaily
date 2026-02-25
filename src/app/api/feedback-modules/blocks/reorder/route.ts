import { NextResponse } from 'next/server'
import { FeedbackModuleSelector } from '@/lib/feedback-modules'
import { withApiHandler } from '@/lib/api-handler'

export const maxDuration = 30

// POST /api/feedback-modules/blocks/reorder - Reorder feedback blocks
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'feedback-modules/blocks/reorder' },
  async ({ request }) => {
    const body = await request.json()
    const { module_id, block_ids } = body

    if (!module_id || !block_ids || !Array.isArray(block_ids)) {
      return NextResponse.json(
        { success: false, error: 'module_id and block_ids array required' },
        { status: 400 }
      )
    }

    console.log('[FeedbackBlocks] Reordering blocks for module:', module_id, block_ids)

    const result = await FeedbackModuleSelector.reorderBlocks(module_id, block_ids)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  }
)
