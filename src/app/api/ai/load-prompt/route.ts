import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const newsletter_id = searchParams.get('newsletter_id')
    const provider = searchParams.get('provider')
    const model = searchParams.get('model') // Optional now
    const prompt_type = searchParams.get('prompt_type')

    if (!newsletter_id || !provider || !prompt_type) {
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
      .eq('newsletter_id', newsletter_id)
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

      console.error('[API] Error loading prompt:', error)
      return NextResponse.json(
        { error: 'Failed to load prompt', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('[API] Error in load-prompt:', error)
    return NextResponse.json(
      {
        error: 'Failed to load prompt',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
