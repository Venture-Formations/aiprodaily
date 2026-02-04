import { NextRequest, NextResponse } from 'next/server'
import { FeedbackModuleSelector } from '@/lib/feedback-modules'

export const maxDuration = 30

// PATCH /api/feedback-modules/blocks/[blockId] - Update a feedback block
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  try {
    const { blockId } = await params
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
  } catch (error) {
    console.error('[FeedbackBlocks] Error updating block:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update block' },
      { status: 500 }
    )
  }
}

// DELETE /api/feedback-modules/blocks/[blockId] - Delete a feedback block
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  try {
    const { blockId } = await params

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
  } catch (error) {
    console.error('[FeedbackBlocks] Error deleting block:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete block' },
      { status: 500 }
    )
  }
}
