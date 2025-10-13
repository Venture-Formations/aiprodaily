import { NextRequest, NextResponse } from 'next/server'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing Road Work AI generation...')

    const { searchParams } = new URL(request.url)
    const testDate = searchParams.get('date') || 'Sep 25, 2025'

    // Test the AI prompt
    const prompt = await AI_PROMPTS.roadWorkGenerator(testDate)
    console.log('Generated AI prompt:', prompt.substring(0, 200) + '...')

    // Call OpenAI API
    console.log('Calling OpenAI API...')
    const response = await callOpenAI(prompt, 3000, 0.7)

    console.log('AI response received:', typeof response, response?.length || 'N/A')

    // Try to parse the response
    let roadWorkItems = []
    let parseError = null

    try {
      if (typeof response === 'string') {
        roadWorkItems = JSON.parse(response)
      } else if (Array.isArray(response)) {
        roadWorkItems = response
      } else if (response && typeof response === 'object' && response.raw) {
        roadWorkItems = JSON.parse(response.raw)
      } else {
        throw new Error('Unexpected response format')
      }
    } catch (error) {
      parseError = error instanceof Error ? error.message : 'Parse error'
      console.error('Failed to parse AI response:', error)
    }

    return NextResponse.json({
      success: true,
      testDate,
      aiResponse: response,
      parseError,
      roadWorkItems,
      itemCount: Array.isArray(roadWorkItems) ? roadWorkItems.length : 0,
      prompt: prompt.substring(0, 500) + '...'
    })

  } catch (error) {
    console.error('Road Work AI test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}