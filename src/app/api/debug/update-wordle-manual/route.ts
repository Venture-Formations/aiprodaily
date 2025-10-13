import { NextRequest, NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { callOpenAI } from '@/lib/openai'

// Create Wordle prompt function
function createWordlePrompt() {
  return `Create educational vocabulary content for a newsletter. Generate one 5-letter English word with its definition and an interesting fact about its origins or usage.

Return ONLY valid JSON in this exact format:

[{
  "word": "SPARK",
  "definition": "A small fiery particle or a bright flash",
  "interesting_fact": "The word spark dates back to Old English and originally meant a small flame or glowing ember"
}]

IMPORTANT: Respond with valid JSON only, no additional text.`
}

export async function GET(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const targetDate = searchParams.get('date')

    if (!targetDate) {
      return NextResponse.json({
        success: false,
        error: 'Date parameter required'
      }, { status: 400 })
    }

    console.log(`🧩 Updating Wordle data for ${targetDate}...`)

    // Generate the prompt
    const prompt = createWordlePrompt()
    console.log('Prompt:', prompt)

    // Call OpenAI with the prompt
    console.log('🤖 Calling OpenAI for Wordle data...')
    const aiResponse = await callOpenAI(prompt, 500, 0.7)
    console.log('Raw AI Response:', aiResponse)
    console.log('AI Response Type:', typeof aiResponse)

    // Parse the response
    let wordleData
    try {
      if (typeof aiResponse === 'object') {
        if (Array.isArray(aiResponse)) {
          wordleData = aiResponse[0]
        } else {
          wordleData = aiResponse
        }
      } else {
        const responseArray = JSON.parse(aiResponse)
        wordleData = responseArray[0]
      }

      if (!wordleData || !wordleData.word || !wordleData.definition || !wordleData.interesting_fact) {
        throw new Error('Missing required fields in Wordle data')
      }

      console.log('Successfully parsed AI response:', wordleData)

    } catch (parseError) {
      console.error('Parse error:', parseError)
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI response',
        details: {
          parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
          rawResponse: aiResponse,
          responseType: typeof aiResponse
        }
      }, { status: 500 })
    }

    // Update database with upsert
    const { data: updatedWordle, error } = await supabaseAdmin
      .from('wordle')
      .upsert([{
        date: targetDate,
        word: wordleData.word.toUpperCase(),
        definition: wordleData.definition,
        interesting_fact: wordleData.interesting_fact
      }], {
        onConflict: 'date'
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Database update failed',
        details: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Wordle data updated successfully for ${targetDate}`,
      data: updatedWordle
    })

  } catch (error) {
    console.error('❌ Wordle update failed:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    }, { status: 500 })
  }
}