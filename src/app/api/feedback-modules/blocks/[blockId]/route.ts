import { NextResponse } from 'next/server'
import { FeedbackModuleSelector } from '@/lib/feedback-modules'
import { withApiHandler } from '@/lib/api-handler'

export const maxDuration = 30

// PATCH /api/feedback-modules/blocks/[blockId] - Update a feedback block
export const PATCH = withApiHandler(
  { authTier: 'authenticated', logContext: 'feedback-modules/blocks/[blockId]' },
  async ({ params, request }) => {
    const blockId = params.blockId
    const body = await request.json()

    console.log('[FeedbackBlocks] Updating block:', blockId, body)

    const result = await FeedbackModuleSelector.updateBlock(blockId, body)

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
  }
)

// DELETE /api/feedback-modules/blocks/[blockId] - Delete a feedback block
export const DELETE = withApiHandler(
  { authTier: 'authenticated', logContext: 'feedback-modules/blocks/[blockId]' },
  async ({ params }) => {
    const blockId = params.blockId

    console.log('[FeedbackBlocks] Deleting block:', blockId)

    const result = await FeedbackModuleSelector.deleteBlock(blockId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true
    })
  }
)
