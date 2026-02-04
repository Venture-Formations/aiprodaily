import { NextRequest, NextResponse } from 'next/server'
import { FeedbackModuleSelector } from '@/lib/feedback-modules'

export const maxDuration = 30

// POST /api/feedback-modules/blocks - Create a new feedback block
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { module_id, block_type, display_order } = body

    if (!module_id) {
      return NextResponse.json(
        { success: false, error: 'module_id is required' },
        { status: 400 }
      )
    }

    if (!block_type) {
      return NextResponse.json(
        { success: false, error: 'block_type is required' },
        { status: 400 }
      )
    }

    const validBlockTypes = ['title', 'static_text', 'vote_options', 'team_photos']
    if (!validBlockTypes.includes(block_type)) {
      return NextResponse.json(
        { success: false, error: `Invalid block_type. Must be one of: ${validBlockTypes.join(', ')}` },
        { status: 400 }
      )
    }

    console.log('[FeedbackBlocks] Creating block:', { module_id, block_type, display_order })

    const result = await FeedbackModuleSelector.createBlock(
      module_id,
      block_type,
      display_order
    )

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      block: result.block
    })
  } catch (error) {
    console.error('[FeedbackBlocks] Error creating block:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create block' },
      { status: 500 }
    )
  }
}
