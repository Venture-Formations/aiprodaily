import { NextResponse } from 'next/server'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'

export async function GET() {
  try {
    const testPost = {
      title: "St. Cloud State University ranked in U.S. News & World Report",
      description: "SCSU has been recognized for academic excellence in the latest rankings",
      content: "St. Cloud State University continues to demonstrate its commitment to quality education and student success. The latest U.S. News & World Report rankings highlight the university's dedication to providing affordable, high-quality education to students from diverse backgrounds."
    }

    console.log('Testing newsletterWriter prompt generation...')

    const prompt = await AI_PROMPTS.newsletterWriter(testPost)

    console.log('Generated prompt length:', prompt.length)
    console.log('Prompt preview:', prompt.substring(0, 500))
    console.log('Contains test title?', prompt.includes(testPost.title))

    console.log('Calling OpenAI...')
    const result = await callOpenAI(prompt, 500, 0.7)

    console.log('AI Response type:', typeof result)
    console.log('AI Response preview:', typeof result === 'string' ? result.substring(0, 500) : JSON.stringify(result).substring(0, 500))

    return NextResponse.json({
      success: true,
      prompt_length: prompt.length,
      prompt_preview: prompt.substring(0, 500),
      contains_title: prompt.includes(testPost.title),
      ai_response_type: typeof result,
      ai_response_preview: typeof result === 'string' ? result.substring(0, 500) : JSON.stringify(result).substring(0, 500),
      ai_response_length: typeof result === 'string' ? result.length : JSON.stringify(result).length
    })

  } catch (error) {
    console.error('Newsletter writer test error:', error)
    return NextResponse.json({
      error: 'Failed to test newsletter writer',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
