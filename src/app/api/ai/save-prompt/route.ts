import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      newsletter_id,
      provider,
      model,
      prompt_type,
      prompt,
      parameters
    } = body

    if (!newsletter_id || !provider || !model || !prompt_type || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Upsert (insert or update) the prompt
    const { data, error } = await supabaseAdmin
      .from('ai_prompt_tests')
      .upsert({
        user_id: session.user.email,
        newsletter_id,
        provider,
        model,
        prompt_type,
        prompt,
        parameters: parameters || {},
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,newsletter_id,provider,model,prompt_type'
      })
      .select()
      .single()

    if (error) {
      console.error('[API] Error saving prompt:', error)
      return NextResponse.json(
        { error: 'Failed to save prompt', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('[API] Error in save-prompt:', error)
    return NextResponse.json(
      {
        error: 'Failed to save prompt',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
