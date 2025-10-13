import { NextRequest, NextResponse } from 'next/server'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  // Only allow with test secret
  if (secret !== 'test-ai-road-work') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('🚧 Testing AI road work generation...')

    // Use today's date for testing
    const today = new Date()
    const targetDate = today.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Chicago'
    })

    console.log('Target date:', targetDate)

    // Get the AI prompt
    const prompt = await AI_PROMPTS.roadWorkGenerator(targetDate)
    console.log('=== AI PROMPT ===')
    console.log(prompt)
    console.log('=== END PROMPT ===')

    // Call AI
    console.log('Calling OpenAI...')
    const aiResponse = await callOpenAI(prompt, 3000, 0.7)

    console.log('=== AI RESPONSE ===')
    console.log('Type:', typeof aiResponse)
    console.log('Length:', aiResponse?.length || 'N/A')
    console.log('Raw response:', JSON.stringify(aiResponse, null, 2))
    console.log('=== END RESPONSE ===')

    // Test parsing logic from road-work-manager.ts
    let roadWorkItems: any[] = []
    let parseError: any = null

    try {
      let jsonString = ''

      if (typeof aiResponse === 'string') {
        jsonString = aiResponse
      } else if (Array.isArray(aiResponse)) {
        roadWorkItems = aiResponse
        jsonString = '' // Skip parsing
      } else if (aiResponse && typeof aiResponse === 'object' && 'raw' in aiResponse) {
        jsonString = (aiResponse as any).raw
      } else {
        throw new Error('Unexpected AI response format')
      }

      if (jsonString) {
        console.log('Parsing JSON string:', jsonString.substring(0, 200) + '...')

        // Remove markdown code block wrappers if present
        const cleanedJson = jsonString
          .replace(/^```json\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim()

        console.log('Cleaned JSON:', cleanedJson.substring(0, 200) + '...')
        roadWorkItems = JSON.parse(cleanedJson)
      }
    } catch (error) {
      parseError = error
      console.error('Parsing failed:', error)
    }

    // Test the validation logic
    let validationResult: any = null
    let validationError: any = null

    if (roadWorkItems.length > 0) {
      try {
        console.log('🔍 Testing validation logic...')
        const validationPrompt = await AI_PROMPTS.roadWorkValidator(roadWorkItems, targetDate)
        validationResult = await callOpenAI(validationPrompt, 2000, 0)
        console.log('Validation result:', JSON.stringify(validationResult, null, 2))
      } catch (error) {
        validationError = error
        console.error('Validation failed:', error)
      }
    }

    return NextResponse.json({
      success: !parseError,
      targetDate,
      aiResponse: {
        type: typeof aiResponse,
        length: aiResponse?.length || 'N/A',
        raw: aiResponse
      },
      parseError: parseError ? {
        message: parseError.message,
        name: parseError.name
      } : null,
      parsedItems: parseError ? null : {
        count: roadWorkItems?.length,
        items: roadWorkItems
      },
      validation: validationError ? {
        error: validationError.message
      } : validationResult,
      debugInfo: {
        timestamp: new Date().toISOString(),
        prompt: prompt
      }
    })

  } catch (error) {
    console.error('Test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}