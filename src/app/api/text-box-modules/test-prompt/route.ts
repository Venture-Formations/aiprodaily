import { NextRequest, NextResponse } from 'next/server'
import { TextBoxGenerator } from '@/lib/text-box-modules'
import type { GenerationTiming } from '@/types/database'

/**
 * POST /api/text-box-modules/test-prompt - Test an AI prompt with placeholder injection
 * Uses data from the last sent issue
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { publicationId, prompt, timing } = body

    if (!publicationId) {
      return NextResponse.json(
        { error: 'publicationId is required' },
        { status: 400 }
      )
    }

    if (!prompt) {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 }
      )
    }

    // Validate timing
    const validTimings: GenerationTiming[] = ['before_articles', 'after_articles']
    const selectedTiming: GenerationTiming = validTimings.includes(timing)
      ? timing
      : 'after_articles'

    const result = await TextBoxGenerator.testPrompt(
      publicationId,
      prompt,
      selectedTiming
    )

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      result: result.result,
      injectedPrompt: result.injectedPrompt,
      timing: selectedTiming
    })

  } catch (error: any) {
    console.error('[TextBoxModules] Failed to test prompt:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to test prompt', details: error.message },
      { status: 500 }
    )
  }
}
