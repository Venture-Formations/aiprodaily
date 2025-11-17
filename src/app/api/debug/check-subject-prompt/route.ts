import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the active publication
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!newsletter) {
      return NextResponse.json({ error: 'No active newsletter found' }, { status: 404 })
    }

    // Fetch subject line prompt
    const { data: prompt } = await supabaseAdmin
      .from('publication_settings')
      .select('key, value')
      .eq('publication_id', newsletter.id)
      .eq('key', 'ai_prompt_subject_line')
      .single()

    if (!prompt) {
      return NextResponse.json({ error: 'Subject line prompt not found' }, { status: 404 })
    }

    // Parse and analyze
    let parsed: any = null
    let parseError: string | null = null
    let issues: string[] = []

    try {
      parsed = JSON.parse(prompt.value)
    } catch (e) {
      parseError = (e as Error).message
    }

    if (parsed) {
      // Check for issues
      if (parsed.model && parsed.model.includes('claude')) {
        issues.push(`Model is Claude (${parsed.model}) but may be called with OpenAI provider`)
      }
      if (parsed.model && parsed.model.includes('gpt')) {
        issues.push(`Model is OpenAI (${parsed.model})`)
      }
      if (!parsed.model) {
        issues.push('No model specified in prompt')
      }
    }

    return NextResponse.json({
      key: prompt.key,
      value_length: prompt.value?.length,
      parse_error: parseError,
      parsed_model: parsed?.model,
      parsed_keys: parsed ? Object.keys(parsed) : [],
      issues,
      first_500_chars: prompt.value?.substring(0, 500)
    })

  } catch (error) {
    console.error('Error checking subject prompt:', error)
    return NextResponse.json({
      error: 'Failed to check subject prompt',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
