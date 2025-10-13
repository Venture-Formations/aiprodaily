import { NextResponse } from 'next/server'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'

export async function GET() {
  try {
    const testPost = {
      title: "St. Cloud State University ranked in U.S. News & World Report",
      description: "SCSU has been recognized for academic excellence in the latest rankings",
      content: "St. Cloud State University continues to demonstrate its commitment to quality education..."
    }

    console.log('Testing contentEvaluator prompt generation...')

    const prompt = await AI_PROMPTS.contentEvaluator(testPost)

    console.log('Generated prompt length:', prompt.length)
    console.log('Prompt preview:', prompt.substring(0, 500))
    console.log('Contains test title?', prompt.includes(testPost.title))

    console.log('Calling OpenAI...')
    const result = await callOpenAI(prompt)

    console.log('AI Response:', JSON.stringify(result, null, 2))

    return NextResponse.json({
      success: true,
      prompt_length: prompt.length,
      prompt_preview: prompt.substring(0, 500),
      contains_title: prompt.includes(testPost.title),
      ai_response: result
    })

  } catch (error) {
    console.error('Content evaluator test error:', error)
    return NextResponse.json({
      error: 'Failed to test content evaluator',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
