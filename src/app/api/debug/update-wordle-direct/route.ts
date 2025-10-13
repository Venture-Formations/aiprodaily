import { NextRequest, NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { callOpenAIWithWebSearch } from '@/lib/openai'

export async function GET(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const word = searchParams.get('word')

    if (!date || !word) {
      return NextResponse.json({
        success: false,
        error: 'Missing date or word parameter'
      }, { status: 400 })
    }

    console.log(`Updating Wordle data for ${date} with word: ${word}`)

    // Generate definition and interesting fact using web search
    const systemPrompt = `You are a dictionary researcher with web access. Provide accurate definitions and etymology information.`

    const definitionPrompt = `Look up the word "${word}" in reliable dictionaries and provide a brief, clear definition. Keep it under 50 words and make it suitable for a general audience.`
    const definitionResult = await callOpenAIWithWebSearch(systemPrompt, definitionPrompt)
    const definition = (typeof definitionResult === 'string' ? definitionResult : definitionResult?.raw || '').trim()

    const factPrompt = `Research the word "${word}" and share one interesting fact about its etymology, historical usage, or linguistic background. Keep it under 80 words and make it engaging.`
    const factResult = await callOpenAIWithWebSearch(systemPrompt, factPrompt)
    const interesting_fact = (typeof factResult === 'string' ? factResult : factResult?.raw || '').trim()

    // Check if record exists
    const { data: existing } = await supabaseAdmin
      .from('wordle_data')
      .select('*')
      .eq('date', date)
      .single()

    let result
    if (existing) {
      // Update existing record
      result = await supabaseAdmin
        .from('wordle_data')
        .update({
          word: word.toUpperCase(),
          definition: definition,
          interesting_fact: interesting_fact,
          updated_at: new Date().toISOString()
        })
        .eq('date', date)
        .select()
        .single()
    } else {
      // Insert new record
      result = await supabaseAdmin
        .from('wordle_data')
        .insert({
          date: date,
          word: word.toUpperCase(),
          definition: definition,
          interesting_fact: interesting_fact
        })
        .select()
        .single()
    }

    if (result.error) {
      throw result.error
    }

    return NextResponse.json({
      success: true,
      message: `Wordle data updated successfully for ${date}`,
      data: result.data,
      generated: {
        definition,
        interesting_fact
      }
    })

  } catch (error) {
    console.error('Error updating Wordle data:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}