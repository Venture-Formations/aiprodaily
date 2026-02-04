import { NextRequest, NextResponse } from 'next/server'
import { FeedbackModuleSelector } from '@/lib/feedback-modules'

export const maxDuration = 30

// POST /api/feedback-modules/blocks/reorder - Reorder feedback blocks
export async function POST(request: NextRequest) {
  try {
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
  } catch (error) {
    console.error('[FeedbackBlocks] Error reordering blocks:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to reorder blocks' },
      { status: 500 }
    )
  }
}
