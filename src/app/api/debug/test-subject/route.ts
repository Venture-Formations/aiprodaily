import { NextRequest, NextResponse } from 'next/server'
import { AI_PROMPTS, callOpenAI } from '@/lib/openai'

export async function GET(request: NextRequest) {
  try {
    console.log('=== TESTING SUBJECT LINE GENERATION ===')

    // Test with sample articles
    const testArticles = [
      {
        headline: "St. Cloud City Council Approves New Downtown Development Project",
        content: "The St. Cloud City Council unanimously approved a major downtown development project that will bring new businesses and housing to the area. The project is expected to create over 200 jobs and bring millions in investment to the local economy."
      },
      {
        headline: "Local School District Announces New STEM Program",
        content: "St. Cloud Area School District is launching a comprehensive STEM education program this fall. The initiative will provide students with hands-on experience in science, technology, engineering, and mathematics."
      }
    ]

    console.log('Test articles:', testArticles)

    // Generate subject line using AI
    const prompt = await AI_PROMPTS.subjectLineGenerator(testArticles)
    console.log('AI Prompt:', prompt)

    const result = await callOpenAI(prompt)
    console.log('AI Result:', result)

    if (!result.subject_line) {
      throw new Error('Invalid subject line response from AI')
    }

    return NextResponse.json({
      success: true,
      subject_line: result.subject_line,
      character_count: result.character_count,
      test_articles: testArticles,
      ai_prompt: prompt,
      full_result: result
    })

  } catch (error) {
    console.error('Subject line test failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Subject line test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}