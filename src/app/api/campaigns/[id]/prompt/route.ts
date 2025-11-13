import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PromptSelector } from '@/lib/prompt-selector'

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await props.params

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

  } catch (error) {
    console.error('Error fetching issue prompt:', error)
    return NextResponse.json({
      error: 'Failed to fetch prompt',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
