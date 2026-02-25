import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'ai/load-prompt' },
  async ({ session, request, logger }) => {
    const { searchParams } = new URL(request.url)
    const publication_id = searchParams.get('publication_id')
    const provider = searchParams.get('provider')
    const model = searchParams.get('model') // Optional now
    const prompt_type = searchParams.get('prompt_type')

    if (!publication_id || !provider || !prompt_type) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Load the saved prompt - if model provided, filter by it, otherwise get most recent
    let query = supabaseAdmin
      .from('ai_prompt_tests')
      .select('*')
      .eq('user_id', session.user.email)
      .eq('publication_id', publication_id)
      .eq('provider', provider)
      .eq('prompt_type', prompt_type)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (model) {
      query = query.eq('model', model)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      // Not found is not an error - just means no saved prompt
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: true,
          data: null
        })
      }

      logger.error({ err: error }, 'Error loading prompt')
      return NextResponse.json(
        { error: 'Failed to load prompt', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  }
)
