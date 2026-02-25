import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'ai/save-prompt' },
  async ({ session, request, logger }) => {
    const body = await request.json()
    const {
      publication_id,
      provider,
      model,
      prompt_type,
      prompt,
      parameters
    } = body

    if (!publication_id || !provider || !model || !prompt_type || !prompt) {
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
        publication_id,
        provider,
        model,
        prompt_type,
        prompt,
        parameters: parameters || {},
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,publication_id,provider,model,prompt_type'
      })
      .select()
      .single()

    if (error) {
      logger.error({ err: error }, 'Error saving prompt')
      return NextResponse.json(
        { error: 'Failed to save prompt', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  }
)
