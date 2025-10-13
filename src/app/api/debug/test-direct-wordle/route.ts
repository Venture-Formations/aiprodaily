import { NextRequest, NextResponse } from 'next/server'
import { callOpenAI } from '@/lib/openai'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const targetDate = searchParams.get('date') || '2025-09-28'

    // Format date for the prompt
    const dateObj = new Date(targetDate + 'T00:00:00')
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    const prompt = `Find the Wordle answer for ${formattedDate}, based on trusted spoiler sources and high-confidence solver reports. If the answer is not confirmed, return the most likely guess reported by multiple sources.

Required fields: word, definition, interesting_fact

Field constraints:
- definition: string, max 30 words, from Merriam-Webster/Oxford/Collins
- interesting_fact: string, max 50 words, game show-worthy trivia about etymology, pop culture use, or historical notes

Preferred sources: Reddit r/wordle daily thread, wordlesolver.net, Tom's Cafe Wordle spoiler site, NYT WordleBot

Output format: JSON array only, starts with [

Output structure:
[{
  "word": "string",
  "definition": "string (≤ 30 words)",
  "interesting_fact": "string (≤ 50 words, game show-worthy, do not show source)"
}]

If unconfirmed, return: [{"word": "Unknown", "definition": "Unknown", "interesting_fact": "Unknown"}]

Do not wrap the output in triple backticks or markdown. Return only JSON. No comments or explanations.`

    console.log('🧩 Testing direct Wordle prompt for:', formattedDate)
    console.log('Prompt:', prompt)

    // Call OpenAI directly
    const aiResponse = await callOpenAI(prompt, 1000, 0.7)
    console.log('Raw AI Response:', aiResponse)
    console.log('AI Response Type:', typeof aiResponse)

    return NextResponse.json({
      success: true,
      date: targetDate,
      formattedDate: formattedDate,
      prompt: prompt,
      rawResponse: aiResponse,
      responseType: typeof aiResponse
    })

  } catch (error) {
    console.error('❌ Direct Wordle test failed:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}