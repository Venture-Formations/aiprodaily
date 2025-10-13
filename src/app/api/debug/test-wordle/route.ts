import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { callOpenAI } from '@/lib/openai'

// Create Wordle prompt function
function createWordlePrompt(date: string) {
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
  try {
    console.log('🧩 Testing Wordle collection...')

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0]
    console.log('Date:', today)

    // Generate the prompt for today's date
    const prompt = createWordlePrompt(today)
    console.log('Prompt:', prompt)

    // Call OpenAI with the prompt
    console.log('🤖 Calling OpenAI for Wordle data...')
    const aiResponse = await callOpenAI(prompt, 500, 0.7)
    console.log('Raw AI Response:', aiResponse)
    console.log('AI Response Type:', typeof aiResponse)

    // Try to parse the response or use fallback
    let wordleData
    try {
      // Check if AI refused (common patterns)
      const aiText = typeof aiResponse === 'object' && aiResponse.raw ? aiResponse.raw : aiResponse
      console.log('AI Text for refusal check:', aiText)
      console.log('AI Text type:', typeof aiText)

      const hasRefusal = typeof aiText === 'string' && (
        (aiText.toLowerCase().includes('sorry') && aiText.toLowerCase().includes('wordle')) ||
        aiText.toLowerCase().includes("can't provide") ||
        aiText.toLowerCase().includes("cannot provide") ||
        aiText.toLowerCase().includes("unable to provide")
      )

      console.log('Has refusal pattern:', hasRefusal)

      if (hasRefusal) {
        console.log('AI refused to provide Wordle data, using fallback...')
        // Use a fallback word for testing
        wordleData = {
          word: "COAST",
          definition: "The land near the shore or edge of the sea",
          interesting_fact: "The word coast comes from the Latin word 'costa' meaning rib or side"
        }
      } else {
        // Check if aiResponse is already an object
        if (typeof aiResponse === 'object') {
          console.log('AI Response is object:', aiResponse)
          if (Array.isArray(aiResponse)) {
            wordleData = aiResponse[0]
          } else {
            wordleData = aiResponse
          }
        } else {
          // Try to parse as JSON
          console.log('Trying to parse as JSON...')
          const responseArray = JSON.parse(aiResponse)
          console.log('Parsed Array:', responseArray)

          if (!Array.isArray(responseArray) || responseArray.length === 0) {
            throw new Error('Invalid response format - expected non-empty array')
          }
          wordleData = responseArray[0]
        }
      }

      console.log('Extracted Wordle Data:', wordleData)

      if (!wordleData || !wordleData.word || !wordleData.definition || !wordleData.interesting_fact) {
        throw new Error('Missing required fields in Wordle data')
      }

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

    // Check if entry already exists
    const { data: existing } = await supabaseAdmin
      .from('wordle')
      .select('*')
      .eq('date', today)
      .single()

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Wordle data already exists',
        existing: existing
      })
    }

    // Try to insert into database
    const { data: newWordle, error } = await supabaseAdmin
      .from('wordle')
      .insert([{
        date: today,
        word: wordleData.word.toUpperCase(),
        definition: wordleData.definition,
        interesting_fact: wordleData.interesting_fact
      }])
      .select()
      .single()

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Database insertion failed',
        details: error.message,
        attemptedData: {
          date: today,
          word: wordleData.word.toUpperCase(),
          definition: wordleData.definition,
          interesting_fact: wordleData.interesting_fact
        }
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Wordle data collected and stored successfully',
      data: newWordle
    })

  } catch (error) {
    console.error('❌ Wordle test failed:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    }, { status: 500 })
  }
}