import { NextResponse } from 'next/server'
import { TextBoxGenerator } from '@/lib/text-box-modules'
import { withApiHandler } from '@/lib/api-handler'
import type { GenerationTiming } from '@/types/database'

/**
 * POST /api/text-box-modules/test-prompt - Test an AI prompt config with placeholder injection
 * Uses data from the last sent issue
 * Accepts prompt as JSON object or JSON string (will be parsed)
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'text-box-modules/test-prompt' },
  async ({ request }) => {
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

    // Parse prompt if it's a string (JSON)
    let promptConfig: any
    if (typeof prompt === 'string') {
      try {
        promptConfig = JSON.parse(prompt)
      } catch (parseError) {
        return NextResponse.json(
          { success: false, error: 'Invalid JSON: ' + (parseError as Error).message },
          { status: 400 }
        )
      }
    } else {
      promptConfig = prompt
    }

    // Validate timing
    const validTimings: GenerationTiming[] = ['before_articles', 'after_articles']
    const selectedTiming: GenerationTiming = validTimings.includes(timing)
      ? timing
      : 'after_articles'

    const result = await TextBoxGenerator.testPrompt(
      publicationId,
      promptConfig,
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
      timing: selectedTiming
    })
  }
)
