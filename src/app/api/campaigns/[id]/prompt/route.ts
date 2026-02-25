import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { PromptSelector } from '@/lib/prompt-selector'

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'campaigns/[id]/prompt' },
  async ({ params }) => {
    const id = params.id

    // Try to get existing selection first
    let prompt = await PromptSelector.getPromptForissue(id)

    // If no prompt selected yet, select one
    if (!prompt) {
      prompt = await PromptSelector.selectPromptForissue(id)
    }

    if (!prompt) {
      return NextResponse.json({
        success: false,
        message: 'No prompts available'
      })
    }

    return NextResponse.json({
      success: true,
      prompt
    })
  }
)
