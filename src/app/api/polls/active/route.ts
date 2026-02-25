import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/polls/active - Get the currently active poll for a publication
export const GET = withApiHandler(
  { authTier: 'public', logContext: 'polls-active' },
  async ({ request, logger }) => {
    const searchParams = request.nextUrl.searchParams
    const publicationId = searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'publication_id is required'
        },
        { status: 400 }
      )
    }

    const { data: poll, error } = await supabaseAdmin
      .from('polls')
      .select('id, publication_id, title, question, options, is_active, created_at, updated_at')
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      throw error
    }

    return NextResponse.json({
      success: true,
      poll: poll || null
    })
  }
)
